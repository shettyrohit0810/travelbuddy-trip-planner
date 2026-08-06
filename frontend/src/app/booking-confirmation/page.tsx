'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BookingConfirmationPage() {
  const router = useRouter();

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-screen flex flex-col pt-16">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-xl shadow-sm transition-all duration-300 ease-in-out">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex justify-between items-center h-16">
          <Link href="/" className="font-headline-md text-headline-md font-bold text-primary">TravelBuddy</Link>
          <div className="hidden md:flex gap-gutter items-center">
            <Link href="/discover" className="text-on-surface-variant hover:text-primary transition-colors hover:opacity-80">Discover</Link>
            <Link href="/dashboard" className="text-on-surface-variant hover:text-primary transition-colors hover:opacity-80">My Trips</Link>
            <Link href="/profile" className="text-on-surface-variant hover:text-primary transition-colors hover:opacity-80">Profile</Link>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/plan')}
              className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2 rounded-full hover:opacity-80 transition-opacity"
            >
              Start Planning
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Canvas */}
      <main className="flex-grow flex items-center justify-center py-24 px-margin-mobile md:px-margin-desktop">
        <div className="max-w-3xl w-full glass-card rounded-xl p-8 md:p-12 relative overflow-hidden border border-surface-variant">
          {/* Decorative Background Element */}
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl z-0"></div>
          
          <div className="relative z-10 text-center mb-12">
            <div className="w-20 h-20 bg-primary-fixed rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(0,88,188,0.2)]">
              <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <h1 className="font-display-lg-mobile md:font-display-lg text-on-surface mb-2">Booking Confirmed</h1>
            <p className="font-body-lg text-on-surface-variant">Your Kyoto Exploration is all set.</p>
            <p className="font-body-sm text-outline mt-2">Confirmation #KYT-9021-AX</p>
          </div>

          {/* Trip Summary */}
          <div className="bg-surface-container-low rounded-lg p-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="font-headline-md text-on-surface mb-1">Kyoto Exploration</h2>
              <p className="font-body-md text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-outline" style={{ fontSize: '18px' }}>calendar_month</span> Oct 12 - Oct 18
                <span className="mx-2 text-outline">|</span>
                <span className="material-symbols-outlined text-outline" style={{ fontSize: '18px' }}>group</span> 2 Travelers
              </p>
            </div>
            <div className="flex flex-col items-start md:items-end">
              <span className="font-label-md text-primary bg-primary/10 px-3 py-1 rounded-full mb-1">Fully Booked</span>
            </div>
          </div>

          {/* Booking Breakdown */}
          <div className="space-y-4 mb-12">
            <h3 className="font-headline-sm text-on-surface mb-4">Itinerary Breakdown</h3>
            
            {/* Flight */}
            <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-surface-variant/50 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary-fixed rounded-full flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined">flight</span>
                </div>
                <div>
                  <p className="font-body-md font-semibold text-on-surface">AeroJet 402</p>
                  <p className="font-body-sm text-on-surface-variant">Roundtrip • SFO to KIX</p>
                </div>
              </div>
              <span className="font-label-md text-on-surface font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }}>check</span> Confirmed
              </span>
            </div>

            {/* Hotel */}
            <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-surface-variant/50 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary-fixed rounded-full flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined">hotel</span>
                </div>
                <div>
                  <p className="font-body-md font-semibold text-on-surface">Kyoto Riverside Resort</p>
                  <p className="font-body-sm text-on-surface-variant">6 Nights • Superior King Room</p>
                </div>
              </div>
              <span className="font-label-md text-on-surface font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }}>check</span> Confirmed
              </span>
            </div>

            {/* Activity */}
            <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-surface-variant/50 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary-fixed rounded-full flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined">local_activity</span>
                </div>
                <div>
                  <p className="font-body-md font-semibold text-on-surface flex items-center gap-2">
                    Fushimi Inari Guided Tour 
                    <span className="material-symbols-outlined ai-sparkle" style={{ fontSize: '16px' }} title="AI Recommended">auto_awesome</span>
                  </p>
                  <p className="font-body-sm text-on-surface-variant">Oct 14 • 09:00 AM</p>
                </div>
              </div>
              <span className="font-label-md text-on-surface font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }}>check</span> Confirmed
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <button 
              onClick={() => router.push('/itinerary/kyoto-trip-123')}
              className="flex-1 bg-primary text-on-primary font-body-lg text-center py-4 rounded-lg hover:opacity-90 transition-opacity"
            >
              View Full Itinerary
            </button>
            <button 
              onClick={() => alert("Downloading PDF... Please wait.")}
              className="flex-1 bg-primary/10 text-primary font-body-lg text-center py-4 rounded-lg hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">download</span> Download PDF
            </button>
          </div>

          {/* Next Steps */}
          <div className="border-t border-surface-variant pt-8">
            <h3 className="font-headline-sm text-on-surface mb-4">Next Steps</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-outline">mail</span>
                <div>
                  <p className="font-body-md text-on-surface">Check your email</p>
                  <p className="font-body-sm text-on-surface-variant">We've sent a detailed receipt and itinerary link to your inbox.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-outline">smartphone</span>
                <div>
                  <p className="font-body-md text-on-surface">Download the App</p>
                  <p className="font-body-sm text-on-surface-variant">Get real-time updates and offline access to your trip details.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
