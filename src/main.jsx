import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, addDoc, collection, serverTimestamp, setLogLevel } from 'firebase/firestore';

// --- Helper Components ---

/**
 * A reusable input field component with consistent styling.
 */
const FormInput = ({ id, label, type = 'number', value, onChange, min, max, step, required = true, pattern, title }) => (
    <div className="flex-1 min-w-[200px]">
        <label htmlFor={id} className="block text-sm font-semibold text-gray-700 mb-1">
            {label}
        </label>
        <input
            type={type}
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            step={step}
            pattern={pattern}
            title={title}
            required={required}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder={label.replace(' (Years)', '').replace(' ($)', '')}
        />
    </div>
);

/**
 * A reusable select dropdown component.
 */
const FormSelect = ({ id, label, value, onChange, children, required = true }) => (
    <div className="flex-1 min-w-[200px]">
        <label htmlFor={id} className="block text-sm font-semibold text-gray-700 mb-1">
            {label}
        </label>
        <select
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            required={required}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        >
            {children}
        </select>
    </div>
);

/**
 * A reusable checkbox component for the tools section.
 */
const ToolCheckbox = ({ id, label, description, checked, onChange }) => (
    <div className="relative flex items-start p-4 bg-white rounded-lg border border-gray-200 shadow-sm transition-all hover:shadow-md has-[:checked]:ring-2 has-[:checked]:ring-blue-500 has-[:checked]:border-blue-500">
        <div className="flex items-center h-5">
            <input
                id={id}
                name={id}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="focus:ring-blue-500 h-5 w-5 text-blue-600 border-gray-300 rounded"
            />
        </div>
        <div className="ml-3 text-sm">
            <label htmlFor={id} className="font-semibold text-gray-800 cursor-pointer">
                {label}
            </label>
            <p className="text-gray-500">{description}</p>
        </div>
    </div>
);

/**
 * An icon component for the results page.
 */
const InfoIcon = ({ fill = "none", stroke = "currentColor", className = "w-6 h-6" }) => (
    <svg className={className} fill={fill} stroke={stroke} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

/**
 * A component to display a single KPI in the results.
 */
const KpiCard = ({ title, value, subValue, icon, color = 'blue' }) => {
    const colorClasses = {
        blue: 'from-blue-500 to-indigo-600',
        green: 'from-green-500 to-teal-600',
        orange: 'from-orange-500 to-red-600',
        purple: 'from-purple-500 to-indigo-600',
    };

    const iconBgClasses = {
        blue: 'bg-blue-100 text-blue-700',
        green: 'bg-green-100 text-green-700',
        orange: 'bg-orange-100 text-orange-700',
        purple: 'bg-purple-100 text-purple-700',
    };

    return (
        <div className={`relative flex flex-col bg-white p-6 rounded-2xl shadow-lg border border-gray-100 overflow-hidden`}>
            <div className={`absolute top-0 left-0 h-2 w-full bg-gradient-to-r ${colorClasses[color]}`}></div>
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-600">{title}</span>
                <div className={`p-2 rounded-full ${iconBgClasses[color]}`}>
                    {icon}
                </div>
            </div>
            <div>
                <div className="text-4xl font-bold text-gray-900">{value}</div>
                {subValue && (
                    <div className="text-sm font-medium text-gray-500">{subValue}</div>
                )}
            </div>
        </div>
    );
};

/**
 * A component for the score projection chart.
 */
const ScoreChart = ({ start, dip, stabilization, recovery, end, timeline }) => {
    // Calculate percentages for positioning
    const totalGain = end - dip;
    const dipTime = timeline * 0.1; // 10%
    const stabilizationTime = timeline * 0.25; // 25%
    const recoveryTime = timeline * 0.75; // 75%

    const points = [
        { score: start, time: 0, label: "Start", timeLabel: "0 mo", x: 0, y: (start - dip) / totalGain * 100 },
        { score: dip, time: dipTime, label: "Dip", timeLabel: `${Math.round(dipTime)} mo`, x: 10, y: 0 },
        { score: stabilization, time: stabilizationTime, label: "Stabilization", timeLabel: `${Math.round(stabilizationTime)} mo`, x: 25, y: (stabilization - dip) / totalGain * 100 },
        { score: recovery, time: recoveryTime, label: "Recovery", timeLabel: `${Math.round(recoveryTime)} mo`, x: 75, y: (recovery - dip) / totalGain * 100 },
        { score: end, time: timeline, label: "Projected", timeLabel: `${timeline} mo`, x: 100, y: 100 }
    ];

    // Create the SVG path string
    const pathData = `M 0,${100 - points[0].y} C 5,${100 - points[0].y} 5,${100 - points[1].y} 10,${100 - points[1].y} S 20,${100 - points[2].y} 25,${100 - points[2].y} S 50,${100 - points[3].y} 75,${100 - points[3].y} S 95,${100 - points[4].y} 100,${100 - points[4].y}`;

    return (
        <div className="p-6 bg-white rounded-2xl shadow-xl border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Your Score Recovery Journey</h3>
            <p className="text-sm text-gray-600 mb-6">This timeline models your FICO score from its potential low point to its projected goal over {timeline} months.</p>
            <div className="relative h-64 w-full">
                {/* Dotted Lines */}
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="absolute w-full border-t border-dashed border-gray-300" style={{ bottom: `${i * 25}%` }}></div>
                ))}

                {/* Chart Path */}
                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 0.2 }} />
                            <stop offset="100%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 0 }} />
                        </linearGradient>
                    </defs>
                    <path d={`${pathData} L 100,100 L 0,100 Z`} fill="url(#chartGradient)" />
                    <path d={pathData} fill="none" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
                </svg>

                {/* Data Points */}
                {points.map((p, i) => (
                    <div key={p.label} className="absolute" style={{ left: `${p.x}%`, bottom: `${p.y}%`, transform: 'translate(-50%, 50%)' }}>
                        <div className="relative group">
                            <div className="w-4 h-4 bg-white border-4 border-blue-600 rounded-full cursor-pointer"></div>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 p-3 bg-gray-900 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                <span className="font-bold text-lg">{p.score} FICO</span>
                                <span className="block text-sm text-blue-300">{p.label}</span>
                                <span className="block text-xs text-gray-400">@{p.timeLabel}</span>
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-gray-900 -mb-2"></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {/* X-Axis Labels */}
            <div className="flex justify-between text-xs font-medium text-gray-500 mt-3 pt-2 border-t border-gray-200">
                <span>Start</span>
                <span className="hidden sm:block">Stabilization</span>
                <span className="hidden sm:block">Recovery</span>
                <span>Projected</span>
            </div>
        </div>
    );
};


// --- Main Application Component ---

const App = () => {
    /**
     * These variables are placeholders for our collaborative environment.
     * When you deploy to Netlify, you will replace these with `import.meta.env.VARIABLE_NAME`.
     * See the README.md for deployment instructions.
     */
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    // Default state with blank inputs for a clean user experience
    const defaultUserData = {
        ficoScore: '',
        totalDebt: '',
        monthlyIncome: '',
        utilization: '',
        accountsEnrolling: '',
        positiveAccounts: '',
        oldestAccountAge: '',
        programTimeline: 36, // Default to a common timeline
        totalCreditLimit: '', // New field
        
        // Step 2
        scenarioType: 'pre-enrollment',
        monthsInProgram: 0,
        settledAccounts: 0,
        programPhase: 'negotiation',

        // Step 3
        securedCard: true,
        creditBuilder: false,
        authorizedUser: false,
        
        // Step 4 (Capture)
        email: '',
        firstName: '',
        phone: ''
    };

    // --- State Management ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    const [currentStep, setCurrentStep] = useState(1);
    const [userData, setUserData] = useState(defaultUserData);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // --- Firebase Initialization ---
    useEffect(() => {
        if (!firebaseConfig || !Object.keys(firebaseConfig).length) {
            console.warn("Firebase configuration is missing or empty.");
            setIsAuthReady(true);
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);
            setLogLevel('Debug'); // Enable Firestore logging

            setAuth(authInstance);
            setDb(dbInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                let currentUserId;
                if (!user) {
                    console.log("No user found, attempting sign-in...");
                    try {
                        if (initialAuthToken) {
                            console.log("Signing in with custom token...");
                            const cred = await signInWithCustomToken(authInstance, initialAuthToken);
                            currentUserId = cred.user.uid;
                        } else {
                            console.log("Signing in anonymously...");
                            const cred = await signInAnonymously(authInstance);
                            currentUserId = cred.user.uid;
                        }
                    } catch (e) {
                        console.error("Firebase Sign-in Error:", e);
                        currentUserId = crypto.randomUUID(); // Fallback
                    }
                } else {
                    currentUserId = user.uid;
                }
                
                console.log("User ID set:", currentUserId);
                setUserId(currentUserId);
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Firebase Initialization Error:", e);
            setIsAuthReady(true);
        }
    }, [initialAuthToken, JSON.stringify(firebaseConfig)]); // Stringify config to prevent re-renders

    // --- Utility Functions ---

    /**
     * Shows an error message for 5 seconds.
     */
    const showError = (message) => {
        setError(message);
        setTimeout(() => setError(null), 5000);
    };

    /**
     * Generic handler to update any field in the userData state.
     */
    const handleChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        
        let processedValue;
        if (type === 'checkbox') {
            processedValue = checked;
        } else if (type === 'number' || name === 'programTimeline') {
            // Allow empty string for number fields, parse if not empty
            processedValue = value === '' ? '' : Number(value);
        } else {
            processedValue = value;
        }

        setUserData(prev => ({
            ...prev,
            [name]: processedValue
        }));
    }, []);

    // --- Core Simulation Logic ---

    /**
     * Calculates dynamic FICO factor weights based on the user's profile.
     * This is more accurate than a static model.
     */
    const calculateWeights = useCallback((ficoScore, totalDebt, monthlyIncome, positiveAccounts, oldestAccountAge, totalCreditLimit) => {
        const baseWeights = {
            paymentHistory: 0.35,
            utilization: 0.30,
            accountAge: 0.15,
            creditMix: 0.10,
            newCredit: 0.10
        };

        // 1. Adjust for FICO tier
        if (ficoScore >= 740) {
            baseWeights.paymentHistory = 0.25;
            baseWeights.utilization = 0.40; // High scores are sensitive to utilization
            baseWeights.accountAge = 0.20;
        } else if (ficoScore <= 580) {
            baseWeights.paymentHistory = 0.45; // Low scores are heavily penalized for missed payments
            baseWeights.utilization = 0.25;
            baseWeights.newCredit = 0.15;
        }

        // 2. Adjust for DTI and Utilization
        const dti = monthlyIncome > 0 ? (totalDebt / (monthlyIncome * 12)) : 1; // Avoid divide by zero
        if (dti > 0.45) {
            baseWeights.utilization = Math.min(0.45, baseWeights.utilization + 0.05);
            baseWeights.paymentHistory = Math.max(0.25, baseWeights.paymentHistory - 0.05);
        }

        // Check overall utilization if limit is provided
        if (totalCreditLimit > 0) {
            const trueOverallUtilization = (totalDebt / totalCreditLimit) * 100;
            if (trueOverallUtilization < 30) {
                 // Low overall utilization is a good sign, less weight on enrolled debt
                baseWeights.utilization = Math.max(0.20, baseWeights.utilization - 0.05);
            }
        }

        // 3. Adjust for Profile "Anchors" (Positive Accounts)
        if (positiveAccounts > 0) {
            baseWeights.paymentHistory = Math.max(0.30, baseWeights.paymentHistory - 0.05); // Less impact
            baseWeights.creditMix = Math.min(0.20, baseWeights.creditMix + 0.05);
        }

        // 4. Adjust for Account Age
        if (oldestAccountAge < 4) {
            baseWeights.accountAge = Math.max(0.05, baseWeights.accountAge - 0.05);
            baseWeights.newCredit = Math.min(0.20, baseWeights.newCredit + 0.05);
        } else if (oldestAccountAge > 10) {
            baseWeights.accountAge = Math.min(0.25, baseWeights.accountAge + 0.05);
        }

        // 5. Normalize weights to ensure they sum to 1
        const sum = Object.values(baseWeights).reduce((a, b) => a + b, 0);
        for (const key in baseWeights) {
            baseWeights[key] = parseFloat((baseWeights[key] / sum).toFixed(4));
        }

        return baseWeights;
    }, []);

    /**
     * Calculates the potential temporary score drop (worst-case impact).
     */
    const calculateWorstCaseImpact = useCallback((data, weights) => {
        let drop = 0;

        // 1. Utilization penalty (for enrolled accounts)
        // Assumes enrolled accounts will go to 100% utilization during negotiation
        const utilizationFactor = Math.max(0, (100 - data.utilization) / 10);
        drop += utilizationFactor * 5 * (weights.utilization * 2);

        // 2. Severity factor (lower scores drop less, high scores drop more)
        const severityFactor = Math.max(0, (data.ficoScore - 500) / 20);
        drop += severityFactor * 5;

        // 3. Positive anchors (reduce the drop)
        drop -= data.positiveAccounts * 10;
        
        // 4. Age anchor (reduces the drop)
        if (data.oldestAccountAge > 10) {
            drop -= 15;
        }

        // 5. Cap the drop
        return Math.min(150, Math.max(20, Math.round(drop)));
    }, []);

    /**
     * The main simulation engine. Runs all calculations.
     */
    const runSimulation = useCallback((data) => {
        // Ensure all data is numeric for calculation
        const numericData = {
            ...data,
            ficoScore: Number(data.ficoScore) || 0,
            totalDebt: Number(data.totalDebt) || 0,
            monthlyIncome: Number(data.monthlyIncome) || 0,
            utilization: Number(data.utilization) || 0,
            accountsEnrolling: Number(data.accountsEnrolling) || 0,
            positiveAccounts: Number(data.positiveAccounts) || 0,
            oldestAccountAge: Number(data.oldestAccountAge) || 0,
            programTimeline: Number(data.programTimeline) || 36,
            totalCreditLimit: Number(data.totalCreditLimit) || 0,
            monthsInProgram: Number(data.monthsInProgram) || 0,
        };
        
        const initialScore = numericData.ficoScore;
        const weights = calculateWeights(
            numericData.ficoScore,
            numericData.totalDebt,
            numericData.monthlyIncome,
            numericData.positiveAccounts,
            numericData.oldestAccountAge,
            numericData.totalCreditLimit
        );

        let lowPointScore, projectedScore;
        let recoveryMonths = numericData.programTimeline;
        let impactPenalty = 0;

        if (numericData.scenarioType === 'pre-enrollment') {
            impactPenalty = calculateWorstCaseImpact(numericData, weights);
            lowPointScore = Math.max(300, initialScore - impactPenalty);
        } else {
            // Already in-program, the "low point" is their current score
            lowPointScore = initialScore;
            recoveryMonths = Math.max(12, numericData.programTimeline - numericData.monthsInProgram);
            impactPenalty = 0; // No new impact
        }

        // --- Calculate Potential Gain ---
        let totalPotentialGain = 0;

        // 1. Utilization Gain (Biggest factor)
        // Simulates paying off enrolled debt, bringing utilization to 0%
        totalPotentialGain += weights.utilization * 250; // Max gain from this factor

        // 2. Payment History Gain
        // Simulates positive payments on *other* accounts over the timeline
        const historyGain = (weights.paymentHistory * 150) * (recoveryMonths / 36); // Scaled by time
        totalPotentialGain += historyGain;

        // 3. Account Age Gain
        // Simulates accounts getting older
        totalPotentialGain += (weights.accountAge * 50) * (recoveryMonths / 36);

        // 4. Credit Building Tools Gain
        let toolGain = 0;
        if (numericData.securedCard) toolGain += 30;
        if (numericData.creditBuilder) toolGain += 25;
        if (numericData.authorizedUser) toolGain += 10;
        totalPotentialGain += toolGain;

        // 5. Cap the score
        projectedScore = Math.min(850, Math.round(lowPointScore + totalPotentialGain));
        
        // --- Calculate Financials ---
        const debtSavings = numericData.totalDebt * 0.55; // Average 55% reduction
        const postProgramDebt = numericData.totalDebt - debtSavings;
        
        // Simplified DTI: Just monthly income vs. *new* debt payment (assuming 5% of new debt, annualized)
        const annualPostDebtPayment = postProgramDebt * 0.05; // 5% APR on settled amount
        const monthlyPostDebtPayment = annualPostDebtPayment / 12;
        const postDTI = numericData.monthlyIncome > 0 ? (monthlyPostDebtPayment / numericData.monthlyIncome) * 100 : 0;
        
        // --- Calculate Milestones ---
        const totalGain = projectedScore - lowPointScore;
        const stabilizationScore = Math.min(initialScore, lowPointScore + Math.round(totalGain * 0.15));
        const recoveryScore = lowPointScore + Math.round(totalGain * 0.65);

        return {
            initialScore,
            lowPointScore,
            projectedScore,
            scoreGain: projectedScore - initialScore, // Total gain from start
            recoveryTime: `${recoveryMonths} months`,
            postDTI: Math.min(50, postDTI).toFixed(1), // Cap DTI display
            savings: debtSavings,
            impactPenalty, // The calculated drop
            recoveryMonths,
            weights,
            milestoneDipScore: lowPointScore,
            milestoneStabilizationScore: stabilizationScore,
            milestoneRecoveryScore: recoveryScore
        };
    }, [calculateWeights, calculateWorstCaseImpact]);

    /**
     * Saves the simulation input and results to Firestore.
     */
    const saveSimulation = useCallback(async (simulationData, simulationResults) => {
        if (!db || !userId || !isAuthReady) {
            console.warn("Database or User ID not ready. Cannot save simulation.");
            return; // Don't show an error, just fail silently
        }

        // Create the correct collection reference path
        const simulationRef = collection(db, 'artifacts', appId, 'users', userId, 'simulations');
        
        try {
            await addDoc(simulationRef, {
                userId: userId,
                timestamp: serverTimestamp(),
                input: simulationData,
                results: simulationResults,
            });
            console.log("Simulation saved successfully!");
        } catch (e) {
            console.error("Error adding document: ", e);
            // Don't show a user-facing error for this
        }
    }, [db, userId, appId, isAuthReady]);

    // --- Navigation Handlers ---

    const handlePrevious = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            setResults(null); // Clear results when going back
        }
    };

    /**
     * Validates the current step's data and moves to the next step.
     */
    const handleNext = () => {
        // --- Step 1 Validation ---
        if (currentStep === 1) {
            const { ficoScore, totalDebt, accountsEnrolling, monthlyIncome, utilization, positiveAccounts, oldestAccountAge, totalCreditLimit } = userData;
            
            // Use parseFloat for potentially empty strings that get converted to 0
            if (isNaN(parseFloat(ficoScore)) || ficoScore < 300 || ficoScore > 850) {
                showError("Please enter a valid FICO Score (300-850)."); return;
            }
            if (isNaN(parseFloat(totalDebt)) || totalDebt <= 1000) {
                showError("Please enter a valid Total Debt (over $1,000)."); return;
            }
            if (isNaN(parseFloat(accountsEnrolling)) || accountsEnrolling < 1) {
                showError("Please enter at least 1 account for enrollment."); return;
            }
            if (isNaN(parseFloat(monthlyIncome)) || monthlyIncome <= 0) {
                showError("Please enter a valid Monthly Income."); return;
            }
            if (utilization === '') {
                showError("Please select your Credit Utilization range."); return;
            }
            if (isNaN(parseInt(positiveAccounts)) || positiveAccounts < 0) {
                showError("Please enter a valid number of positive accounts (0 or more)."); return;
            }
            if (isNaN(parseInt(oldestAccountAge)) || oldestAccountAge < 0) {
                showError("Please enter a valid age for your oldest account (0 or more)."); return;
            }
            if (isNaN(parseInt(totalCreditLimit)) || totalCreditLimit < 0) {
                showError("Please enter a valid Total Credit Limit (0 or more)."); return;
            }
        }

        // --- Step 2 Validation ---
        if (currentStep === 2) {
             if (userData.scenarioType === 'progress-tracker') {
                if (isNaN(parseInt(userData.monthsInProgram)) || userData.monthsInProgram <= 0) {
                    showError("Please enter how many months you've been in the program."); return;
                }
             }
        }
        
        // --- Step 3 (No validation, move to results) ---
        if (currentStep === 3) {
            calculateAndShowResults();
            return;
        }

        // Move to next step if not calculating results
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
            window.scrollTo(0, 0); // Scroll to top on step change
        }
    };

    /**
     * Final step: run simulation, save results, and show results page.
     */
    const calculateAndShowResults = () => {
        setIsLoading(true);

        // Simulate processing delay for a smoother UX
        setTimeout(() => {
            const calculatedResults = runSimulation(userData);
            setResults(calculatedResults);
            
            // Save results to Firestore *after* calculation
            // We pass userData (the input) and calculatedResults (the output)
            if (isAuthReady) {
                saveSimulation(userData, calculatedResults);
            }
            
            setIsLoading(false);
            setCurrentStep(4); // Move to the results page
            window.scrollTo(0, 0);
        }, 1500);
    };

    // --- Step Components ---

    const Step1Profile = () => (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-extrabold text-gray-900">Your Financial Snapshot</h2>
                <p className="mt-2 text-lg text-gray-600">Tell us where you're starting from. This helps us build your unique projection.</p>
            </div>
            
            <div className="p-6 md:p-8 bg-white rounded-2xl shadow-xl border border-gray-100 space-y-6">
                <div className="flex flex-wrap gap-6">
                    <FormInput id="ficoScore" label="Current FICO Score" value={userData.ficoScore} onChange={handleChange} min="300" max="850" />
                    <FormInput id="totalDebt" label="Total Debt for Resolution ($)" value={userData.totalDebt} onChange={handleChange} min="1000" step="500" />
                </div>
                
                <div className="flex flex-wrap gap-6">
                    <FormInput id="accountsEnrolling" label="# of Accounts Enrolling" value={userData.accountsEnrolling} onChange={handleChange} min="1" max="50" />
                    <FormInput id="monthlyIncome" label="Gross Monthly Income ($)" value={userData.monthlyIncome} onChange={handleChange} min="0" step="100" />
                </div>
                
                <hr className="border-gray-200" />
                
                <h3 className="text-xl font-semibold text-gray-800">Your Credit Profile</h3>
                <p className="text-sm text-gray-500 -mt-4">
                    This info helps our algorithm weigh the factors that impact your score.
                </p>

                <div className="flex flex-wrap gap-6">
                     <FormSelect id="utilization" label="Credit Utilization (Enrolled Accounts)" value={userData.utilization} onChange={handleChange}>
                        <option value="">Select a range...</option>
                        <option value="30">0% - 30%</option>
                        <option value="50">30% - 50%</option>
                        <option value="70">50% - 70%</option>
                        <option value="90">70% - 90%</option>
                        <option value="100">90% - 100% (Maxed)</option>
                    </FormSelect>
                    <FormInput id="totalCreditLimit" label="Total Credit Limit (All Accounts $)" value={userData.totalCreditLimit} onChange={handleChange} min="0" step="100" />
                </div>
                
                <div className="flex flex-wrap gap-6">
                    <FormInput id="positiveAccounts" label="# of Positive Accounts" value={userData.positiveAccounts} onChange={handleChange} min="0" max="50" title="Accounts you'll keep paying on time (auto loans, mortgage, other credit cards)." />
                    <FormInput id="oldestAccountAge" label="Oldest Account Age (Years)" value={userData.oldestAccountAge} onChange={handleChange} min="0" max="100" title="The age of your oldest open credit account." />
                </div>
            </div>
        </div>
    );

    const Step2Scenario = () => (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-extrabold text-gray-900">Your Program & Timeline</h2>
                <p className="mt-2 text-lg text-gray-600">Let's set your goals and timeline.</p>
            </div>

            <div className="p-6 md:p-8 bg-white rounded-2xl shadow-xl border border-gray-100 space-y-6">
                <h3 className="text-xl font-semibold text-gray-800">1. Select Your Scenario</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className={`flex flex-col p-5 rounded-lg border-2 cursor-pointer transition-all ${userData.scenarioType === 'pre-enrollment' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                        <input
                            type="radio"
                            name="scenarioType"
                            value="pre-enrollment"
                            checked={userData.scenarioType === 'pre-enrollment'}
                            onChange={handleChange}
                            className="form-radio h-5 w-5 text-blue-600"
                        />
                        <span className="mt-2 text-lg font-bold text-gray-900">New Client Projection</span>
                        <span className="text-sm text-gray-600">I'm considering enrolling and want to see a full projection.</span>
                    </label>
                    <label className={`flex flex-col p-5 rounded-lg border-2 cursor-pointer transition-all ${userData.scenarioType === 'progress-tracker' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                        <input
                            type="radio"
                            name="scenarioType"
                            value="progress-tracker"
                            checked={userData.scenarioType === 'progress-tracker'}
                            onChange={handleChange}
                            className="form-radio h-5 w-5 text-blue-600"
                        />
                        <span className="mt-2 text-lg font-bold text-gray-900">Existing Client Tracker</span>
                        <span className="text-sm text-gray-600">I'm already in the program and want to track my progress.</span>
                    </label>
                </div>

                {/* Conditional Fields for Progress Tracker */}
                {userData.scenarioType === 'progress-tracker' && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4 animate-fadeIn">
                        <h4 className="text-md font-semibold text-blue-800">Progress Details</h4>
                        <div className="flex flex-wrap gap-6">
                            <FormInput id="monthsInProgram" label="Months in Program" value={userData.monthsInProgram} onChange={handleChange} min="0" />
                            <FormInput id="settledAccounts" label="# of Settled Accounts" value={userData.settledAccounts} onChange={handleChange} min="0" />
                        </div>
                        <FormSelect id="programPhase" label="Current Program Phase" value={userData.programPhase} onChange={handleChange}>
                            <option value="negotiation">Negotiation</option>
                            <option value="settlement">Settlement</option>
                            <option value="graduation">Graduation</option>
                        </FormSelect>
                    </div>
                )}
                
                <hr className="border-gray-200" />
                
                <h3 className="text-xl font-semibold text-gray-800">2. Select Your Timeline</h3>
                 <div className="space-y-2">
                    <label htmlFor="programTimeline" className="block text-sm font-semibold text-gray-700">Expected Program Timeline</label>
                    <input
                        type="range"
                        id="programTimeline"
                        name="programTimeline"
                        min="12"
                        max="60"
                        step="12"
                        value={userData.programTimeline}
                        onChange={handleChange}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-thumb-blue"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>12 mo</span>
                        <span>24 mo</span>
                        <span>36 mo</span>
                        <span>48 mo</span>
                        <span>60 mo</span>
                    </div>
                    <p className="text-center text-lg font-bold text-blue-700 mt-2">{userData.programTimeline} Months</p>
                </div>
            </div>
        </div>
    );

    const Step3Tools = () => (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-extrabold text-gray-900">Credit Building Tools</h2>
                <p className="mt-2 text-lg text-gray-600">Select the tools you plan to use. This adds positive history and accelerates your recovery.</p>
            </div>
            
            <div className="p-6 md:p-8 bg-white rounded-2xl shadow-xl border border-gray-100 space-y-6">
                <ToolCheckbox
                    id="securedCard"
                    label="Secured Credit Card"
                    description="Establishes new positive payment history. We recommend this for all clients."
                    checked={userData.securedCard}
                    onChange={handleChange}
                />
                <ToolCheckbox
                    id="creditBuilder"
                    label="Credit Builder Loan"
                    description="A small loan that builds credit as you save. Great for building a credit mix."
                    checked={userData.creditBuilder}
                    onChange={handleChange}
                />
                <ToolCheckbox
                    id="authorizedUser"
                    label="Authorized User"
                    description="Become a user on a trusted person's account to 'piggyback' on their good history."
                    checked={userData.authorizedUser}
                    onChange={handleChange}
                />
            </div>
            
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <InfoIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-3">
                        <h3 className="text-lg font-semibold text-blue-900">Why does this matter?</h3>
                        <p className="mt-1 text-blue-800">
                            While the program resolves your old debt, these tools build a *new* positive credit file. This combination of removing negatives and adding positives is the fastest path to a strong score.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const Step4Results = () => {
        if (!results) {
            return (
                <div className="text-center p-10">
                    <h2 className="text-2xl font-bold text-gray-800">Error</h2>
                    <p className="text-gray-600">Could not calculate results. Please go back and check your inputs.</p>
                </div>
            );
        }
        
        const {
            initialScore,
            projectedScore,
            lowPointScore,
            scoreGain,
            recoveryTime,
            postDTI,
            savings,
            impactPenalty,
            weights,
            milestoneDipScore,
            milestoneStabilizationScore,
            milestoneRecoveryScore
        } = results;

        return (
            <div className="space-y-8">
                <div className="text-center">
                    <h2 className="text-4xl font-black text-gray-900">Your Credit Comeback Plan</h2>
                    <p className="mt-2 text-xl text-gray-600">Here is your personalized {recoveryTime} projection.</p>
                </div>

                {/* --- KPI Cards --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <KpiCard
                        title="Projected Score"
                        value={projectedScore}
                        subValue={`A ${scoreGain > 0 ? '+' : ''}${scoreGain} point change`}
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                        color="blue"
                    />
                    <KpiCard
                        title="Est. Debt Savings"
                        value={`$${Math.round(savings).toLocaleString()}`}
                        subValue="Approx. 55% of enrolled debt"
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 12v-1m0 1v.01M12 16v-1m0 1v.01M12 7.01V6m6 6c0 3.314-2.686 6-6 6S6 15.314 6 12s2.686-6 6-6 6 2.686 6 6z" /></svg>}
                        color="green"
                    />
                     <KpiCard
                        title="Post-Program DTI"
                        value={`${postDTI}%`}
                        subValue="Debt-to-Income Ratio"
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2" /></svg>}
                        color="purple"
                    />
                </div>
                
                {/* --- Score Chart --- */}
                <ScoreChart
                    start={initialScore}
                    dip={milestoneDipScore}
                    stabilization={milestoneStabilizationScore}
                    recovery={milestoneRecoveryScore}
                    end={projectedScore}
                    timeline={Number(recoveryTime.split(' ')[0])}
                />
                
                {/* --- Email Capture --- */}
                <div className="p-6 md:p-8 bg-white rounded-2xl shadow-xl border border-gray-100 space-y-4">
                     <h3 className="text-2xl font-bold text-gray-900 text-center">Save Your Results</h3>
                     <p className="text-gray-600 text-center">Enter your info to save this projection to your profile and have a copy sent to your email.</p>
                     
                     <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label htmlFor="firstName" className="sr-only">First Name</label>
                            <input type="text" name="firstName" id="firstName" value={userData.firstName} onChange={handleChange} placeholder="First Name" className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label htmlFor="emailCapture" className="sr-only">Email</label>
                            <input type="email" name="email" id="emailCapture" value={userData.email} onChange={handleChange} placeholder="Email Address" className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                        </div>
                     </div>
                     <button
                        onClick={() => {
                            // Re-save with email info
                            saveSimulation(userData, results);
                            // NOTE: alert() is not supported in this environment.
                            // In a real app, you would show a success toast or modal.
                            console.log("Results saved!");
                        }}
                        className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-blue-700 transition-all text-lg"
                    >
                        Save & Email My Results
                    </button>
                </div>

                {/* --- Explanations --- */}
                <div className="p-6 bg-gray-50 border border-gray-200 rounded-2xl space-y-6">
                    <h3 className="text-xl font-semibold text-gray-800">How This Works</h3>
                    <div className="flex items-start">
                        <InfoIcon className="w-10 h-10 text-orange-500" />
                        <div className="ml-3">
                            <h4 className="font-semibold text-gray-800">The "Dip" Phase (Months 0-6)</h4>
                            <p className="text-sm text-gray-600">If you're new, your score may temporarily drop by {impactPenalty > 0 ? `~${impactPenalty} points` : 'a small amount'} as accounts stop aging positively. This is normal and the foundation for recovery. Your positive accounts help cushion this.</p>
                        </div>
                    </div>
                     <div className="flex items-start">
                        <InfoIcon className="w-10 h-10 text-blue-500" />
                        <div className="ml-3">
                            <h4 className="font-semibold text-gray-800">The "Recovery" Phase (Months 6-24)</h4>
                            <p className="text-sm text-gray-600">As your debts are settled, your utilization plummets from {userData.utilization}% to near 0%. This causes a major score increase. Your credit-building tools also start adding positive payment history.</p>
                        </div>
                    </div>
                     <div className="flex items-start">
                        <InfoIcon className="w-10 h-10 text-green-500" />
                        <div className="ml-3">
                            <h4 className="font-semibold text-gray-800">The "Growth" Phase (Months 24+)</h4>
                            <p className="text-sm text-gray-600">With debts resolved, your file is clean. Your score now grows steadily from your new positive accounts aging and your commitment to on-time payments.</p>
                        </div>
                    </div>
                </div>

            </div>
        );
    };

    /**
     * Renders the current step component based on `currentStep`.
     */
    const renderCurrentStep = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center p-20 space-y-4">
                    <div className="w-16 h-16 border-8 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <h2 className="text-2xl font-bold text-gray-800">Calculating Your Future...</h2>
                    <p className="text-gray-600">Our AI is analyzing your profile and running projections.</p>
                </div>
            );
        }

        switch (currentStep) {
            case 1:
                return <Step1Profile />;
            case 2:
                return <Step2Scenario />;
            case 3:
                return <Step3Tools />;
            case 4:
                return <Step4Results />;
            default:
                return <Step1Profile />;
        }
    };

    // --- Main Render ---
    return (
        <div className="bg-gray-100 min-h-screen font-sans antialiased">
            {/* Header */}
            <header className="bg-white shadow-md sticky top-0 z-50">
                <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex-shrink-0 flex items-center">
                            <span className="text-2xl font-bold text-blue-700">CreDebtFree</span>
                        </div>
                        <div className="hidden md:block">
                            <span className="text-sm font-medium text-gray-500">Your Personal Credit Simulator</span>
                        </div>
                    </div>
                </nav>
            </header>

            {/* Error Toast */}
            {error && (
                <div className="fixed top-20 right-5 bg-red-600 text-white p-4 rounded-lg shadow-lg z-50 animate-fadeIn" role="alert">
                    <span className="font-bold">Error:</span> {error}
                </div>
            )}

            {/* Main Content */}
            <main className="max-w-4xl mx-auto py-12 px-4">
                {/* Progress Bar */}
                {currentStep < 4 && !isLoading && (
                    <div className="mb-8">
                        <div className="relative pt-1">
                            <div className="overflow-hidden h-3 mb-2 text-xs flex rounded-full bg-blue-200">
                                <div
                                    style={{ width: `${(currentStep / 3) * 100}%` }}
                                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 transition-all duration-500"
                                ></div>
                            </div>
                            <div className="flex justify-between text-sm font-semibold text-gray-600">
                                <span className={currentStep >= 1 ? 'text-blue-600' : ''}>Profile</span>
                                <span className={currentStep >= 2 ? 'text-blue-600' : ''}>Scenario</span>
                                <span className={currentStep >= 3 ? 'text-blue-600' : ''}>Tools</span>
                                <span>Results</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step Content */}
                <div className="transition-opacity duration-500">
                    {renderCurrentStep()}
                </div>

                {/* Navigation Buttons */}
                {!isLoading && (
                     <div className="mt-12 flex justify-between">
                        <button
                            onClick={handlePrevious}
                            disabled={currentStep === 1 || currentStep === 4}
                            className={`px-8 py-3 rounded-lg font-bold text-lg shadow-md transition-all ${
                                (currentStep === 1 || currentStep === 4)
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300'
                            }`}
                        >
                            Back
                        </button>
                        
                        {currentStep < 4 && (
                            <button
                                onClick={handleNext}
                                className="px-8 py-3 rounded-lg font-bold text-lg shadow-lg text-white bg-blue-600 hover:bg-blue-700 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                                {currentStep === 3 ? 'Calculate Results' : 'Next Step'}
                            </button>
                        )}

                        {currentStep === 4 && (
                             <button
                                onClick={() => {
                                    setCurrentStep(1);
                                    setResults(null);
                                    setUserData(defaultUserData);
                                }}
                                className="px-8 py-3 rounded-lg font-bold text-lg shadow-lg text-white bg-blue-600 hover:bg-blue-700 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                                Start New Simulation
                            </button>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="bg-white mt-16 border-t border-gray-200">
                <div className="max-w-7xl mx-auto py-6 px-4 text-center text-sm text-gray-500">
                    <p>&copy; {new Date().getFullYear()} CreDebtFree.com. All rights reserved.</p>
                    <p className="mt-1">This simulator is for informational purposes only and does not constitute financial advice or a guarantee of results.</p>
                </div>
            </footer>
        </div>
    );
};

export default App;
