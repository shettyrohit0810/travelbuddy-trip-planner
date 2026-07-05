'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();

  return (
    <div className="bg-background text-on-background antialiased font-body-md min-h-screen flex flex-col pt-16">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-xl shadow-sm transition-all duration-300 ease-in-out">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex justify-between items-center h-16">
          <Link href="/" className="font-headline-md text-headline-md font-bold text-primary hover:opacity-80 transition-opacity">
            AeroGuide
          </Link>
          <div className="hidden md:flex space-x-8">
            <Link href="/discover" className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors hover:opacity-80">Discover</Link>
            <Link href="/dashboard" className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors hover:opacity-80">My Trips</Link>
            <Link href="/profile" className="font-body-md text-body-md text-primary border-b-2 border-primary font-bold pb-1 hover:opacity-80">Profile</Link>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.push('/plan')}
              className="hidden md:block bg-primary text-on-primary px-4 py-2 rounded-full font-label-md text-label-md hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm"
            >
              Start Planning
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant cursor-pointer hover:opacity-80 transition-opacity">
              <img 
                alt="User profile" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJH48zpekqA2tfcegFjF76juzhnZqgqzq5qwSLhkApZFEs7ORN3LIovacKEHfzgyeZsGzSjFOZVgE12i2ZqnCDwrFkTj4Nya2DqeBGK107nBzwJqFpM3dD5tuqqvHLwtwOIBzygOuchvKpFuOEwWZB4ItdQzTycRfj_5DEYbyxzZ8vYYIgF9g1CHKXfxEy-RtLORs8QjZkvDYty6o-ziK2iUzE5EjGF93CP3qUbQ9U4elduHW3cmgPgxKzW2-2dmAbUssinjMba2-z"
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-20 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto flex-grow w-full">
        {/* Profile Header */}
        <header className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-surface-container-highest shadow-sm relative group">
            <img 
              alt="User profile large" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDOxVV0dxzaiEeBEV0bCja80iOjb6iKOAbGL-eZzK6zRSJ-FOjrmiIPhYoCFLnuPmj3Sb3BXqYWYEcbvrQPmMOESEzjh-P7X0Z2dktKsTvqEtHF7Mdui_6a3lLoog_8P5BvWylGWWhjDvvuiiXmuOh-og-CcjcxJYslhwPbfpmIFpQB1-G1ZVNAA5pedOfqbK1yXS0t4eQXZBBvmT0_oM_NuX6eO78wsBRkn2OSHiKvKBqPfen2XPL4dKzbdVGBb7mZeGGC5VwNEeZd"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm">
              <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>edit</span>
            </div>
          </div>
          <div className="text-center md:text-left flex-1">
            <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-on-surface mb-2">Alex Voyager</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-4">Explorer Level: <span className="text-primary font-semibold">Global Nomad</span></p>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <span className="px-4 py-2 bg-surface-container rounded-full font-label-md text-label-md text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">flight_takeoff</span>
                14 Countries Visited
              </span>
              <span className="px-4 py-2 bg-surface-container rounded-full font-label-md text-label-md text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">map</span>
                3 upcoming trips
              </span>
              <button className="px-4 py-2 bg-surface-container hover:bg-surface-variant transition-colors rounded-full font-label-md text-label-md text-on-surface flex items-center gap-1 cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">settings</span>
                Settings
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left Column (Trips & Buckets) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Upcoming Trips */}
            <section>
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">calendar_month</span>
                  Upcoming Trips
                </h2>
                <Link className="font-label-md text-label-md text-primary hover:underline" href="/dashboard">View All</Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Trip Card 1 */}
                <div 
                  onClick={() => router.push('/itinerary/kyoto-trip-123')}
                  className="glass-panel border border-surface-variant rounded-xl overflow-hidden group cursor-pointer hover:-translate-y-1 transition-transform duration-300"
                >
                  <div className="h-40 relative">
                    <img 
                      alt="Kyoto Trip" 
                      className="w-full h-full object-cover" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuBSPO23nGEbAVo0MLQNJhbBwrhvhLbGDFuH8jFvxpun5mlwrmEhwvMQ5GU8eOETp-gVUmX3E3PU30WzUCm1wUg4iD-zFeziFgt-MQDhJcbX0BM9l0yFFuomJ3F2nM0aFeIjW6i_bYqUizJWlAJg0iJmIyk863_UXMIeJvJ0nlxiaE97OUvifiTACCPWmuy5sXPQxmJMiAp0I2f3Xnlqh1TWgzFqxJmpSlwNMt9oHdY9Z8SKC3qE-zwWj79rH1c2nXJTYRvDhTull1u6"
                    />
                    <div className="absolute top-4 right-4 bg-surface/90 backdrop-blur-md px-3 py-1 rounded-full font-label-md text-label-md text-on-surface shadow-sm">
                      In 12 Days
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">Kyoto Serenity</h3>
                      <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>flight</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">Apr 12 - Apr 20 • Solo Trip</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-2 py-1 bg-surface-container-low rounded font-label-md text-[10px] text-on-surface-variant">Culture</span>
                      <span className="px-2 py-1 bg-surface-container-low rounded font-label-md text-[10px] text-on-surface-variant">Photography</span>
                    </div>
                    <div className="w-full bg-surface-container-highest rounded-full h-1.5 mb-2">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                    <p className="font-body-sm text-[12px] text-on-surface-variant text-right">Planning 85% Complete</p>
                  </div>
                </div>
                {/* Add New Trip Card */}
                <div 
                  onClick={() => router.push('/plan')}
                  className="glass-panel rounded-xl border-dashed border-2 border-outline-variant flex flex-col items-center justify-center p-8 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors duration-300 min-h-[300px]"
                >
                  <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4 text-primary">
                    <span className="material-symbols-outlined text-3xl">add</span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">Plan a New Journey</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant text-center max-w-[200px]">Let our AI craft your next perfect adventure.</p>
                </div>
              </div>
            </section>
            
            {/* Saved Buckets */}
            <section>
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">bookmark</span>
                  Saved Buckets
                </h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
                {/* Bucket 1 */}
                <div className="flex-none w-64 glass-panel rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow border border-surface-variant">
                  <div className="h-32 rounded-lg overflow-hidden mb-4">
                    <img alt="Iceland" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDgug21TtVOMFbQTEd3FoyWHkGUpcp3i7Ey3p71pxGWk88x6EAmncGHywePSnWs843PZShLfDU6XQrk3ENcHxbfVrfeHZJ0UcVlAWO0tJAcLIZBQl2FUoTWYYruyfBbTxvlQoSfc8eElizIFZ6uNW5IHYAJ-ML_qbFFiCdmBSUHsQOLGAAeVN_1EQY6v6vNyQBbDxW9EFCR690PbFe1UrsNdXbbApXVq7AYye15plac0oeHZhlXIVusP9tIxwubhTf7c5GjADn4pL1k"/>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Nordic Lights</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Iceland • 8 places saved</p>
                </div>
                {/* Bucket 2 */}
                <div className="flex-none w-64 glass-panel rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow border border-surface-variant">
                  <div className="h-32 rounded-lg overflow-hidden mb-4">
                    <img alt="Bangkok" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuChw1wQnFxYhE5H_mh7pJjUO4pqJZVTRt8O1x2Irf7thbX9c2VQrcBjxP6uNxDbiI4izVU1xCXTOLnurk2DygnOOZcDb7ffztI-tK91RWgBMiQmiDgxyxBedGF0yuVEIP1b6JANVqMX3aJMLXCJ8hvl0qqJ8ttFVC_icnLtwfAbLsxKzsW24NqSGQDvDnv0ZaK-GLkeaVwr_S2K-OTgb1UzsRBAv1B3tqwGDCycatJ1vxrI-anbRh2pjzj-OnJjvGy-XQmtCHLdyLqr"/>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Asian Street Food</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Thailand, Vietnam • 15 places</p>
                </div>
                {/* Bucket 3 */}
                <div className="flex-none w-64 glass-panel rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow border border-surface-variant">
                  <div className="h-32 rounded-lg overflow-hidden mb-4">
                    <img alt="Maldives" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoiVD5hm2_13PTRQ0sUnFlWCzTda0yXq1_R4FTva7W0VdInQ92ueiUKS5akzKnS4BWgyxBWTV6LjMKUD5oMcsp6hT1-ZfScqMxMlzK2_EhtEpJjF2BEly5xJXNmKXm0YPP2cYLcNIQ-c0-SOgOPGWQXgxVl_15pXZp2dpu74DeWhfvEuksNS3tjGY_hMDmhbDF6eWNT6UGJzEbKLXdIJRg8sDSeCfPqw2DLuHoD6bvHibvEwuekGSdBe8wZjyXfjCBRzocBwGCxrkB"/>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Island Escapes</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Maldives • 3 places</p>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column (Stats & Preferences) */}
          <div className="lg:col-span-4 space-y-8">
            {/* Travel Stats */}
            <div className="glass-panel border border-surface-variant rounded-xl p-6">
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-6 border-b border-surface-variant pb-2">Travel Statistics</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">flight</span>
                  </div>
                  <div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Flights Taken</p>
                    <p className="font-headline-sm text-headline-sm text-on-surface">42</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined">hotel</span>
                  </div>
                  <div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Nights Away</p>
                    <p className="font-headline-sm text-headline-sm text-on-surface">128</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary">
                    <span className="material-symbols-outlined">directions_walk</span>
                  </div>
                  <div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Miles Walked</p>
                    <p className="font-headline-sm text-headline-sm text-on-surface">350+</p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Preferences */}
            <div className="glass-panel border border-surface-variant rounded-xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 pointer-events-none"></div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2 flex items-center gap-2 relative z-10">
                <span className="material-symbols-outlined ai-sparkle">auto_awesome</span>
                AI Preferences
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-6 relative z-10">Tailor how AeroGuide plans for you.</p>
              <div className="space-y-4 relative z-10">
                <label className="flex items-center justify-between cursor-pointer p-3 bg-surface rounded-lg border border-surface-variant hover:border-primary/30 transition-colors">
                  <div>
                    <span className="block font-body-md text-body-md text-on-surface font-semibold">Pace: Relaxed</span>
                    <span className="block font-body-sm text-body-sm text-on-surface-variant">Fewer activities, more downtime</span>
                  </div>
                  <div className="relative">
                    <input defaultChecked className="sr-only peer" type="checkbox"/>
                    <div className="w-10 h-6 bg-surface-container rounded-full peer-checked:bg-primary transition-colors"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm"></div>
                  </div>
                </label>
                <label className="flex items-center justify-between cursor-pointer p-3 bg-surface rounded-lg border border-surface-variant hover:border-primary/30 transition-colors">
                  <div>
                    <span className="block font-body-md text-body-md text-on-surface font-semibold">Budget: Mid-range</span>
                    <span className="block font-body-sm text-body-sm text-on-surface-variant">Comfortable, occasional splurges</span>
                  </div>
                  <span className="material-symbols-outlined text-outline">edit</span>
                </label>
                <button className="w-full py-3 mt-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-variant transition-colors flex justify-center items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  Advanced Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 bg-surface-container mt-20">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 md:grid-cols-4 gap-gutter">
          <div className="md:col-span-1">
            <div className="font-headline-sm text-headline-sm font-bold text-on-surface mb-4">
              AeroGuide
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              © 2026 AeroGuide AI. Your intuitive travel companion.
            </p>
          </div>
          <div className="md:col-span-3 flex flex-wrap gap-x-8 gap-y-4 md:justify-end">
            <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">About Us</Link>
            <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy Policy</Link>
            <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Terms of Service</Link>
            <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Help Center</Link>
            <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors" href="#">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
