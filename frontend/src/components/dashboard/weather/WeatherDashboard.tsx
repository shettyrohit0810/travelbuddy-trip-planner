'use client';

import React, { useMemo } from 'react';
import PackingAdvisor from './PackingAdvisor';
import TravelAdvisory from './TravelAdvisory';

interface WeatherDashboardProps {
  destination?: string;
  rainProbability?: number;
  tempCelsius?: string;
}

export default function WeatherDashboard({
  destination = 'Goa',
  rainProbability = 15,
  tempCelsius = '28°C'
}: WeatherDashboardProps) {
  const destName = destination.split(',')[0].trim();
  const rawTemp = parseInt(tempCelsius.replace('°C', '')) || 28;
  const rainProb = rainProbability || 15;

  const weatherDetails = useMemo(() => {
    return {
      feelsLike: `${rawTemp + 2}°C`,
      minTemp: `${rawTemp - 4}°C`,
      maxTemp: `${rawTemp + 3}°C`,
      humidity: '72%',
      windSpeed: '12 km/h',
      uvIndex: 8, // High
      aqi: 45, // Good
      sunrise: '06:05 AM',
      sunset: '06:45 PM',
      goldenHour: '05:45 PM - 06:30 PM'
    };
  }, [rawTemp]);

  return (
    <div className="bg-surface-container-lowest border border-surface-variant/30 rounded-2xl p-6 shadow-sm text-left space-y-6">
      
      {/* Header */}
      <div>
        <h3 className="text-[17px] font-black text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">wb_sunny</span>
          AI Weather Intelligence Console
        </h3>
        <p className="text-[12px] text-on-surface-variant mt-0.5">
          Real-time weather impact evaluations, packing advice, and delay alerts for <span className="font-bold text-primary">{destName}</span>.
        </p>
      </div>

      {/* Primary Forecast Summary Card */}
      <div className="bg-surface border border-surface-variant/30 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-[48px] text-amber-500 animate-spin" style={{ animationDuration: '20s' }}>
            {rainProb > 60 ? 'thunderstorm' : 'wb_sunny'}
          </span>
          <div>
            <div className="text-[32px] font-black text-on-surface leading-none">{tempCelsius}</div>
            <div className="text-[13px] text-on-surface-variant font-semibold mt-1">
              Feels Like: {weatherDetails.feelsLike} • Rain: {rainProb}% Probability
            </div>
          </div>
        </div>

        {/* Forecast Timeline Grid */}
        <div className="grid grid-cols-3 gap-3 text-center text-[12px] font-bold w-full md:w-auto">
          <div className="bg-surface-container-low p-2.5 rounded-xl border border-surface-variant/10">
            <span className="text-on-surface-variant text-[10px] block">Morning</span>
            <span>{rawTemp - 2}°C</span>
          </div>
          <div className="bg-surface-container-low p-2.5 rounded-xl border border-surface-variant/10">
            <span className="text-on-surface-variant text-[10px] block">Afternoon</span>
            <span>{rawTemp + 2}°C</span>
          </div>
          <div className="bg-surface-container-low p-2.5 rounded-xl border border-surface-variant/10">
            <span className="text-on-surface-variant text-[10px] block">Night</span>
            <span>{rawTemp - 4}°C</span>
          </div>
        </div>
      </div>

      {/* Alerts card banner */}
      {rainProb > 50 && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-2.5 text-[12.5px] font-bold animate-pulse">
          <span className="material-symbols-outlined text-[20px] text-red-600">warning</span>
          <div>
            <span>⚠️ Heavy Rain Advisory: Landslide risk is elevated near steep valley tracks. Boating activity is temporarily suspended.</span>
          </div>
        </div>
      )}

      {/* Timings index */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-[12px] font-bold">
        <div className="bg-surface-container-low p-3 rounded-xl border border-surface-variant/10">
          <span className="text-on-surface-variant text-[10px] block">Sunrise</span>
          <span>{weatherDetails.sunrise}</span>
        </div>
        <div className="bg-surface-container-low p-3 rounded-xl border border-surface-variant/10">
          <span className="text-on-surface-variant text-[10px] block">Sunset</span>
          <span>{weatherDetails.sunset}</span>
        </div>
        <div className="bg-surface-container-low p-3 rounded-xl border border-surface-variant/10">
          <span className="text-on-surface-variant text-[10px] block">Golden Hour</span>
          <span>{weatherDetails.goldenHour}</span>
        </div>
        <div className="bg-surface-container-low p-3 rounded-xl border border-surface-variant/10">
          <span className="text-on-surface-variant text-[10px] block">AQI / Quality</span>
          <span className="text-emerald-600">{weatherDetails.aqi} (Good)</span>
        </div>
      </div>

      {/* Radar Map & Advisories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PackingAdvisor temperature={rawTemp} rainProb={rainProb} />
      </div>

      <TravelAdvisory
        temperature={rawTemp}
        rainProb={rainProb}
        aqi={weatherDetails.aqi}
        uvIndex={weatherDetails.uvIndex}
      />

    </div>
  );
}
