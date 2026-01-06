import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, GraduationCap, Calculator, RotateCcw, Info, Save, Loader2, CheckCircle2 } from 'lucide-react';

// Firebase Imports
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot, collection } from "firebase/firestore";

// --- Firebase Configuration & Initialization ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Constants ---
const GRADE_SCALE = [
  { label: 'A+', points: 4.20, range: '85 - 100%', description: 'Outstanding' },
  { label: 'A',  points: 4.00, range: '75 - 84%',  description: 'Excellent' },
  { label: 'A-', points: 3.70, range: '70 - 74%',  description: 'Highly recommended' },
  { label: 'B+', points: 3.30, range: '65 - 69%',  description: 'Very good' },
  { label: 'B',  points: 3.00, range: '60 - 64%',  description: 'Good' },
  { label: 'B-', points: 2.70, range: '55 - 59%',  description: 'Average' },
  { label: 'C+', points: 2.30, range: '50 - 54%',  description: 'Satisfactory pass' },
  { label: 'C',  points: 2.00, range: '45 - 49%',  description: 'Pass' },
  { label: 'C-', points: 1.50, range: '40 - 44%',  description: 'Weak pass' },
  { label: 'D',  points: 1.00, range: '35 - 39%',  description: 'Conditional pass' },
  { label: 'I',  points: 0.00, range: '0 - 34%',   description: 'Incomplete/Fail' },
];

const GPAGauge = ({ gpa, maxGpa = 4.20 }) => {
  const radius = 80;
  const stroke = 12;
  const normalizedGPA = Math.min(Math.max(gpa, 0), maxGpa);
  const percentage = normalizedGPA / maxGpa;
  const circumference = Math.PI * radius; 
  const strokeDashoffset = circumference * (1 - percentage);

  let color = 'text-red-500';
  if (normalizedGPA >= 3.7) color = 'text-emerald-500';
  else if (normalizedGPA >= 3.0) color = 'text-blue-500';
  else if (normalizedGPA >= 2.0) color = 'text-yellow-500';
  else if (normalizedGPA >= 1.0) color = 'text-orange-500';

  return (
    <div className="relative flex flex-col items-center justify-center p-6">
      <svg className="w-64 h-40 overflow-visible transform" viewBox="0 0 200 110">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          className={`transition-all duration-1000 ease-out ${color}`}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="absolute bottom-6 flex flex-col items-center">
        <span className="text-gray-400 text-sm font-medium tracking-wider mb-1">OVERALL GPA</span>
        <span className={`text-5xl font-bold ${color} transition-colors duration-500`}>
          {gpa.toFixed(2)}
        </span>
        <span className="text-gray-400 text-xs mt-1">out of {maxGpa.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [modules, setModules] = useState([
    { id: 1, name: 'Module 1', credits: 3, gradePoint: 4.20 },
    { id: 2, name: 'Module 2', credits: 3, gradePoint: 3.00 },
    { id: 3, name: 'Module 3', credits: 2, gradePoint: 3.70 },
  ]);
  const [showGuide, setShowGuide] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success', 'error'

  // --- 1. Auth & Initial Setup ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- 2. Data Fetching (Load Saved Data) ---
  useEffect(() => {
    if (!user) return;

    // We store data in: artifacts/{appId}/users/{userId}/data/gpa_data
    // Note: Using 'data' collection as a container for documents
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'gpa_calc');

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.modules && Array.isArray(data.modules)) {
          setModules(data.modules);
        }
      }
    }, (error) => {
      console.error("Error fetching data:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // --- 3. Save Functionality ---
  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'gpa_calc');
      await setDoc(docRef, { 
        modules, 
        lastUpdated: new Date().toISOString() 
      });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000); // Clear success message after 3s
    } catch (error) {
      console.error("Error saving data:", error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Core Logic ---
  const addModule = () => {
    const newId = modules.length > 0 ? Math.max(...modules.map(m => m.id)) + 1 : 1;
    setModules([...modules, { id: newId, name: `Module ${newId}`, credits: 3, gradePoint: 4.20 }]);
  };

  const removeModule = (id) => {
    setModules(modules.filter(m => m.id !== id));
  };

  const updateModule = (id, field, value) => {
    setModules(modules.map(m => {
      if (m.id === id) {
        return { ...m, [field]: value };
      }
      return m;
    }));
  };

  const stats = useMemo(() => {
    let totalPoints = 0;
    let totalCredits = 0;

    modules.forEach(m => {
      const creds = parseFloat(m.credits) || 0;
      totalPoints += (m.gradePoint * creds);
      totalCredits += creds;
    });

    const gpa = totalCredits === 0 ? 0 : totalPoints / totalCredits;

    return { gpa, totalCredits, totalPoints };
  }, [modules]);

  const resetData = () => {
    if(window.confirm("Are you sure you want to reset all data?")) {
        setModules([{ id: 1, name: 'Module 1', credits: 3, gradePoint: 4.20 }]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white">
              <GraduationCap size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">GPA Calculator</h1>
              <p className="text-slate-500 text-sm">Track your academic performance</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center gap-2 text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Info size={18} />
              <span className="hidden sm:inline">{showGuide ? 'Hide Scale' : 'Grading Scale'}</span>
            </button>
            
            <button
              onClick={handleSave}
              disabled={isSaving || !user}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold shadow-sm ${
                saveStatus === 'success' 
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : saveStatus === 'success' ? (
                <CheckCircle2 size={18} />
              ) : (
                <Save size={18} />
              )}
              {saveStatus === 'success' ? 'Saved!' : 'Save Progress'}
            </button>
          </div>
        </header>

        {/* Grading Scale Info Panel */}
        {showGuide && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
             <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
                    <Info size={16} /> Guideline Grade Boundaries
                </h3>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                        <tr>
                            <th className="px-4 py-3">Grade</th>
                            <th className="px-4 py-3">Points</th>
                            <th className="px-4 py-3">Range (%)</th>
                            <th className="px-4 py-3">Interpretation</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {GRADE_SCALE.map((g) => (
                            <tr key={g.label} className="hover:bg-slate-50">
                                <td className="px-4 py-2 font-bold text-slate-900">{g.label}</td>
                                <td className="px-4 py-2 font-mono text-indigo-600">{g.points.toFixed(2)}</td>
                                <td className="px-4 py-2 text-slate-600">{g.range}</td>
                                <td className="px-4 py-2 text-slate-500">{g.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Calculator Area */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                        <Calculator size={18} /> Modules
                    </h2>
                    <span className="text-xs font-medium px-2 py-1 bg-slate-200 text-slate-600 rounded-md">
                        {modules.length} Courses
                    </span>
                </div>
                
                <div className="p-4 space-y-3">
                    {/* Header for list */}
                    <div className="grid grid-cols-12 gap-6 px-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        <div className="col-span-5 sm:col-span-4">Module Name</div>
                        <div className="col-span-2 sm:col-span-2 text-center">Credit</div>
                        <div className="col-span-4 sm:col-span-5">Grade</div>
                        <div className="col-span-1"></div>
                    </div>

                    <div className="space-y-3">
                        {modules.map((module) => (
                        <div key={module.id} className="grid grid-cols-12 gap-6 items-center bg-white p-2 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors shadow-sm group">
                            {/* Module Name */}
                            <div className="col-span-5 sm:col-span-4">
                                <input
                                    type="text"
                                    placeholder="Course Name"
                                    className="w-full bg-transparent border-none p-0 text-slate-700 placeholder-slate-400 focus:ring-0 font-medium text-sm"
                                    value={module.name}
                                    onChange={(e) => updateModule(module.id, 'name', e.target.value)}
                                />
                            </div>

                            {/* Credits */}
                            <div className="col-span-2 sm:col-span-2">
                                <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 text-center text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    value={module.credits}
                                    onChange={(e) => updateModule(module.id, 'credits', parseFloat(e.target.value))}
                                />
                            </div>

                            {/* Grade Selector */}
                            <div className="col-span-4 sm:col-span-5 relative">
                                <select
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                                    value={module.gradePoint}
                                    onChange={(e) => updateModule(module.id, 'gradePoint', parseFloat(e.target.value))}
                                >
                                    {GRADE_SCALE.map((g) => (
                                        <option key={g.label} value={g.points}>
                                            {g.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>

                            {/* Delete Button */}
                            <div className="col-span-1 flex justify-end">
                                <button
                                    onClick={() => removeModule(module.id)}
                                    className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                                    aria-label="Remove course"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        ))}
                    </div>

                    <button
                        onClick={addModule}
                        className="w-full mt-4 py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all font-medium text-sm"
                    >
                        <Plus size={18} /> Add Module
                    </button>
                </div>
            </div>
            
            <div className="flex justify-end">
                <button 
                    onClick={resetData}
                    className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 px-3 py-2"
                >
                    <RotateCcw size={12} /> Reset Data
                </button>
            </div>
          </div>

          {/* Result Panel */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2 sticky top-6">
                <div className="bg-slate-900 rounded-xl text-white p-6 pb-2">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest text-center mb-2">Performance</h3>
                    <GPAGauge gpa={stats.gpa} />
                </div>
                
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                            <div className="text-xs text-slate-500 mb-1">Total Credits</div>
                            <div className="text-xl font-bold text-slate-700">{stats.totalCredits}</div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                            <div className="text-xs text-slate-500 mb-1">Quality Points</div>
                            <div className="text-xl font-bold text-slate-700">{stats.totalPoints.toFixed(2)}</div>
                        </div>
                    </div>
                    
                    <div className="text-xs text-center text-slate-400 px-4">
                        GPA is calculated by dividing total quality points by total credits.
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}