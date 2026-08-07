'use client';

import React, { useState, useEffect } from 'react';
import PdfTemplate from '../PdfTemplate';
import { exportHtmlToPdf } from '../../lib/pdf';
import EmailPanel from './EmailPanel';
import ReplanPanel from './ReplanPanel';
import { getTravelPhoto } from '../../lib/unsplash';
import TravelIntelligenceConsole from './TravelIntelligenceConsole';
import TransportationSection from './TransportationSection';
import LocalLanguageHelper from './LocalLanguageHelper';
import DestinationDetailGuide from './DestinationDetailGuide';
import HotelsSection from './HotelsSection';
import FoodSection from './food/FoodSection';
import SafetyDashboard from './SafetyDashboard';
import BudgetDashboard from './budget/BudgetDashboard';
import WeatherDashboard from './weather/WeatherDashboard';
import GemsDashboard from './gems/GemsDashboard';
import TravelAssistant from './assistant/TravelAssistant';
import PremiumUXDashboard from './ux/PremiumUXDashboard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface TripPlanResultsProps {
  user_id: number;
  planResult: any;
  planningError: string | null;
  sourceCity?: string;
}

export default function TripPlanResults({ user_id, planResult, planningError, sourceCity: sourceCityProp }: TripPlanResultsProps) {
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedTripId, setSavedTripId] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string>('');
  const [activeSection, setActiveSection] = useState<'itinerary' | 'intelligence'>('itinerary');
  const [selectedAttraction, setSelectedAttraction] = useState<string | null>(null);
  const [showAttractionGuide, setShowAttractionGuide] = useState(false);

  const extractAttractionName = (text: string): string => {
    if (!text) return 'Gateway of India';
    const matchers = [
      'Gateway of India', 'Marine Drive', 'Colaba Causeway', 'Elephanta Caves', 
      'Chhatrapati Shivaji Maharaj Terminus', 'Haji Ali Dargah', 'Siddhivinayak Temple',
      'Juhu Beach', 'Bandra-Worli Sea Link', 'Kanheri Caves', 'Kyoto Kiyomizu-dera',
      'Kinkaku-ji', 'Fushimi Inari-taisha', 'Arashiyama Bamboo Grove', 'Gion District',
      'Gateway', 'Taj Mahal Palace', 'Elephanta', 'Museum', 'Beach', 'Causeway'
    ];
    for (const m of matchers) {
      if (text.toLowerCase().includes(m.toLowerCase())) {
        return m;
      }
    }
    const clean = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    const words = clean.split(' ');
    return words.slice(0, 3).join(' ') || 'Gateway of India';
  };

  const determineTravelerProfile = (plan: any): any => {
    if (!plan) return 'general';
    const text = (plan.trip_summary?.query || plan.trip_summary?.vibe || '').toLowerCase();
    const style = (plan.trip_summary?.style || '').toLowerCase();
    
    if (text.includes('pet') || text.includes('dog') || text.includes('cat')) return 'pet';
    if (text.includes('wheelchair') || text.includes('disabled') || text.includes('accessible')) return 'accessibility';
    if (text.includes('parent') || text.includes('senior') || text.includes('old') || text.includes('elder')) return 'senior';
    if (style.includes('family') || text.includes('kid') || text.includes('children') || text.includes('family')) return 'family';
    if (style.includes('couple') || style.includes('romantic') || text.includes('honeymoon') || text.includes('husband') || text.includes('wife')) return 'couple';
    if (style.includes('budget') || style.includes('backpack') || text.includes('hostel') || text.includes('solo')) return 'backpacker';
    if (style.includes('business') || text.includes('work') || text.includes('corporate') || text.includes('meeting')) return 'business';
    return 'general';
  };

  useEffect(() => {
    setCurrentPlan(planResult);
    setSavedTripId(null);
    setSaveSuccess(false);
    setSaveError(null);
    setActiveSection('itinerary');
    
    const dest = planResult?.destination || planResult?.trip_summary?.destination;
    if (dest) {
      getTravelPhoto(dest).then(url => setCoverPhoto(url));
    }
  }, [planResult]);

  const handleSaveTrip = async (): Promise<number | null> => {
    if (!currentPlan || !user_id) return null;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/v1/trips?user_id=${user_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          destination: currentPlan.destination || currentPlan.trip_summary?.destination,
          days: currentPlan.days || currentPlan.trip_summary?.days || 5,
          travelers: currentPlan.travelers || currentPlan.trip_summary?.travelers || 1,
          plan_data: currentPlan
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSavedTripId(data.id);
        setSaveSuccess(true);
        return data.id;
      } else {
        const errData = await res.json();
        setSaveError(errData.detail || "Failed to save trip to history.");
        return null;
      }
    } catch (err) {
      setSaveError("Connection error while saving trip.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePdfDownload = async () => {
    setIsPdfExporting(true);
    try {
      await exportHtmlToPdf('pdf-export-container', `trip-${currentPlan?.destination || currentPlan?.trip_summary?.destination || 'plan'}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPdfExporting(false);
    }
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
        <h4 className="text-[18px] font-bold text-on-surface mb-2">No active itinerary plan loaded</h4>
        <p className="text-on-surface-variant text-[14px] max-w-md">
          Input your desired destination, traveler configuration, and duration guidelines in the form to coordinate agent planning.
        </p>
      </div>
    );
  }

  const destinationName = currentPlan.destination || currentPlan.trip_summary?.destination || 'Your Destination';
  const executiveSummary = currentPlan.executive_summary || 
    (currentPlan.trip_summary 
      ? `This custom-curated ${currentPlan.trip_summary.days || currentPlan.days || 5}-day ${currentPlan.trip_summary.style || 'Adventure & Culture'} itinerary outlines an exceptional journey to ${destinationName} in ${currentPlan.trip_summary.preferred_language || 'English'}. Enriching your plan with vlog travel intelligence, safety alerts, and local secrets.` 
      : 'Your customized travel itinerary is ready.');

  const weatherScore = currentPlan.weather_analysis?.suitability_score || 95;
  const tempVal = currentPlan.weather_analysis?.temperature || '26°C';
  const rainProb = currentPlan.weather_analysis?.rain_probability || '15%';

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Cover Banner */}
      {coverPhoto && (
        <div className="w-full h-48 md:h-64 rounded-2xl overflow-hidden relative shadow-sm border border-surface-variant/30 animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent z-10"></div>
          <img src={coverPhoto} alt={destinationName} className="w-full h-full object-cover" />
          <div className="absolute bottom-6 left-6 z-20 text-left">
            <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-primary px-3 py-1 rounded-full">Destination</span>
            <h2 className="text-[28px] md:text-[36px] font-bold text-white mt-2 font-heading">{destinationName}</h2>
          </div>
        </div>
      )}

      {/* Executive summary block */}
      <div className="bg-primary/10 border border-primary/20 dark:bg-primary-container/20 dark:border-primary/35 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-grow text-left">
          <h4 className="text-[14px] font-bold text-primary dark:text-primary-fixed uppercase tracking-wider mb-2">Executive Summary</h4>
          <p className="text-[16px] text-on-surface font-medium leading-relaxed">
            {executiveSummary}
          </p>
        </div>
        <div className="w-full md:w-auto shrink-0 flex flex-col gap-2">
          {saveSuccess ? (
            <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 px-4 py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[18px]">check_circle</span> Saved
            </span>
          ) : (
            <button 
              onClick={handleSaveTrip}
              disabled={isSaving}
              className="w-full bg-primary text-on-primary px-5 py-2.5 rounded-xl text-[13px] font-bold hover:bg-opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">bookmark</span> {isSaving ? "Saving..." : "Save Trip"}
            </button>
          )}
          
          <button
            onClick={handlePdfDownload}
            disabled={isPdfExporting}
            className="w-full bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
            {isPdfExporting ? 'Generating PDF...' : 'Download PDF'}
          </button>
          
          {saveError && <div className="text-[11px] text-error mt-1 text-center">{saveError}</div>}
        </div>
      </div>

      {/* Advanced actions row: Email and Selective Replan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <EmailPanel tripId={savedTripId} onSaveFirst={handleSaveTrip} />
        <ReplanPanel 
          tripId={savedTripId} 
          onSaveFirst={handleSaveTrip} 
          onPlanUpdated={(newPlan) => {
            setCurrentPlan(newPlan);
          }} 
          disabled={!!currentPlan.sources} // Disable traditional selective replan for travel intelligence plans
        />
      </div>

      {/* Tab Switcher */}
      {currentPlan.sources && (
        <div className="flex gap-4 border-b border-surface-variant/30 pb-2">
          <button
            onClick={() => setActiveSection('itinerary')}
            className={`px-4 py-2 text-[14px] font-bold transition-all cursor-pointer border-b-2 ${activeSection === 'itinerary' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}
          >
            Day-Wise Itinerary
          </button>
          <button
            onClick={() => setActiveSection('intelligence')}
            className={`px-4 py-2 text-[14px] font-bold transition-all cursor-pointer border-b-2 flex items-center gap-1.5 ${activeSection === 'intelligence' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}
          >
            <span className="material-symbols-outlined text-[18px]">smart_toy</span>
            Vlog Travel Intelligence
          </button>
        </div>
      )}

      {activeSection === 'itinerary' ? (
        <>
          {/* Lodging & Transit Quick Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {/* Bookings / Vlog Budget summary */}
            <div className="bg-surface-container-lowest border border-surface-variant/30 rounded-2xl p-6 shadow-sm space-y-4">
              <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider">Lodging & Transit Summary</h4>
              
              {currentPlan.hotel_recommendation ? (
                <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-xl border border-surface-variant/20">
                  <div>
                    <div className="text-[14px] font-bold text-on-surface">{currentPlan.hotel_recommendation.hotel}</div>
                    <div className="text-[12px] text-on-surface-variant">Rating: ★ {currentPlan.hotel_recommendation.rating}</div>
                  </div>
                  <div className="text-[14px] font-bold text-primary">₹{currentPlan.hotel_recommendation.price}/nt</div>
                </div>
              ) : currentPlan.estimated_budget?.local_prices_index?.hotel_avg ? (
                <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-xl border border-surface-variant/20">
                  <div>
                    <div className="text-[14px] font-bold text-on-surface">Average Hotel Stay</div>
                    <div className="text-[12px] text-on-surface-variant">Vlog Price Index</div>
                  </div>
                  <div className="text-[14px] font-bold text-primary">{currentPlan.estimated_budget.local_prices_index.hotel_avg}</div>
                </div>
              ) : null}

              {currentPlan.transport_recommendation ? (
                <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-xl border border-surface-variant/20">
                  <div>
                    <div className="text-[14px] font-bold text-on-surface">{currentPlan.transport_recommendation.mode} Transit</div>
                    <div className="text-[12px] text-on-surface-variant">Duration: {currentPlan.transport_recommendation.duration}</div>
                  </div>
                  <div className="text-[14px] font-bold text-primary">₹{currentPlan.transport_recommendation.cost}</div>
                </div>
              ) : currentPlan.estimated_budget?.local_prices_index?.rickshaw_day ? (
                <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-xl border border-surface-variant/20">
                  <div>
                    <div className="text-[14px] font-bold text-on-surface">Daily Rickshaw Fare</div>
                    <div className="text-[12px] text-on-surface-variant">Vlog Price Index</div>
                  </div>
                  <div className="text-[14px] font-bold text-primary">{currentPlan.estimated_budget.local_prices_index.rickshaw_day}</div>
                </div>
              ) : null}
            </div>

            {/* Trip Overview Card */}
            <div className="bg-surface-container-lowest border border-surface-variant/30 rounded-2xl p-6 shadow-sm space-y-3">
              <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider">Trip Overview</h4>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">place</span>
                <div>
                  <div className="text-[12px] text-on-surface-variant">Route</div>
                  <div className="text-[14px] font-bold text-on-surface">
                    {sourceCityProp || currentPlan.trip_summary?.source_city || 'Delhi'} → {destinationName}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">calendar_month</span>
                <div>
                  <div className="text-[12px] text-on-surface-variant">Duration</div>
                  <div className="text-[14px] font-bold text-on-surface">{currentPlan.trip_summary?.days || currentPlan.days || 5} Days</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">wb_sunny</span>
                <div>
                  <div className="text-[12px] text-on-surface-variant">Weather Score</div>
                  <div className="text-[14px] font-bold text-on-surface">{weatherScore}% Suitability · {tempVal}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">umbrella</span>
                <div>
                  <div className="text-[12px] text-on-surface-variant">Rain Probability</div>
                  <div className="text-[14px] font-bold text-on-surface">{rainProb}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Redesigned Transportation Module */}
          <TransportationSection 
            sourceCity={sourceCityProp || currentPlan.trip_summary?.source_city || 'Delhi'}
            destination={destinationName}
            budgetTier={currentPlan.trip_summary?.budget <= 20000 || currentPlan.budget_summary?.total < 25000 ? 'budget' : currentPlan.trip_summary?.budget >= 100000 ? 'luxury' : 'moderate'}
          />

          {/* Dynamic Weather Intelligence & Advisory Hub */}
          <WeatherDashboard 
            destination={destinationName}
            rainProbability={parseInt(rainProb) || 15}
            tempCelsius={tempVal || '28°C'}
          />

          {/* Dynamic Multi-Language Local Helper Module */}
          <LocalLanguageHelper destination={destinationName} />

          {/* Dynamic Redesigned Hotels & Accommodation Hub */}
          <HotelsSection 
            destination={destinationName}
            budgetTier={currentPlan.trip_summary?.style?.toLowerCase().includes('budget') || currentPlan.budget_summary?.total < 25000 ? 'budget' : 'moderate'}
            travelerProfile={determineTravelerProfile(currentPlan)}
          />

          {/* Dynamic Redesigned Food & Restaurant Hub */}
          <FoodSection destination={destinationName} />

          {/* Dynamic Redesigned Budget & Expense Intelligence Hub */}
          <BudgetDashboard 
            budgetSummary={currentPlan.budget_summary}
            destination={destinationName}
            peopleCount={currentPlan.trip_summary?.people || currentPlan.travelers || 1}
            daysCount={currentPlan.trip_summary?.days || currentPlan.days || 5}
          />

          {/* Dynamic Safety & Emergency Advisor Hub */}
          <SafetyDashboard 
            destination={destinationName}
            travelerProfile={determineTravelerProfile(currentPlan)}
          />

          {/* Dynamic Hidden Gems & Local Experiences Hub */}
          <GemsDashboard destination={destinationName} />

          {/* Premium UX, Personalization & Offline Kit Hub */}
          <PremiumUXDashboard destination={destinationName} />

          {/* Day-wise itinerary display */}
          <div className="bg-surface-container-lowest border border-surface-variant/30 rounded-2xl p-6 shadow-sm text-left">
            <h4 className="text-[14px] font-bold text-on-surface-variant uppercase tracking-wider mb-6 font-heading">Day-Wise Itinerary Plan</h4>
            <div className="space-y-6">
              {(currentPlan.day_wise_itinerary?.itinerary || currentPlan.daily_itinerary || []).map((day: any, i: number) => (
                <div key={i} className="relative pl-8 border-l border-surface-variant/30 last:border-l-0">
                  <div className="absolute left-[-13px] top-0 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-[11px]">
                    {day.day}
                  </div>
                  <div className="mb-4">
                    <h5 className="text-[15px] font-bold text-on-surface">{day.title || `Day ${day.day} Schedule`}</h5>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-surface-container-low p-3 rounded-xl border border-surface-variant/20 flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1">Morning</div>
                        <p className="text-[13px] leading-relaxed text-on-surface-variant">{day.morning}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedAttraction(extractAttractionName(day.morning));
                          setShowAttractionGuide(true);
                        }}
                        className="mt-3 text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer border-none bg-transparent self-start"
                      >
                        <span className="material-symbols-outlined text-[15px]">explore</span>
                        Explore {extractAttractionName(day.morning)}
                      </button>
                    </div>

                    <div className="bg-surface-container-low p-3 rounded-xl border border-surface-variant/20 flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1">Afternoon</div>
                        <p className="text-[13px] leading-relaxed text-on-surface-variant">{day.afternoon}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedAttraction(extractAttractionName(day.afternoon));
                          setShowAttractionGuide(true);
                        }}
                        className="mt-3 text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer border-none bg-transparent self-start"
                      >
                        <span className="material-symbols-outlined text-[15px]">explore</span>
                        Explore {extractAttractionName(day.afternoon)}
                      </button>
                    </div>

                    <div className="bg-surface-container-low p-3 rounded-xl border border-surface-variant/20 flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1 font-heading">Evening & Vlog Insight</div>
                        <p className="text-[13px] leading-relaxed text-on-surface-variant">{day.evening}</p>
                        {day.why_selected_rationale && (
                          <div className="mt-2 pt-2 border-t border-surface-variant/20 flex items-start gap-1">
                            <span className="material-symbols-outlined text-[14px] text-primary mt-0.5">smart_toy</span>
                            <span className="text-[10px] text-primary font-bold leading-normal italic">{day.why_selected_rationale}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedAttraction(extractAttractionName(day.evening));
                          setShowAttractionGuide(true);
                        }}
                        className="mt-3 text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer border-none bg-transparent self-start"
                      >
                        <span className="material-symbols-outlined text-[15px]">explore</span>
                        Explore {extractAttractionName(day.evening)}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <TravelIntelligenceConsole plan={currentPlan} />
      )}

      {showAttractionGuide && selectedAttraction && (
        <DestinationDetailGuide
          attractionName={selectedAttraction}
          destinationName={destinationName}
          onClose={() => {
            setShowAttractionGuide(false);
            setSelectedAttraction(null);
          }}
        />
      )}

      {/* PDF Export Markup Template for rendering/exporting */}
      <PdfTemplate 
        planResult={currentPlan}
        destination={currentPlan.destination}
        days={currentPlan.days}
        travelers={currentPlan.travelers}
      />

      {/* Floating AI Local Travel Assistant & Companion */}
      <TravelAssistant />
    </div>
  );
}
