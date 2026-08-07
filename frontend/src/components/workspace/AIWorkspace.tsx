'use client';

import React, { useState, useEffect } from 'react';
import PdfTemplate from '../PdfTemplate';
import { exportHtmlToPdf } from '../../lib/pdf';
import EmailPanel from '../dashboard/EmailPanel';
import ReplanPanel from '../dashboard/ReplanPanel';
import { getTravelPhoto } from '../../lib/unsplash';

// Workspace specific components
import QuerySummaryBar from './QuerySummaryBar';
import AIReasoningPanel from './AIReasoningPanel';
import DynamicHero from './DynamicHero';
import ConversationTimeline from './ConversationTimeline';
import WorkspaceSidebar from './WorkspaceSidebar';
import SmartNotifications from './SmartNotifications';
import DailyTimeline from './DailyTimeline';
import AICard from './AICard';

// Existing dashboard sections
import TransportationSection from '../dashboard/TransportationSection';
import LocalLanguageHelper from '../dashboard/LocalLanguageHelper';
import HotelsSection from '../dashboard/HotelsSection';
import FoodSection from '../dashboard/food/FoodSection';
import SafetyDashboard from '../dashboard/SafetyDashboard';
import BudgetDashboard from '../dashboard/budget/BudgetDashboard';
import WeatherDashboard from '../dashboard/weather/WeatherDashboard';
import GemsDashboard from '../dashboard/gems/GemsDashboard';
import PremiumUXDashboard from '../dashboard/ux/PremiumUXDashboard';
import TravelIntelligenceConsole from '../dashboard/TravelIntelligenceConsole';

// Real LLM Assistant
import TravelAssistant from '../dashboard/assistant/TravelAssistant';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface VersionSnapshot {
  id: string;
  timestamp: string;
  query: string;
  plan: any;
}

interface AIWorkspaceProps {
  user_id: number;
  planResult: any;
  planningError: string | null;
  sourceCity?: string;
  onRegenerate?: () => void;
  originalQuery?: string;
}

export default function AIWorkspace({
  user_id,
  planResult,
  planningError,
  sourceCity: sourceCityProp,
  onRegenerate,
  originalQuery = 'Plan a custom trip'
}: AIWorkspaceProps) {
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('itinerary');
  const [coverPhoto, setCoverPhoto] = useState<string>('');
  const [isPdfExporting, setIsPdfExporting] = useState(false);

  // Version tracking for conversation memory
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);

  useEffect(() => {
    if (planResult) {
      setCurrentPlan(planResult);
      
      // Add version snapshot if not already present
      const versionId = `ver-${Date.now()}`;
      const snap: VersionSnapshot = {
        id: versionId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        query: planResult.trip_summary?.query || originalQuery,
        plan: planResult
      };

      setVersions(prev => {
        // Prevent duplicates
        if (prev.some(v => JSON.stringify(v.plan) === JSON.stringify(planResult))) {
          return prev;
        }
        return [snap, ...prev];
      });

      const dest = planResult.destination || planResult.trip_summary?.destination;
      if (dest) {
        getTravelPhoto(dest).then(url => setCoverPhoto(url));
      }
    }
  }, [planResult, originalQuery]);

  const handleRestoreVersion = (oldPlan: any) => {
    setCurrentPlan(oldPlan);
  };

  if (planningError) {
    return (
      <div className="bg-[#ffdad6] border border-[#ba1a1a] text-[#93000a] p-4 rounded-xl text-[14px]">
        {planningError}
      </div>
    );
  }

  if (!currentPlan) {
    return (
      <div className="bg-surface border border-surface-variant/30 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined text-[48px] text-outline mb-4">map</span>
        <h4 className="text-[18px] font-bold text-on-surface mb-2">No active workspace loaded</h4>
      </div>
    );
  }

  const destinationName = currentPlan.destination || currentPlan.trip_summary?.destination || 'Your Destination';
  const weatherScore = currentPlan.weather_analysis?.suitability_score || 95;
  const tempVal = currentPlan.weather_analysis?.temperature || '26°C';
  const rainProb = currentPlan.weather_analysis?.rain_probability || '15%';

  const determineTravelerProfile = (plan: any): any => {
    if (!plan) return 'general';
    const text = (plan.trip_summary?.query || plan.trip_summary?.vibe || '').toLowerCase();
    const style = (plan.trip_summary?.style || '').toLowerCase();
    if (text.includes('pet')) return 'pet';
    if (text.includes('wheelchair')) return 'accessibility';
    if (text.includes('senior') || text.includes('parent')) return 'senior';
    if (style.includes('family') || text.includes('kid')) return 'family';
    return 'general';
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in pb-16">
      
      {/* 1. What You Asked (Original Query summary bar) */}
      <QuerySummaryBar 
        originalQuery={originalQuery} 
        tripSummary={currentPlan.trip_summary}
        onRegenerate={onRegenerate}
      />

      {/* 2. AI Reasoning */}
      <AIReasoningPanel 
        destination={destinationName} 
        reasons={currentPlan.ai_reasoning}
      />

      {/* 3. Dynamic Hero Banner */}
      <DynamicHero 
        destination={destinationName}
        coverPhoto={coverPhoto}
        duration={currentPlan.trip_summary?.days || currentPlan.days || 5}
        budget={`₹${currentPlan.estimated_budget?.total_estimated_cost || 'N/A'}`}
        weatherTemp={tempVal}
        preferredLanguage={currentPlan.trip_summary?.preferred_language || 'English'}
      />

      {/* Smart Alerts & Notification center */}
      <SmartNotifications 
        weatherScore={weatherScore}
        rainProbability={parseInt(rainProb) || 15}
        totalBudget={parseFloat(currentPlan.estimated_budget?.total_estimated_cost?.replace(/,/g, '')) || 50000}
      />

      {/* 4. AI Version trail / Conversation memory timeline */}
      <ConversationTimeline 
        versions={versions} 
        onRestoreVersion={handleRestoreVersion}
      />

      {/* 5. Main Workspace Grid Layout */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* Workspace Sidebar Nav */}
        <WorkspaceSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          hasIntelligence={!!currentPlan.sources}
        />

        {/* Dynamic Workspace Content Slot */}
        <div className="flex-grow w-full space-y-6">
          {activeTab === 'itinerary' && (
            <DailyTimeline itinerary={currentPlan.day_wise_itinerary?.itinerary || currentPlan.daily_itinerary || []} />
          )}

          {activeTab === 'hotels' && (
            <AICard title="Lodging & Accommodations" icon="hotel">
              <HotelsSection 
                destination={destinationName}
                budgetTier={currentPlan.trip_summary?.style?.toLowerCase().includes('budget') ? 'budget' : 'moderate'}
                travelerProfile={determineTravelerProfile(currentPlan)}
              />
            </AICard>
          )}

          {activeTab === 'transit' && (
            <AICard title="Transportation & Commutes" icon="commute">
              <TransportationSection 
                sourceCity={sourceCityProp || currentPlan.trip_summary?.source_city || 'Delhi'}
                destination={destinationName}
              />
            </AICard>
          )}

          {activeTab === 'food' && (
            <AICard title="Food & Culinary Highlights" icon="restaurant">
              <FoodSection destination={destinationName} />
            </AICard>
          )}

          {activeTab === 'budget' && (
            <AICard title="Budget Index & Cost Breakdown" icon="payments">
              <BudgetDashboard 
                budgetSummary={currentPlan.budget_summary}
                destination={destinationName}
                peopleCount={currentPlan.trip_summary?.people || 1}
                daysCount={currentPlan.trip_summary?.days || 5}
              />
            </AICard>
          )}

          {activeTab === 'safety' && (
            <AICard title="Safety & Local Rules" icon="shield">
              <SafetyDashboard 
                destination={destinationName}
                travelerProfile={determineTravelerProfile(currentPlan)}
              />
            </AICard>
          )}

          {activeTab === 'gems' && (
            <AICard title="Hidden Gems & Local Insights" icon="explore">
              <GemsDashboard destination={destinationName} />
            </AICard>
          )}

          {activeTab === 'intelligence' && (
            <AICard title="Vlog Intelligence Console" icon="smart_toy">
              <TravelIntelligenceConsole plan={currentPlan} />
            </AICard>
          )}
        </div>

      </div>

      {/* Floating real-LLM Travel Companion Assistant */}
      <TravelAssistant planContext={currentPlan} />

    </div>
  );
}
