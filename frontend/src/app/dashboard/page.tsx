'use client';

import React, { useState, useEffect, Suspense } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import TripPlannerForm from '@/components/dashboard/TripPlannerForm';
import VoicePlanner from '@/components/dashboard/VoicePlanner';
import TripPlanResults from '@/components/dashboard/TripPlanResults';
import MemoryManager from '@/components/dashboard/MemoryManager';
import TripHistory from '@/components/dashboard/TripHistory';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function DashboardContent() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('plan'); // 'plan' | 'history' | 'preferences'
  const [query, setQuery] = useState('');
  const [sourceCity, setSourceCity] = useState('Mumbai');
  const [days, setDays] = useState(5);
  const [travelers, setTravelers] = useState(1);
  
  const [planResult, setPlanResult] = useState<any>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsPlanning(true);
    setPlanningError(null);
    setPlanResult(null);
    setLogs(["Initializing multi-agent planning orchestrator graph...", "Connecting to user long-term memory systems..."]);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/v1/orchestrator/travel-intelligence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query,
          source_city: sourceCity,
          user_id: user?.id,
          days,
          people: travelers
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Multi-agent graph planning failed.");
      }

      // Stream logs or parse response
      const data = await res.json();
      setPlanResult(data.plan);
      setLogs(data.logs || ["Planning completed successfully!"]);
    } catch (err: any) {
      setPlanningError(err.message || "Connection timeout to agent cluster.");
      setLogs(prev => [...prev, `ERROR: ${err.message || "Planning process aborted."}`]);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleSaveTripExternal = async () => {
    if (!planResult || !user?.id) return null;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/v1/trips?user_id=${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          destination: planResult.destination,
          days: planResult.days,
          travelers: planResult.travelers,
          plan_data: planResult
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.id ? 1 : 1; // Return a truthy number for the voice planner
      }
      return null;
    } catch (err) {
      console.error("External save fail:", err);
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="border-b border-surface-variant/30 bg-surface/85 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-[20px] md:px-[64px] h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-bold text-[22px] text-primary tracking-tight font-heading flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>flight_takeoff</span>
              TravelBuddy
            </span>
          </div>

          <div className="flex items-center space-x-6">
            <button 
              onClick={() => setActiveTab('plan')}
              className={`text-[15px] font-semibold transition-colors cursor-pointer ${activeTab === 'plan' ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
            >
              Console Planner
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`text-[15px] font-semibold transition-colors cursor-pointer ${activeTab === 'history' ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
            >
              My Trips
            </button>
            <button 
              onClick={() => setActiveTab('preferences')}
              className={`text-[15px] font-semibold transition-colors cursor-pointer ${activeTab === 'preferences' ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
            >
              My Memories
            </button>
            
            <div className="h-4 w-[1px] bg-surface-variant/30"></div>
            
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <LanguageSelector />
              <span className="text-[14px] font-medium text-on-surface-variant hidden sm:inline">{user?.name}</span>
              <button 
                onClick={logout}
                className="px-4 py-1.5 rounded-full border border-surface-variant/30 hover:bg-surface-container-low text-on-surface-variant text-[12px] font-semibold transition-all active:scale-95 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1280px] mx-auto px-[20px] md:px-[64px] py-10 flex-grow w-full relative z-10">
        {activeTab === 'plan' && user && (
          <div className="grid lg:grid-cols-3 gap-8">
            <TripPlannerForm 
              query={query}
              setQuery={setQuery}
              sourceCity={sourceCity}
              setSourceCity={setSourceCity}
              days={days}
              setDays={setDays}
              travelers={travelers}
              setTravelers={setTravelers}
              isPlanning={isPlanning}
              logs={logs}
              onSubmit={handleCreatePlan}
            />
            <div className="lg:col-span-2 space-y-6">
              <VoicePlanner
                user_id={user.id}
                onPlanResult={(plan) => setPlanResult(plan)}
                onPlanningError={(err) => setPlanningError(err)}
                onLoadingStatus={(loading) => setIsPlanning(loading)}
                onSaveTripTrigger={handleSaveTripExternal}
              />
              <TripPlanResults 
                user_id={user.id}
                planResult={planResult}
                planningError={planningError}
              />
            </div>
          </div>
        )}

        {activeTab === 'preferences' && user && (
          <MemoryManager user_id={user.id} />
        )}

        {activeTab === 'history' && user && (
          <TripHistory 
            user_id={user.id} 
            onLoadPlanResult={(plan) => setPlanResult(plan)}
            onSwitchTab={(tab) => setActiveTab(tab)}
          />
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-[16px] font-semibold text-primary">
          Loading Dashboard Planner Console...
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </ProtectedRoute>
  );
}
