import React from 'react';

interface PdfTemplateProps {
  planResult: any;
  destination: string;
  days: number;
  travelers: number;
}

export default function PdfTemplate({ planResult, destination, days, travelers }: PdfTemplateProps) {
  if (!planResult) return null;

  // Resolve properties dynamically to support both Traditional and Travel Intelligence schemas
  const destName = destination || planResult.destination || planResult.trip_summary?.destination || 'Your Destination';
  
  const execSummary = planResult.executive_summary || 
    (planResult.trip_summary 
      ? `This custom-curated ${planResult.trip_summary.days || planResult.days || days || 5}-day ${planResult.trip_summary.style || 'Adventure & Culture'} itinerary outlines an exceptional journey to ${destName} in ${planResult.trip_summary.preferred_language || 'English'}. Enriching your plan with vlog travel intelligence, safety alerts, and local secrets.` 
      : 'Your customized travel itinerary.');

  const weather = planResult.weather_analysis || {
    suitability_score: 95,
    temperature: '26°C',
    rain_probability: '15%',
    warnings: []
  };

  const hotel = planResult.hotel_recommendation || 
    (planResult.estimated_budget?.local_prices_index?.hotel_avg 
      ? { hotel: 'Average Lodging (Vlog Index)', price: planResult.estimated_budget.local_prices_index.hotel_avg, rating: '4.5' }
      : null);

  const transport = planResult.transport_recommendation || 
    (planResult.estimated_budget?.local_prices_index?.rickshaw_day 
      ? { mode: 'Local Transit', cost: planResult.estimated_budget.local_prices_index.rickshaw_day, duration: 'Daily' }
      : null);

  const rawItinerary = planResult.day_wise_itinerary?.itinerary || planResult.daily_itinerary || [];
  
  // Format budget keys safely
  const budget = planResult.budget_summary || {
    accommodation_cost: planResult.estimated_budget?.accommodation_cost || '₹4,000',
    travel_cost: planResult.estimated_budget?.local_prices_index?.rickshaw_day || '₹600',
    food_cost: '₹1,500',
    activities_cost: planResult.estimated_budget?.emergency_buffer || '₹2,500',
    total: planResult.estimated_budget?.accommodation_cost 
      ? `${parseInt(String(planResult.estimated_budget.accommodation_cost).replace(/[^0-9]/g, '')) + 5000}`
      : '12,000'
  };

  const packing_list = planResult.packing_list || [];

  // Format date
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Dynamic Emergency Contacts based on destination
  const getEmergencyContacts = (dest: string) => {
    const defaultContacts = {
      police: '112 / 911',
      medical: '112 / 911',
      touristPolice: '112',
      embassyInfo: 'Contact nearest National Embassy',
      notes: 'Ensure your travel insurance is active and keep your physical passport secure.',
    };

    const destLower = dest.toLowerCase();
    if (destLower.includes('tokyo') || destLower.includes('japan')) {
      return {
        police: '110',
        medical: '119',
        touristPolice: '03-3501-0110 (Japan Helpline)',
        embassyInfo: 'US Embassy Tokyo: +81 3-3224-5000',
        notes: 'Keep cash handy as many local restaurants and temples in Japan do not accept cards.',
      };
    } else if (destLower.includes('london') || destLower.includes('uk') || destLower.includes('united kingdom')) {
      return {
        police: '999',
        medical: '999 or 111 (Non-emergency)',
        touristPolice: '101 (Non-emergency)',
        embassyInfo: 'US Embassy London: +44 (0)20 7499-9000',
        notes: 'UK emergency services can be reached via 999 or 112 from any mobile phone.',
      };
    } else if (destLower.includes('paris') || destLower.includes('france')) {
      return {
        police: '17 (or 112)',
        medical: '15 (or 112)',
        touristPolice: '112',
        embassyInfo: 'US Embassy Paris: +33 1 43 12 22 22',
        notes: 'Carry a piece of identification with you at all times as required by French law.',
      };
    } else if (destLower.includes('goa') || destLower.includes('mumbai') || destLower.includes('india')) {
      return {
        police: '100',
        medical: '108 / 102',
        touristPolice: '112 (All-in-one Emergency)',
        embassyInfo: 'US Consulate Mumbai: +91 22-2672-4000',
        notes: 'Drink only bottled water and be cautious of street vendor ice.',
      };
    }
    return defaultContacts;
  };

  const emergency = getEmergencyContacts(destName);

  // Group days into pages of 3 days each
  const daysPerPage = 3;
  const itineraryPages: any[][] = [];
  const itineraryList = rawItinerary;
  for (let i = 0; i < itineraryList.length; i += daysPerPage) {
    itineraryPages.push(itineraryList.slice(i, i + daysPerPage));
  }

  return (
    <div id="pdf-export-container" className="bg-slate-100 flex flex-col items-center py-8 gap-8 overflow-auto max-h-[70vh] border border-[#eeedf3] rounded-xl">
      <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-widest text-center">
        PDF Preview (Document size optimized for A4 download)
      </div>

      {/* Page 1: COVER PAGE */}
      <div className="pdf-page w-[794px] h-[1123px] bg-gradient-to-br from-[#003c88] via-[#0058bc] to-[#001a41] text-white flex flex-col justify-between p-16 relative box-border flex-shrink-0 shadow-2xl">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        {/* Header Branding */}
        <div className="flex justify-between items-center z-10 border-b border-white/20 pb-6">
          <span className="text-[20px] font-bold tracking-wider">TravelBuddy AI</span>
          <span className="text-[12px] uppercase tracking-widest bg-white/10 px-4 py-1.5 rounded-full border border-white/20">
            Exclusive Travel Document
          </span>
        </div>

        {/* Center Cover Contents */}
        <div className="z-10 flex flex-col gap-6 my-auto">
          <div className="w-16 h-1 bg-[#fd9d06] rounded-full"></div>
          <span className="text-[14px] uppercase tracking-[0.25em] text-[#fd9d06] font-bold">
            Tailored Itinerary Plan
          </span>
          <h1 className="text-[54px] font-extrabold tracking-tight leading-none drop-shadow-md">
            {destName || "Your Dream Getaway"}
          </h1>
          <p className="text-[20px] text-blue-100/90 font-medium tracking-wide max-w-lg mt-2">
            A beautiful {days || planResult.days || 5}-day journey customized for {travelers || planResult.travelers || 1} traveler{(travelers || planResult.travelers || 1) > 1 ? 's' : ''}.
          </p>
        </div>

        {/* Footer Meta */}
        <div className="z-10 flex justify-between items-end border-t border-white/10 pt-8 mt-auto">
          <div>
            <div className="text-[11px] text-blue-200/70 uppercase tracking-widest mb-1">Generated On</div>
            <div className="text-[14px] font-semibold">{generatedDate}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-blue-200/70 uppercase tracking-widest mb-1">Powered By</div>
            <div className="text-[14px] font-semibold">Orchestrator Graph Engine v1.0</div>
          </div>
        </div>
      </div>

      {/* Page 2: EXECUTIVE SUMMARY & BUDGET SUMMARY */}
      <div className="pdf-page w-[794px] h-[1123px] bg-white text-slate-800 flex flex-col justify-between p-16 relative box-border flex-shrink-0 shadow-2xl">
        <div className="flex flex-col gap-8">
          
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#0058bc]">TravelBuddy Travel Report</span>
            <span className="text-[11px] text-slate-400">Page 2 of {2 + itineraryPages.length + 1}</span>
          </div>

          {/* Section: Executive Summary */}
          <div>
            <h2 className="text-[20px] font-bold text-[#001a41] border-l-4 border-[#0058bc] pl-3 mb-4">
              Executive Summary
            </h2>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
              <p className="text-[14px] leading-relaxed text-slate-600 italic">
                "{execSummary}"
              </p>
            </div>
          </div>

          {/* Section: Key Weather Insights */}
          <div>
            <h3 className="text-[16px] font-bold text-slate-800 mb-3">Weather Suitability</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Suitability Score</span>
                <span className="text-[20px] font-extrabold text-[#0058bc]">{weather.suitability_score}%</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Temperature</span>
                <span className="text-[20px] font-extrabold text-slate-700">{weather.temperature}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Rain Chance</span>
                <span className="text-[20px] font-extrabold text-slate-700">{weather.rain_probability}</span>
              </div>
            </div>
          </div>

          {/* Section: Lodging & Transit Recommendations */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-400 mb-2">Lodging Recommendation</h3>
              {hotel ? (
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <div className="font-bold text-[14px] text-slate-800">{hotel.hotel}</div>
                  <div className="text-[12px] text-slate-500 mt-1">Rating: ★ {hotel.rating}</div>
                  <div className="text-[14px] font-bold text-[#0058bc] mt-2">₹{hotel.price} / night</div>
                </div>
              ) : (
                <div className="text-[12px] text-slate-400 italic">No accommodation recommendations listed.</div>
              )}
            </div>

            <div>
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-400 mb-2">Transit Recommendation</h3>
              {transport ? (
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <div className="font-bold text-[14px] text-slate-800">{transport.mode} Transit</div>
                  <div className="text-[12px] text-slate-500 mt-1">Duration: {transport.duration}</div>
                  <div className="text-[14px] font-bold text-[#0058bc] mt-2">₹{transport.cost} Total Cost</div>
                </div>
              ) : (
                <div className="text-[12px] text-slate-400 italic">No transport recommendations listed.</div>
              )}
            </div>
          </div>

          {/* Section: Budget Summary */}
          <div>
            <h2 className="text-[20px] font-bold text-[#001a41] border-l-4 border-[#0058bc] pl-3 mb-4">
              Budget Analysis
            </h2>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="border-r border-slate-200 pr-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lodging</span>
                  <div className="text-[16px] font-bold text-slate-800 mt-1">{budget.accommodation_cost}</div>
                </div>
                <div className="border-r border-slate-200 pr-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Transport</span>
                  <div className="text-[16px] font-bold text-slate-800 mt-1">{budget.travel_cost}</div>
                </div>
                <div className="border-r border-slate-200 pr-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Food & Bev</span>
                  <div className="text-[16px] font-bold text-slate-800 mt-1">{budget.food_cost}</div>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Activities</span>
                  <div className="text-[16px] font-bold text-slate-800 mt-1">{budget.activities_cost}</div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                <span className="text-[15px] font-bold text-slate-700">Estimated Grand Total:</span>
                <span className="text-[24px] font-extrabold text-[#0058bc]">₹{budget.total}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-[10px] text-slate-400">
          <span>TravelBuddy Itinerary Service</span>
          <span>Confidential & Tailored</span>
        </div>
      </div>

      {/* Pages 3+: DAY-WISE ITINERARY */}
      {itineraryPages.map((pageDays, pageIdx) => (
        <div key={pageIdx} className="pdf-page w-[794px] h-[1123px] bg-white text-slate-800 flex flex-col justify-between p-16 relative box-border flex-shrink-0 shadow-2xl">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#0058bc]">Day-Wise Itinerary Plan</span>
              <span className="text-[11px] text-slate-400">Page {3 + pageIdx} of {2 + itineraryPages.length + 1}</span>
            </div>

            <h2 className="text-[20px] font-bold text-[#001a41] border-l-4 border-[#0058bc] pl-3 mb-2">
              Detailed Schedule (Days {pageIdx * daysPerPage + 1} - {Math.min((pageIdx + 1) * daysPerPage, itineraryList.length)})
            </h2>

            {/* Days list */}
            <div className="space-y-6">
              {pageDays.map((day: any) => (
                <div key={day.day} className="relative pl-8 border-l-2 border-blue-100 last:border-l-0 pb-2">
                  <div className="absolute left-[-11px] top-0 w-5.5 h-5.5 rounded-full bg-[#0058bc] text-white flex items-center justify-center font-bold text-[10px]">
                    {day.day}
                  </div>
                  
                  <h3 className="text-[15px] font-extrabold text-[#001a41] mb-3">Day {day.day} Schedule</h3>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#0058bc] mb-1">Morning</div>
                      <p className="text-[12px] leading-relaxed text-slate-600">{day.morning}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#0058bc] mb-1">Afternoon</div>
                      <p className="text-[12px] leading-relaxed text-slate-600">{day.afternoon}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#0058bc] mb-1">Evening</div>
                      <p className="text-[12px] leading-relaxed text-slate-600">{day.evening}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-[10px] text-slate-400">
            <span>TravelBuddy Itinerary Service</span>
            <span>Confidential & Tailored</span>
          </div>
        </div>
      ))}

      {/* Final Page: PACKING LIST & EMERGENCY CONTACTS */}
      <div className="pdf-page w-[794px] h-[1123px] bg-white text-slate-800 flex flex-col justify-between p-16 relative box-border flex-shrink-0 shadow-2xl">
        <div className="flex flex-col gap-8">
          
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#0058bc]">Pre-Trip Checklist & Safety Guide</span>
            <span className="text-[11px] text-slate-400">Page {2 + itineraryPages.length + 1} of {2 + itineraryPages.length + 1}</span>
          </div>

          {/* Packing List */}
          <div>
            <h2 className="text-[20px] font-bold text-[#001a41] border-l-4 border-[#0058bc] pl-3 mb-4">
              Tailored Packing List
            </h2>
            {packing_list.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                {packing_list.map((item: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100">
                    <div className="w-4 h-4 border-2 border-slate-300 rounded flex-shrink-0"></div>
                    <span className="text-[13px] font-medium text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-slate-400 italic">No specific packing checklist required.</p>
            )}
          </div>

          {/* Emergency Contacts */}
          <div>
            <h2 className="text-[20px] font-bold text-[#001a41] border-l-4 border-[#ba1a1a] pl-3 mb-4">
              Emergency Contacts & Safety Details
            </h2>
            <div className="bg-red-50/50 border border-red-100 rounded-2xl p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-red-100/50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">Police (Local Authorities)</div>
                  <div className="text-[16px] font-extrabold text-slate-800">{emergency.police}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-red-100/50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">Ambulance & Fire</div>
                  <div className="text-[16px] font-extrabold text-slate-800">{emergency.medical}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-red-100/50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">Tourist Assistance</div>
                  <div className="text-[16px] font-extrabold text-slate-800">{emergency.touristPolice}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-red-100/50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">Diplomatic Embassy</div>
                  <div className="text-[12px] font-bold text-slate-800 mt-1 leading-snug">{emergency.embassyInfo}</div>
                </div>
              </div>

              {/* Safety & Protocol Tips */}
              <div className="bg-white p-4 rounded-xl border border-red-100/50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#0058bc] mb-1">Safety Guidelines</div>
                <p className="text-[12px] leading-relaxed text-slate-600 mt-1 font-medium">
                  {emergency.notes} Keep copy backups of your itinerary saved locally on your mobile devices.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-[10px] text-slate-400">
          <span>TravelBuddy Itinerary Service</span>
          <span>Confidential & Tailored</span>
        </div>
      </div>

    </div>
  );
}
