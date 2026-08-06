'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import TripPlanResults from '@/components/dashboard/TripPlanResults';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import AIWorkspace from '@/components/workspace/AIWorkspace';
import { getDailyLandingImage } from '@/lib/unsplash';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function PlanTripContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [budget, setBudget] = useState('Moderate');
  const [sourceCity, setSourceCity] = useState('Delhi');
  const [customBudget, setCustomBudget] = useState('');
  const [bgImage, setBgImage] = useState('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80');

  // Instant planning states
  const [isInstantPlan, setIsInstantPlan] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [planResult, setPlanResult] = useState<any>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [originalQueryText, setOriginalQueryText] = useState('Plan a trip');

  useEffect(() => {
    getDailyLandingImage().then(url => {
      if (url) setBgImage(url);
    });
  }, []);

  useEffect(() => {
    const promptParam = searchParams.get('prompt');
    if (promptParam) {
      setDestination(promptParam);
      // Trigger instant plan generation
      setIsInstantPlan(true);
      generateInstantPlan(promptParam);
    }
  }, [searchParams]);

  const generateInstantPlan = async (queryText: string) => {
    setIsPlanning(true);
    setPlanningError(null);
    setLogs(["Initializing multi-agent orchestrator connection..."]);
    setPlanResult(null);

    const logStages = [
      "Initializing Travel Intelligence Agent Graph...",
      "Planner Agent analyzing queries, destinations, and languages...",
      "YouTube Search Agent scraping travel vlogs in real time...",
      "Transcript Agent downloading and cleansing subtitles...",
      "Knowledge Extraction Agent indexing culinary spots, stays, and safety alerts...",
      "Verification Agent cross-checking prices & confidence ratings...",
      "Itinerary Generator Agent compiling day-wise vlog plans...",
      "Language Personalization Agent formatting localized response package..."
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      if (currentStage < logStages.length) {
        setLogs(prev => [...prev, logStages[currentStage]]);
        currentStage++;
      } else {
        clearInterval(interval);
      }
    }, 1200);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Map budget category to target INR limits
      let budgetAmount = 45000.0;
      if (customBudget) {
        budgetAmount = parseFloat(customBudget);
      } else {
        if (budget === 'Budget') budgetAmount = 15000.0;
        else if (budget === 'Luxury') budgetAmount = 150000.0;
      }

      // Calculate exact trip days from selected dates
      let tripDays = 5;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        tripDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }

      const res = await fetch(`${API_URL}/api/v1/orchestrator/travel-intelligence`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: queryText,
          days: tripDays,
          budget: budgetAmount,
          source_city: sourceCity,
          user_id: user?.id || null,
          people: 1
        })
      });

      clearInterval(interval);

      if (res.ok) {
        const data = await res.json();
        setPlanResult(data.plan);
        setLogs(prev => [...prev, ...data.logs, "SUCCESS: Complete trip plan compiled successfully!"]);
      } else {
        const errData = await res.json();
        setPlanningError(errData.detail || "Multi-agent workflow failed to execute.");
        setLogs(prev => [...prev, "ERROR: Graph execution terminated prematurely."]);
      }
    } catch (err) {
      clearInterval(interval);
      setPlanningError("Connection to orchestrator backend failed. Check if server is running.");
      setLogs(prev => [...prev, "ERROR: Connection timeout."]);
    } finally {
      setIsPlanning(false);
    }
  };

  const vibesList = [
    'Culture & History',
    'Food & Dining',
    'Nature & Outdoors',
    'Relaxation',
    'Adventure',
    'Nightlife',
    'Shopping',
    'Art & Museums'
  ];

  const getDynamicDateRange = (type: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (type === 'Summer') {
      const summerStart = new Date(year, 5, 1); // June 1st
      if (now > new Date(year, 7, 31)) {
        summerStart.setFullYear(year + 1);
      }
      const summerEnd = new Date(summerStart);
      summerEnd.setDate(summerStart.getDate() + 6);
      return { start: formatDate(summerStart), end: formatDate(summerEnd) };
    } else if (type === 'Winter') {
      const winterStart = new Date(year, 11, 1); // December 1st
      if (now > new Date(year, 11, 31)) {
        winterStart.setFullYear(year + 1);
      }
      const winterEnd = new Date(winterStart);
      winterEnd.setDate(winterStart.getDate() + 6);
      return { start: formatDate(winterStart), end: formatDate(winterEnd) };
    } else if (type === 'Any Weekend') {
      const resultDate = new Date(now);
      const dayOfWeek = now.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
      resultDate.setDate(now.getDate() + daysUntilFriday);
      
      const fri = new Date(resultDate);
      const sun = new Date(resultDate);
      sun.setDate(fri.getDate() + 2);
      return { start: formatDate(fri), end: formatDate(sun) };
    } else {
      // Decide for me: 14 days from now, for 5 days
      const start = new Date(now);
      start.setDate(now.getDate() + 14);
      const end = new Date(start);
      end.setDate(start.getDate() + 5);
      return { start: formatDate(start), end: formatDate(end) };
    }
  };

  const toggleVibe = (vibe: string) => {
    if (selectedVibes.includes(vibe)) {
      setSelectedVibes(selectedVibes.filter(v => v !== vibe));
    } else {
      setSelectedVibes([...selectedVibes, vibe]);
    }
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else if (step === 3) {
      setStep(4);
      setIsInstantPlan(true);
      
      // Compile a rich natural query based on wizard selections to feed to the orchestrator
      const vibesStr = selectedVibes.length > 0 ? ` focusing on ${selectedVibes.join(', ')}` : '';
      const dateStr = startDate && endDate ? ` from ${startDate} to ${endDate}` : ' for 5 days';
      const queryText = `Plan a ${budget.toLowerCase()} budget trip to ${destination}${dateStr}${vibesStr}.`;
      
      setOriginalQueryText(queryText);
      // Trigger the actual multi-agent planning orchestrator
      generateInstantPlan(queryText);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const getProgressWidth = () => {
    return `${(step - 1) * 33.33}%`;
  };

  // If we are in instant planning mode, we show the loading or the results
  if (isInstantPlan) {
    return (
      <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col antialiased">
        <header className="w-full bg-surface/85 backdrop-blur-xl border-b border-surface-variant sticky top-0 z-50 py-4">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex justify-between items-center">
            <Link href="/" className="font-headline-md text-headline-md font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>flight_takeoff</span>
              TravelBuddy
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <LanguageSelector />
              <button 
                onClick={() => router.push('/')} 
                className="text-on-surface-variant hover:text-primary transition-colors text-body-sm font-body-sm"
              >
                Back to Home
              </button>
            </div>
          </div>
        </header>

        <main className="flex-grow flex flex-col items-center justify-start p-margin-mobile md:p-margin-desktop w-full max-w-container-max mx-auto relative overflow-hidden mt-6">
          {isPlanning && (
            <div className="w-full max-w-2xl bg-surface rounded-xl shadow-sm p-8 md:p-12 text-center flex flex-col items-center justify-center min-h-[450px] border border-surface-container mt-12 animate-fade-in">
              <div className="w-32 h-32 mb-8 relative flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-surface-container border-t-primary rounded-full animate-spin"></div>
                <span className="material-symbols-outlined text-primary text-5xl animate-pulse">auto_awesome</span>
              </div>
              <h2 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-4">Crafting Your Journey...</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-6">Our multi-agent system is coordinating flight routes, hotel options, weather trends, and attractions.</p>
              
              <div className="mt-4 flex flex-col gap-2.5 w-full max-w-md bg-surface-container-low p-6 rounded-2xl border border-surface-variant/50 text-left h-48 overflow-y-auto hide-scrollbar animate-fade-in">
                {logs.map((log, index) => {
                  if (!log) return null;
                  const logStr = String(log);
                  const isSuccess = logStr.startsWith("SUCCESS:");
                  const isError = logStr.startsWith("ERROR:");
                  return (
                    <div key={index} className="flex items-start gap-2.5 text-on-surface-variant font-body-sm text-body-sm animate-fade-in">
                      {isSuccess ? (
                        <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                      ) : isError ? (
                        <span className="material-symbols-outlined text-error text-[18px]">error</span>
                      ) : (
                        <span className="material-symbols-outlined animate-spin text-primary text-[18px]">hourglass_empty</span>
                      )}
                      <span className={`font-medium ${isSuccess ? 'text-emerald-700 font-bold' : isError ? 'text-error font-bold' : 'text-on-surface-variant'}`}>
                        {logStr}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {planningError && (
            <div className="w-full max-w-2xl bg-surface rounded-xl shadow-sm p-8 md:p-12 text-center border border-error-container mt-12">
              <span className="material-symbols-outlined text-error text-5xl mb-4">error</span>
              <h2 className="font-display-lg text-on-surface mb-2">Planning Failed</h2>
              <p className="text-on-surface-variant mb-6">{planningError}</p>
              <button 
                onClick={() => generateInstantPlan(destination)}
                className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
            </div>
          )}

          {planResult && (
            <div className="w-full max-w-container-max mt-4 animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="font-display-lg text-on-surface mb-1">Your Custom Itinerary</h1>
                  <p className="text-on-surface-variant font-body-md text-body-md">Generated instantly by TravelBuddy multi-agent planning network.</p>
                </div>
                <button 
                  onClick={() => {
                    setIsInstantPlan(false);
                    setDestination('');
                    router.push('/plan');
                  }}
                  className="px-5 py-2.5 border border-outline rounded-full hover:bg-surface-container font-label-md text-label-md text-on-surface-variant flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span> Plan Another
                </button>
              </div>
              
              {!user && (
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h5 className="font-bold text-[#001a41] text-[15px] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[18px]">info</span> Want to save this trip?
                    </h5>
                    <p className="text-[#414755] text-[13px] mt-0.5">Sign in to sync this generated itinerary and export it anytime.</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => router.push(`/login?redirect=${encodeURIComponent(`/plan?prompt=${encodeURIComponent(destination)}`)}`)}
                      className="bg-primary text-on-primary px-4 py-2 rounded-xl text-[12px] font-bold hover:bg-opacity-95 transition-all"
                    >
                      Log In
                    </button>
                    <button 
                      onClick={() => router.push(`/register?redirect=${encodeURIComponent(`/plan?prompt=${encodeURIComponent(destination)}`)}`)}
                      className="bg-surface border border-outline text-on-surface-variant px-4 py-2 rounded-xl text-[12px] font-bold hover:bg-surface-container transition-all"
                    >
                      Register
                    </button>
                  </div>
                </div>
              )}

              <AIWorkspace 
                user_id={user?.id || 0} 
                planResult={planResult} 
                planningError={null}
                sourceCity={sourceCity}
                originalQuery={originalQueryText}
                onRegenerate={() => generateInstantPlan(originalQueryText)}
              />
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col antialiased">
      {/* Header (Simplified for Onboarding Flow) */}
      <header className="w-full bg-surface/85 backdrop-blur-xl border-b border-surface-variant sticky top-0 z-50 py-4">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex justify-between items-center">
          <Link href="/" className="font-headline-md text-headline-md font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>flight_takeoff</span>
            TravelBuddy
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LanguageSelector />
            <button 
              onClick={() => router.push('/')} 
              className="text-on-surface-variant hover:text-primary transition-colors text-body-sm font-body-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow flex flex-col items-center justify-center p-margin-mobile md:p-margin-desktop w-full max-w-container-max mx-auto relative overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90 dark:to-background/95 z-10"></div>
          <div className="absolute inset-0 bg-black/10 dark:bg-black/35 z-10"></div>
          <img 
            className="w-full h-full object-cover opacity-15 dark:opacity-10 transition-opacity duration-700 blur-[2px]" 
            alt="Daily landscape" 
            src={bgImage}
          />
        </div>

        {/* Progress Indicator */}
        <div className="w-full max-w-2xl mb-12 flex justify-between items-center relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-surface-container -z-10 rounded-full transform -translate-y-1/2"></div>
          <div 
            className="absolute top-1/2 left-0 h-1 bg-primary -z-10 rounded-full transform -translate-y-1/2 transition-all duration-500 ease-out" 
            style={{ width: getProgressWidth() }}
          ></div>
          
          <div className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md transition-colors duration-300 ${step >= 1 ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-variant text-on-surface-variant'}`}>1</div>
            <span className={`font-label-md text-label-md ${step >= 1 ? 'text-primary' : 'text-on-surface-variant'}`}>Destination</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md transition-colors duration-300 ${step >= 2 ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-variant text-on-surface-variant'}`}>2</div>
            <span className={`font-label-md text-label-md ${step >= 2 ? 'text-primary' : 'text-on-surface-variant'}`}>Dates</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md transition-colors duration-300 ${step >= 3 ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-variant text-on-surface-variant'}`}>3</div>
            <span className={`font-label-md text-label-md ${step >= 3 ? 'text-primary' : 'text-on-surface-variant'}`}>Vibe</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md transition-colors duration-300 ${step >= 4 ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-variant text-on-surface-variant'}`}>4</div>
            <span className={`font-label-md text-label-md ${step >= 4 ? 'text-primary' : 'text-on-surface-variant'}`}>Magic</span>
          </div>
        </div>

        <div className="w-full max-w-2xl relative min-h-[400px]">
          {/* Step 1: Destination */}
          {step === 1 && (
            <div className="w-full bg-surface rounded-xl shadow-sm p-8 md:p-12 border border-surface-container">
              <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-4">Plan Your Trip</h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 font-normal">Enter your starting city and dream destination below.</p>
              
              {/* Source City — on top */}
              <label className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">From (Starting City)</label>
              <div className="relative w-full mb-2">
                <span className="material-symbols-outlined absolute left-4 top-1/2 transform -translate-y-1/2 text-outline">location_on</span>
                <input 
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-surface-container border-none focus:ring-2 focus:ring-primary focus:bg-surface transition-colors font-body-md text-body-md text-on-surface placeholder-outline-variant shadow-sm outline-none" 
                  placeholder="e.g. Delhi, Mumbai, Kolkata" 
                  type="text"
                  value={sourceCity}
                  onChange={(e) => setSourceCity(e.target.value)}
                />
              </div>

              {/* Arrow connector */}
              <div className="flex justify-center my-2">
                <span className="material-symbols-outlined text-primary text-[28px]">arrow_downward</span>
              </div>

              {/* Destination — below source */}
              <label className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 block">To (Destination)</label>
              <div className="relative w-full mb-8">
                <span className="material-symbols-outlined absolute left-4 top-1/2 transform -translate-y-1/2 text-outline">flight_takeoff</span>
                <input 
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-surface-container border-none focus:ring-2 focus:ring-primary focus:bg-surface transition-colors font-body-md text-body-md text-on-surface placeholder-outline-variant shadow-sm outline-none" 
                  placeholder="Where to? e.g. Goa, Jaipur, Kyoto" 
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {["Tokyo", "Paris", "Bali", "New York"].map((city) => (
                  <button 
                    key={city}
                    onClick={() => setDestination(city)}
                    className={`py-2 px-4 rounded-full font-label-md text-label-md border transition-colors ${destination === city ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-surface-variant'}`}
                  >
                    {city}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-end">
                <button 
                  onClick={handleNext}
                  disabled={!destination.trim()}
                  className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3 px-8 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Dates */}
          {step === 2 && (
            <div className="w-full bg-surface rounded-xl shadow-sm p-8 md:p-12 border border-surface-container">
              <h2 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-4">When are you going?</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 font-normal">Select your travel dates, or choose a rough timeline.</p>
              
              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex-1 relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 transform -translate-y-1/2 text-outline">calendar_month</span>
                  <input 
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-surface-container border-none focus:ring-2 focus:ring-primary focus:bg-surface transition-colors font-body-md text-body-md text-on-surface placeholder-outline-variant shadow-sm outline-none" 
                    placeholder="Start Date" 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1 relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 transform -translate-y-1/2 text-outline">event</span>
                  <input 
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-surface-container border-none focus:ring-2 focus:ring-primary focus:bg-surface transition-colors font-body-md text-body-md text-on-surface placeholder-outline-variant shadow-sm outline-none" 
                    placeholder="End Date" 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px bg-surface-variant flex-grow"></div>
                <span className="font-label-md text-label-md text-outline">OR</span>
                <div className="h-px bg-surface-variant flex-grow"></div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { name: 'Summer', icon: 'wb_sunny' },
                  { name: 'Winter', icon: 'ac_unit' },
                  { name: 'Any Weekend', icon: 'event_upcoming' },
                  { name: 'Decide for me', icon: 'magic_button' }
                ].map((item) => (
                  <button 
                    key={item.name}
                    onClick={() => {
                      const range = getDynamicDateRange(item.name);
                      setStartDate(range.start);
                      setEndDate(range.end);
                    }}
                    className="py-3 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-label-md text-label-md border border-surface-variant transition-colors flex flex-col items-center gap-2"
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    {item.name}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-between">
                <button 
                  onClick={handleBack}
                  className="bg-surface-container hover:bg-surface-variant text-on-surface font-label-md text-label-md py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Back
                </button>
                <button 
                  onClick={handleNext}
                  className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3 px-8 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                  Next
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Vibe */}
          {step === 3 && (
            <div className="w-full bg-surface rounded-xl shadow-sm p-8 md:p-12 border border-surface-container">
              <h2 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-4">What's the vibe?</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 font-normal">Select interests to help our AI craft your perfect itinerary.</p>
              
              <div className="flex flex-wrap gap-3 mb-8">
                {vibesList.map((vibe) => {
                  const isActive = selectedVibes.includes(vibe);
                  return (
                    <button 
                      key={vibe}
                      onClick={() => toggleVibe(vibe)}
                      className={`py-2 px-4 rounded-full border font-label-md text-label-md transition-all ${isActive ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface-variant border-surface-variant hover:bg-surface-container'}`}
                    >
                      {vibe}
                    </button>
                  );
                })}
              </div>
              
              <div className="mb-8">
                <label className="font-headline-sm text-headline-sm text-on-surface block mb-4">Budget Level</label>
                <div className="flex gap-4">
                  {['Budget', 'Moderate', 'Luxury'].map((level) => (
                    <label key={level} className="flex-1 cursor-pointer">
                      <input 
                        type="radio" 
                        name="budget" 
                        checked={budget === level}
                        onChange={() => setBudget(level)}
                        className="peer sr-only"
                      />
                      <div className="py-3 px-4 rounded-xl bg-surface-container-low border border-surface-variant text-center font-label-md text-on-surface-variant peer-checked:bg-primary/10 peer-checked:border-primary peer-checked:text-primary transition-all">
                        {level}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-8 text-left">
                <label className="text-[12px] font-bold text-on-surface-variant block mb-2">Custom Budget Amount (Optional, ₹)</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 transform -translate-y-1/2 text-outline">payments</span>
                  <input
                    type="number"
                    value={customBudget}
                    onChange={(e) => setCustomBudget(e.target.value)}
                    placeholder="Enter custom budget e.g. 35000"
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-container border border-surface-variant/40 focus:ring-1 focus:ring-primary focus:bg-surface outline-none text-sm font-semibold"
                  />
                </div>
              </div>
              
              <div className="flex justify-between">
                <button 
                  onClick={handleBack}
                  className="bg-surface-container hover:bg-surface-variant text-on-surface font-label-md text-label-md py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Back
                </button>
                <button 
                  onClick={handleNext}
                  className="bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md py-3 px-8 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                  Next
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Generating Magic */}
          {step === 4 && (
            <div className="w-full bg-surface rounded-xl shadow-sm p-8 md:p-12 text-center flex flex-col items-center justify-center min-h-[400px] border border-surface-container">
              <div className="w-32 h-32 mb-8 relative flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-surface-container border-t-primary rounded-full animate-spin"></div>
                <span className="material-symbols-outlined text-primary text-5xl animate-pulse">auto_awesome</span>
              </div>
              <h2 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-4">Crafting Your Journey...</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-2">Our AI is analyzing flight patterns, hotel availability, and local secrets.</p>
              
              <div className="mt-8 flex flex-col gap-3 w-full max-w-sm">
                <div className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                  <span className="font-body-md text-body-md text-left">Filtering optimal dates</span>
                </div>
                <div className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                  <span className="font-body-md text-body-md text-left">Curating local experiences</span>
                </div>
                <div className="flex items-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-primary">hourglass_empty</span>
                  <span className="font-body-md text-body-md text-left">Finding boutique stays</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function PlanTripPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading planner...</div>}>
      <PlanTripContent />
    </Suspense>
  );
}
