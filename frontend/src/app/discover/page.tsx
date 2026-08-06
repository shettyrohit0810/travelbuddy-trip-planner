'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DiscoverPage() {
  const router = useRouter();

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col pt-16">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-xl shadow-sm transition-all duration-300 ease-in-out">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex justify-between items-center h-16">
          <Link href="/" className="font-headline-md text-headline-md font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>flight_takeoff</span>
            TravelBuddy
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="/discover" className="font-body-md text-body-md text-primary border-b-2 border-primary font-bold pb-1 transition-all duration-300 ease-in-out">
              Discover
            </Link>
            <Link href="/dashboard" className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors hover:opacity-80">
              My Trips
            </Link>
            <Link href="/profile" className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors hover:opacity-80">
              Profile
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center bg-surface-container rounded-full px-4 py-2">
              <span className="material-symbols-outlined text-outline">search</span>
              <input 
                className="bg-transparent border-none focus:ring-0 text-body-sm font-body-sm ml-2 outline-none w-48 text-on-surface" 
                placeholder="Search destinations..." 
                type="text"
              />
            </div>
            <button 
              onClick={() => router.push('/plan')}
              className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2 rounded-full hover:opacity-80 transition-opacity flex items-center gap-2 shadow-[0px_4px_20px_rgba(0,88,188,0.2)]"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              Start Planning
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-12">
        {/* Header & Filters */}
        <section className="mb-12">
          <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-4">
            Find your next <span className="ai-sparkle">adventure</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 max-w-2xl">
            Explore community-curated itineraries and AI-optimized routes for your perfect getaway.
          </p>
          
          {/* Filter Bar */}
          <div className="glass-panel rounded-xl p-4 flex flex-wrap items-center gap-4 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-surface-variant">
            <div className="flex items-center gap-2 bg-surface rounded-full px-4 py-2 border border-outline-variant hover:border-primary transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-on-surface-variant">calendar_month</span>
              <span className="font-body-sm text-body-sm text-on-surface">Any duration</span>
            </div>
            <div className="flex items-center gap-2 bg-surface rounded-full px-4 py-2 border border-outline-variant hover:border-primary transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-on-surface-variant">payments</span>
              <span className="font-body-sm text-body-sm text-on-surface">Budget</span>
            </div>
            <div className="flex items-center gap-2 bg-surface rounded-full px-4 py-2 border border-outline-variant hover:border-primary transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-on-surface-variant">travel_explore</span>
              <span className="font-body-sm text-body-sm text-on-surface">Travel Style</span>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 text-primary cursor-pointer hover:bg-primary/20 transition-colors ml-auto">
              <span className="material-symbols-outlined">filter_list</span>
              <span className="font-label-md text-label-md">More Filters</span>
            </div>
          </div>
        </section>

        {/* Masonry Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="rounded-xl overflow-hidden relative group shadow-[0px_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0px_8px_30px_rgba(0,88,188,0.1)] transition-all duration-300">
            <img 
              alt="Amalfi Coast" 
              className="w-full h-80 object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDzVtWVhawukf0QJ55ezqrF5BGdlrdVGsNtuxvXTdK57gLgYSgIQhul5_LaL2wKHBD9OC0-Fe0Q1Cu1LqiOyJpCdoa2B6EF1SqArI16MOdCVB374VPc8pRWorRMaPmchMhJnhyNgzcdCG2bnZGROQKm0lk84_1NwNQRZuwQYVHz5cHzVYVyycSHQP5vgdp11PN0RxwJKoQVp2YiBZGe1w22lb9iIkFqXsENZpufjayTknph93flu6KfoP3vSel73M5brY-jLRfyis9M"
            />
            <div className="absolute bottom-0 w-full glass-panel p-6 rounded-t-2xl transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Amalfi Coast Road Trip</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">location_on</span> Italy
                  </p>
                </div>
                <div className="bg-surface-container rounded-full px-3 py-1 font-label-md text-label-md text-on-surface flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">schedule</span> 5 Days
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <span className="bg-surface rounded-full px-3 py-1 font-body-sm text-body-sm text-on-surface-variant text-[12px]">Scenic</span>
                <span className="bg-surface rounded-full px-3 py-1 font-body-sm text-body-sm text-on-surface-variant text-[12px]">Luxury</span>
              </div>
            </div>
          </div>

          {/* Card 2 (AI Suggested Route) */}
          <div className="bg-surface rounded-xl p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-primary/10 hover:border-primary/30 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined ai-sparkle">auto_awesome</span>
                <span className="font-label-md text-label-md ai-sparkle uppercase tracking-wider">AI Suggested Route</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">Hidden Temples of Kyoto</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-4 font-normal">
                An optimized path avoiding major crowds, focusing on tranquil zen gardens and lesser-known historical sites in the northern district.
              </p>
              <div className="flex flex-col gap-2 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-surface-variant">
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-surface border-2 border-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface">Ryoan-ji Temple</span>
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-surface border-2 border-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface">Ninna-ji</span>
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-surface border-2 border-outline-variant flex items-center justify-center"></div>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Myoshin-ji (Optional)</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => router.push('/plan?prompt=Kyoto%20temples')}
              className="mt-6 w-full py-2 bg-primary/10 text-primary font-label-md text-label-md rounded-lg hover:bg-primary/20 transition-colors"
            >
              Preview Itinerary
            </button>
          </div>

          {/* Card 3 */}
          <div className="rounded-xl overflow-hidden relative group shadow-[0px_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0px_8px_30px_rgba(0,88,188,0.1)] transition-all duration-300">
            <img 
              alt="Scottish Highlands" 
              className="w-full h-64 object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1OAMAWcRBKB3ujMa5DJRGk73ZUGYVrUP16muNi8xq9OBrlTxROm5sCFfC5DRNXaC5sPcc_EPCv5WTvDXZJuStlhPg287LGGefCiGYRK-xL-LfPeqHNeUgXU9Ue4FNNs_QOtoUZ-lR33L0ETdqJGwiVdWFXjrwIwp7Cn4VHWPHIC7mvH3zGC_-eClv83afAAAghBLv0WrekIwyRhJr6-OmL_piga3f-KsBoAEMetQY6UUS8x3_BTfkPgGm_XkYytI3EvVyYk1J0ksr"
            />
            <div className="absolute bottom-0 w-full glass-panel p-4 rounded-t-xl">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Highland Explorer</h3>
              <div className="flex justify-between items-center mt-2">
                <p className="font-body-sm text-body-sm text-on-surface-variant">Scotland</p>
                <span className="font-body-sm text-body-sm text-primary font-semibold">$1,200 est.</span>
              </div>
            </div>
          </div>

          {/* Card 4 (Community) */}
          <div className="bg-surface rounded-xl p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img 
                  alt="User Profile" 
                  className="w-10 h-10 rounded-full object-cover" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCo-leJQXsaH7nNyM4NNziHjo-1iICSSb8yMMOOWOrWaq6ckkOZliUeQKI6zc-VPmootDmC-ziG3uQjOrz7VXbyJ1VFlIs_09su9kmfvD7M29fwjGIkjNQ2nDBwhK-yo9YyHsgW8KVNxXmPFBcpT36kQLSpqML55XdihaJRsAp7p7xQaKkPmwjPyUB4Q08rYKd4QpbXGi4_RRST-6qCZXvSWoDBqBXVJ4fega1yKs5qOCdDMmz2qqN3k70amUeN5Kf81tCZ8FW6hXjT"
                />
                <div>
                  <p className="font-body-sm text-body-sm text-on-surface font-semibold">Sarah Jenkins</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px]">Top Contributor</p>
                </div>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">48 Hours in Tokyo: Foodie Edition</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                My exact route hitting the best street food in Shinjuku and hidden sushi spots in Tsukiji.
              </p>
              <div className="flex gap-2 mb-4">
                <span className="bg-surface-container rounded-full px-3 py-1 font-body-sm text-body-sm text-on-surface text-[12px] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">restaurant</span> Food & Drink
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-surface-variant pt-4">
              <div className="flex items-center gap-4 text-on-surface-variant">
                <span className="flex items-center gap-1 font-body-sm text-body-sm"><span className="material-symbols-outlined text-[16px]">favorite</span> 1.2k</span>
                <span className="flex items-center gap-1 font-body-sm text-body-sm"><span className="material-symbols-outlined text-[16px]">share</span> Share</span>
              </div>
              <button onClick={() => router.push('/plan?prompt=Tokyo%20Foodie%20Route')} className="text-primary font-label-md text-label-md hover:opacity-80">View Details</button>
            </div>
          </div>

          {/* Card 5 */}
          <div className="rounded-xl overflow-hidden relative group shadow-[0px_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0px_8px_30px_rgba(0,88,188,0.1)] transition-all duration-300">
            <img 
              alt="Marrakech Market" 
              className="w-full h-96 object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQeY0k8_eo4c21nbIf8o0f85hR67FF7aX_sEQ9km4Sss4sAQd6IBbx1HO0nEga56gnvKBPGlDGQXIyYa0Tbdv78U-QiX9RynrrGM77YrD5uI-GerkuyibCsAECfqifqeH1CUnWmXp3OnxoW9aTcKlrXqQwlsg0aUctHe6YRGyS5Tbj0cU-5XZwtaXT9duoe2fKpK7j4ZHphuzK3zQTd1lbA6LlVwmI-95uL26KkRzthlESqykAxo_aHSacB_QZyHCQe8vbuRuKTnaY"
            />
            <div className="absolute bottom-0 w-full glass-panel p-6 rounded-t-2xl">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Colors of Marrakech</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">location_on</span> Morocco
                  </p>
                </div>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 line-clamp-2">
                Immerse yourself in the vibrant souks and stunning riads of the Red City.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 bg-surface-container mt-20">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 md:grid-cols-4 gap-gutter">
          <div className="col-span-1">
            <div className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>flight_takeoff</span>
              TravelBuddy
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">© 2026 TravelBuddy AI. Your intuitive travel companion.</p>
          </div>
          <div className="col-span-1 flex flex-col gap-2">
            <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200" href="#">About Us</Link>
            <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200" href="#">Privacy Policy</Link>
          </div>
          <div className="col-span-1 flex flex-col gap-2">
            <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200" href="#">Terms of Service</Link>
            <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200" href="#">Help Center</Link>
          </div>
          <div className="col-span-1 flex flex-col gap-2">
            <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors duration-200" href="#">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
