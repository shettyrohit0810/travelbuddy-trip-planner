'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import { getDailyLandingImage, getTravelPhoto } from '@/lib/unsplash';
import { useLanguage } from '@/context/LanguageContext';

export default function Home() {
  const router = useRouter();
  const { t } = useLanguage();
  const [prompt, setPrompt] = useState('');
  const [heroImage, setHeroImage] = useState('https://lh3.googleusercontent.com/aida-public/AB6AXuCc-F-71UrXqdC7dRvz62G5o6YUOhXywCbsrRCbPAzfB3YlAymVsazWwux9vLNxGz0kjWZZ_as_DsdPYeyEJ9ZCu49z9I2BqoZucG5-MUlckoy0jFiFt2eKChoOsF0gRlmhCigQVilPHi-1pV0aqYJwoS-S67KOcY2HKDOpIYnkQ6tconJDU3LE3PtvZbO-CfrjAIB-rTHTOGk_j_D1edsV-db-xuxOqMF3VwFX052ZwGt0CBU52q4co7dH0WSKb4bs5bweK_IZac0');
  const [ctaImage, setCtaImage] = useState('https://lh3.googleusercontent.com/aida-public/AB6AXuAJF-4HffU7La3O9eeXHGBEwoL4C2Pbx2QWvL-Ku8WX81mxMUSJwLQo7ceaKSFkp8bz4_81LIGXGTnd5DnNbpfwRv00iQV79nKLivqCa-6CMgL9ZcjJwXAvZ7xKzCocztL6WSOcYJnZTpDBBhpxbqYwW5Lp9hP5mdoHeMil97t2aurJ12ZDJKM2QDTtmZkty14NamJMjF6cPUBOA39_GH-RMmarHBJ2a7y1SPRsrEEsNfdWqNvP4lNjonF8ANyjFwJWLMCP7G5u590');

  useEffect(() => {
    getDailyLandingImage().then(url => {
      if (url) setHeroImage(url);
    });
    getTravelPhoto('epic tropical beach sunset').then(url => {
      if (url) setCtaImage(url);
    });
  }, []);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      router.push(`/plan?prompt=${encodeURIComponent(prompt)}`);
    } else {
      router.push('/plan');
    }
  };

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Header Section */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md dark:bg-primary/80 border-b border-outline-variant/30 dark:border-outline/20 shadow-sm dark:shadow-none h-20">
        <nav className="flex justify-between items-center h-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>flight_takeoff</span>
            <span className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed">VoyageEase</span>
          </div>
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a className="text-secondary font-bold border-b-2 border-secondary pb-1 font-body-md text-body-md" href="#">{t('explore')}</a>
            <Link className="text-on-surface-variant dark:text-surface-variant hover:text-secondary dark:hover:text-secondary-fixed transition-colors font-body-md text-body-md" href="/plan">{t('planner')}</Link>
            <Link className="text-on-surface-variant dark:text-surface-variant hover:text-secondary dark:hover:text-secondary-fixed transition-colors font-body-md text-body-md" href="/dashboard">{t('trips')}</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <LanguageSelector />
            <button onClick={() => router.push('/login')} className="text-secondary dark:text-secondary-fixed font-body-md hover:opacity-80 transition-opacity active:scale-95 duration-200 bg-transparent border-none cursor-pointer text-sm md:text-base">{t('login')}</button>
            <button onClick={() => router.push('/register')} className="hidden sm:block bg-secondary text-on-primary px-4 md:px-6 py-2 rounded-lg font-body-md font-semibold hover:opacity-90 transition-all active:scale-95 border-none cursor-pointer text-sm md:text-base">{t('signUp')}</button>
          </div>
        </nav>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative h-screen flex items-center justify-center overflow-hidden pt-20">
          <div className="absolute inset-0 z-0">
            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('${heroImage}')` }}></div>
            <div className="absolute inset-0 bg-primary/25"></div>
          </div>
          <div className="relative z-10 w-full max-w-container-max px-margin-mobile md:px-margin-desktop text-center">
            <h1 className="font-display-lg text-4xl md:text-5xl lg:text-display-lg text-white mb-8 drop-shadow-lg max-w-3xl mx-auto leading-tight">
              {t('heroTitle')}
            </h1>
            {/* AI Plan Conversational Prompt Search Bar */}
            <form onSubmit={handleGenerate} className="glass-panel p-2.5 sm:p-3 rounded-2xl sm:rounded-full shadow-2xl max-w-3xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center border border-white/40 gap-3">
              <div className="flex-grow flex items-center pl-3 sm:pl-6 min-h-12">
                <span className="material-symbols-outlined text-secondary text-2xl mr-3 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <input 
                  className="w-full bg-transparent border-none focus:ring-0 text-body-md md:text-body-lg font-semibold text-primary placeholder:text-slate-400 p-0 outline-none" 
                  placeholder={t('heroPlaceholder')}
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <button type="submit" className="bg-secondary text-on-primary px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 border-none cursor-pointer shrink-0">
                <span className="material-symbols-outlined">magic_button</span>
                <span className="font-semibold">{t('generatePlan')}</span>
              </button>
            </form>
          </div>
        </section>

        {/* Top Destinations Section */}
        <section className="py-20 md:py-24 bg-surface px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-12 gap-4">
            <div>
              <h2 className="font-display-lg text-3xl md:text-display-lg text-primary mb-4">{t('popularEscapes')}</h2>
              <p className="text-body-md md:text-body-lg text-on-surface-variant max-w-xl">{t('popularEscapesSub')}</p>
            </div>
            <button onClick={() => router.push('/plan')} className="flex items-center gap-2 text-secondary font-semibold hover:underline bg-transparent border-none cursor-pointer">
              {t('exploreAll')} <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-gutter">
            {/* Card 1: Kyoto */}
            <div className="group relative overflow-hidden rounded-xl bg-surface-container shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="aspect-[4/5] overflow-hidden">
                <img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={t('popularEscapesCard1')} src="https://lh3.googleusercontent.com/aida-public/AB6AXuADXeqJgYG5XDREQbiTda0V-4-sNxynB7JaeMMiNeohJavJPx1zLR0brDA1kwOEFE5evM5be6baegQOqnp8TD4hf0bVxJYNWXNOCuQN98YCWvVKjBFYKX8KRmMjo1uGMtemSzDPL9DIz0JHx9xT9ejWF1QEQkfAGgHVMwoOQFcqMAXKZbGKP1s5gejsJO1w8KYQsKOG2lYBPcZZmOjqRSebXz3EHQ0RQtAHKpItrxfEcDOU4hTocgJqCWmX4jkt9529KKAZmU5-u5A" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-6">
                <h3 className="font-headline-md text-white mb-2">{t('popularEscapesCard1')}</h3>
                <div className="flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-white/80 text-body-sm">124 {t('popularEscapesItineraries')}</span>
                  <button onClick={() => { setPrompt("Kyoto temples and culture"); router.push(`/plan?prompt=Kyoto`); }} className="bg-white text-primary px-4 py-2 rounded-lg font-semibold text-body-sm hover:bg-secondary hover:text-white transition-colors border-none cursor-pointer">{t('popularEscapesView')}</button>
                </div>
              </div>
            </div>
            {/* Card 2: Amalfi Coast */}
            <div className="group relative overflow-hidden rounded-xl bg-surface-container shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="aspect-[4/5] overflow-hidden">
                <img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={t('popularEscapesCard2')} src="https://lh3.googleusercontent.com/aida-public/AB6AXuBPvrO4XgDVcUuv7b4ZQMZ4qoq0UwE5CYaAKIdgwvNjHp3s6ytF1iK-zbbw3uDomhjLxUojrziIijCBMY6QQO_U3GuavqQaPIqYABCOELK_aINqBoJw2xrariVuClfKkgbunDh2YYFu7gGrKrL0WxBKtI6RG1Dy2btJXUUBklcOlcGsWLRkamdRaal4qf5ygJk8VL7wRqnzG3_-eARTMV080byRC0N7Zclcq7Cr6-FduKlga1i8xlhk5yipprjQbRzbeIM74AgncF8" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-6">
                <h3 className="font-headline-md text-white mb-2">{t('popularEscapesCard2')}</h3>
                <div className="flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-white/80 text-body-sm">89 {t('popularEscapesItineraries')}</span>
                  <button onClick={() => { setPrompt("Amalfi Coast beach trip"); router.push(`/plan?prompt=Amalfi%20Coast`); }} className="bg-white text-primary px-4 py-2 rounded-lg font-semibold text-body-sm hover:bg-secondary hover:text-white transition-colors border-none cursor-pointer">{t('popularEscapesView')}</button>
                </div>
              </div>
            </div>
            {/* Card 3: Santorini */}
            <div className="group relative overflow-hidden rounded-xl bg-surface-container shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="aspect-[4/5] overflow-hidden">
                <img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={t('popularEscapesCard3')} src="https://lh3.googleusercontent.com/aida-public/AB6AXuBTZiFIkOM0SeVjMhW7fG5T9Hpkp-F0pRytwf4cnk74L09gR8AZGTkAgFQmvVWyl4oFxRVHM-1eJUHW6ZUkeuzk10oFsIJpXqr41jT0IHvg636oM87LeXyLLoyJkX92a36Ioc8vrljKPz30Zzxy8d5MHcw0wXwAb16lIHT8MfqJ2-9dmY_3fXW4-w-9gNaTRMxZYY51gG4irCPw6e0VE1WY-1Wg-bQ3rdNA7taAQXkNTdGn7rtuq5q04GEqnUinC_7GloUk7heBN_U" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-6">
                <h3 className="font-headline-md text-white mb-2">{t('popularEscapesCard3')}</h3>
                <div className="flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-white/80 text-body-sm">215 {t('popularEscapesItineraries')}</span>
                  <button onClick={() => { setPrompt("Santorini honeymoon escape"); router.push(`/plan?prompt=Santorini`); }} className="bg-white text-primary px-4 py-2 rounded-lg font-semibold text-body-sm hover:bg-secondary hover:text-white transition-colors border-none cursor-pointer">{t('popularEscapesView')}</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Features Section */}
        <section className="py-24 md:py-32 bg-primary text-white overflow-hidden">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="text-center mb-20">
              <h2 className="font-display-lg text-3xl md:text-display-lg mb-6">{t('modernTravelerTitle')}</h2>
              <p className="text-on-primary-container max-w-2xl mx-auto text-body-md md:text-body-lg">{t('modernTravelerSub')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              <div className="flex flex-col items-center text-center p-8 rounded-2xl bg-primary-container/50 border border-outline/10 hover:border-secondary transition-colors group">
                <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mb-6 text-secondary group-hover:bg-secondary group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
                <h3 className="font-headline-sm text-white mb-4">{t('featureItineraryTitle')}</h3>
                <p className="text-on-primary-container text-body-md">{t('featureItinerarySub')}</p>
              </div>
              <div className="flex flex-col items-center text-center p-8 rounded-2xl bg-primary-container/50 border border-outline/10 hover:border-secondary transition-colors group">
                <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mb-6 text-secondary group-hover:bg-secondary group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
                </div>
                <h3 className="font-headline-sm text-white mb-4">{t('featureBudgetTitle')}</h3>
                <p className="text-on-primary-container text-body-md">{t('featureBudgetSub')}</p>
              </div>
              <div className="flex flex-col items-center text-center p-8 rounded-2xl bg-primary-container/50 border border-outline/10 hover:border-secondary transition-colors group">
                <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mb-6 text-secondary group-hover:bg-secondary group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
                </div>
                <h3 className="font-headline-sm text-white mb-4">{t('featureAlertTitle')}</h3>
                <p className="text-on-primary-container text-body-md">{t('featureAlertSub')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="py-20 md:py-24 bg-surface-container-low px-margin-mobile md:px-margin-desktop">
          <div className="max-w-container-max mx-auto">
            <div className="flex flex-col items-center mb-16 text-center">
              <div className="flex items-center gap-1 text-secondary mb-4">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              </div>
              <h2 className="font-headline-md text-primary font-bold">{t('socialTitle')}</h2>
              <p className="text-on-surface-variant text-body-md mt-2">{t('socialSub')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <div className="bg-white dark:bg-surface-container p-6 md:p-8 rounded-xl shadow-sm border border-outline-variant/30 italic">
                <p className="text-body-md md:text-body-lg text-primary dark:text-white mb-6">{t('testimonial1Text')}</p>
                <div className="flex items-center gap-4 non-italic">
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                    <img className="w-full h-full object-cover" alt={t('testimonial1Author')} src="https://lh3.googleusercontent.com/aida-public/AB6AXuAB8-thVdbDxsCjcR56jwDEsI0RIWQnYT_KMMcoHuMmb18ZUymloEYgxfirWmilnaUtVReVbYRb5m3nIPIyDuAp10UkfXMjfDuMmhmhHJEEE8siJyt7uvL43UrbO__XnQO3-dQYU5YAfWxkWq4bmQ2MH6yIRCjVvU7k0BQ3mzt-SMyhuZPeWgLeQlIlLlozhrYGqA9xeOM4tedMb_pBd1lkYFZlQUQXUM6pggw0kfXpN1qww7JthInXDKopfoShrDm7HVx2U0E061c" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary dark:text-white">{t('testimonial1Author')}</h4>
                    <p className="text-body-sm text-on-surface-variant">{t('testimonial1Role')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-surface-container p-6 md:p-8 rounded-xl shadow-sm border border-outline-variant/30 italic">
                <p className="text-body-md md:text-body-lg text-primary dark:text-white mb-6">{t('testimonial2Text')}</p>
                <div className="flex items-center gap-4 non-italic">
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                    <img className="w-full h-full object-cover" alt={t('testimonial2Author')} src="https://lh3.googleusercontent.com/aida-public/AB6AXuDhC1qSIUtvDd083zgC9XJuv1jpXpl9Ue6k8RimIHzgD5BEtxkU5RWr2p--xJMtZqfpRme9xVfemNUtkyiFEJJuvWjRHiUPTR_c2_6MPDs_WSLUCOodeNlWiuKpxAAVIVXYA3lBgdBOMtdGkIvy6Mhqn-m6vBVKWxp02SuhaQSijYFLaMvNhBbrPL7GJLN6qURwVPQGXYyP2NAyDd_FMTrKiRZDMddkOXMgsVE2vxAZ9pDswmGO3HGBgEhJJnWxHiy3uq-5L7qxtes" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary dark:text-white">{t('testimonial2Author')}</h4>
                    <p className="text-body-sm text-on-surface-variant">{t('testimonial2Role')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 md:py-32 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('${ctaImage}')` }}></div>
            <div className="absolute inset-0 bg-primary/60"></div>
          </div>
          <div className="relative z-10 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop text-center">
            <h2 className="font-display-lg text-3xl md:text-display-lg text-white mb-8">{t('ctaTitle')}</h2>
            <p className="text-white/80 text-body-md md:text-body-lg max-w-2xl mx-auto mb-12">{t('ctaSub')}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => router.push('/plan')} className="bg-secondary text-on-primary px-8 md:px-10 py-4 md:py-5 rounded-lg text-body-md md:text-body-lg font-bold hover:opacity-90 transition-all active:scale-95 shadow-xl border-none cursor-pointer">
                {t('getStarted')}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Section */}
      <footer className="w-full py-16 md:py-20 bg-primary dark:bg-surface-container-lowest text-on-primary dark:text-on-surface">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-gutter px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <div className="sm:col-span-2 md:col-span-1">
            <span className="font-headline-sm text-headline-sm text-secondary-fixed dark:text-secondary block mb-6">VoyageEase</span>
            <p className="text-body-sm opacity-80 mb-6 font-medium text-slate-300 dark:text-on-surface-variant">{t('footerDesc')}</p>
          </div>
          <div>
            <h5 className="font-bold mb-6 text-white dark:text-on-surface uppercase text-[12px] tracking-widest">{t('footerCompany')}</h5>
            <ul className="space-y-4 list-none p-0 m-0">
              <li><Link className="text-slate-300 dark:text-on-surface-variant hover:text-white transition-colors hover:underline decoration-secondary-fixed font-medium text-body-sm" href="#">{t('footerAboutUs')}</Link></li>
              <li><Link className="text-slate-300 dark:text-on-surface-variant hover:text-white transition-colors hover:underline decoration-secondary-fixed font-medium text-body-sm" href="#">{t('footerCareers')}</Link></li>
              <li><Link className="text-slate-300 dark:text-on-surface-variant hover:text-white transition-colors hover:underline decoration-secondary-fixed font-medium text-body-sm" href="#">{t('footerContact')}</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-6 text-white dark:text-on-surface uppercase text-[12px] tracking-widest">{t('footerProduct')}</h5>
            <ul className="space-y-4 list-none p-0 m-0">
              <li><Link className="text-slate-300 dark:text-on-surface-variant hover:text-white transition-colors hover:underline decoration-secondary-fixed font-medium text-body-sm" href="#">{t('explore')}</Link></li>
              <li><Link className="text-slate-300 dark:text-on-surface-variant hover:text-white transition-colors hover:underline decoration-secondary-fixed font-medium text-body-sm" href="/plan">{t('planner')}</Link></li>
              <li><Link className="text-slate-300 dark:text-on-surface-variant hover:text-white transition-colors hover:underline decoration-secondary-fixed font-medium text-body-sm" href="#">{t('footerHelpCenter')}</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-6 text-white dark:text-on-surface uppercase text-[12px] tracking-widest">{t('footerLegal')}</h5>
            <ul className="space-y-4 list-none p-0 m-0">
              <li><Link className="text-slate-300 dark:text-on-surface-variant hover:text-white transition-colors hover:underline decoration-secondary-fixed font-medium text-body-sm" href="#">{t('footerPrivacyPolicy')}</Link></li>
              <li><Link className="text-slate-300 dark:text-on-surface-variant hover:text-white transition-colors hover:underline decoration-secondary-fixed font-medium text-body-sm" href="#">{t('footerTermsOfService')}</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-16 md:mt-20 border-t border-on-primary/10 pt-10 text-center px-margin-mobile">
          <p className="font-body-sm text-body-sm opacity-60 text-slate-400 dark:text-on-surface-variant">{t('footerCopyright')}</p>
        </div>
      </footer>
    </div>
  );
}
