'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLanguage, SUPPORTED_LANGUAGES, Language } from '@/context/LanguageContext';

interface LanguageSelectorProps {
  embeddedOnly?: boolean; // If true, render the language list inline
}

export default function LanguageSelector({ embeddedOnly = false }: LanguageSelectorProps) {
  const { currentLanguage, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['hi', 'bn', 'ta']);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group and filter languages
  const favLanguages = useMemo(() => {
    return SUPPORTED_LANGUAGES.filter(
      l => favorites.includes(l.code) &&
        (l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         l.nativeName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [favorites, searchQuery]);

  const allLanguages = useMemo(() => {
    return SUPPORTED_LANGUAGES.filter(
      l => !favorites.includes(l.code) &&
        (l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         l.nativeName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [favorites, searchQuery]);

  const totalList = useMemo(() => {
    return [...favLanguages, ...allLanguages];
  }, [favLanguages, allLanguages]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto focus search field on open
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      setFocusedIndex(prev => (prev + 1) % totalList.length);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setFocusedIndex(prev => (prev - 1 + totalList.length) % totalList.length);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && focusedIndex < totalList.length) {
        handleSelectLanguage(totalList[focusedIndex].code);
      }
      e.preventDefault();
    }
  };

  const handleSelectLanguage = (code: string) => {
    changeLanguage(code);
    setSearchQuery('');
    setFocusedIndex(-1);
    if (!embeddedOnly) {
      setIsOpen(false);
    }
  };

  const handleToggleFavorite = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const renderItem = (lang: Language, index: number) => {
    const isSelected = currentLanguage.code === lang.code;
    const isFocused = index === focusedIndex;
    const isFav = favorites.includes(lang.code);

    return (
      <div
        key={lang.code}
        onClick={() => handleSelectLanguage(lang.code)}
        onMouseEnter={() => setFocusedIndex(index)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] font-semibold transition-all duration-150 cursor-pointer ${
          isSelected
            ? 'bg-primary/10 text-primary border border-primary/20'
            : isFocused
            ? 'bg-surface-container-low text-on-surface border border-surface-variant/20'
            : 'text-on-surface border border-transparent hover:bg-surface-container-lowest'
        }`}
      >
        <div className="flex items-center gap-2 flex-grow min-w-0">
          <span className="text-[17px] shrink-0">{lang.flag}</span>
          <div className="min-w-0 truncate">
            <span className="font-extrabold text-on-surface dark:text-white truncate block">{lang.nativeName}</span>
            <span className="text-[10px] text-on-surface-variant font-medium truncate block">
              {lang.name} ({lang.code.toUpperCase()})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => handleToggleFavorite(lang.code, e)}
            className={`w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-variant/30 transition-colors border-none bg-transparent cursor-pointer ${
              isFav ? 'text-amber-500' : 'text-outline-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: isFav ? "'FILL' 1" : "'FILL' 0" }}>
              star
            </span>
          </button>
          {isSelected && (
            <span className="material-symbols-outlined text-primary text-[17px]">check_circle</span>
          )}
        </div>
      </div>
    );
  };

  // 1. EMBEDDED INLINE RENDERER
  if (embeddedOnly) {
    return (
      <div className="space-y-3.5 text-left w-full max-w-sm bg-surface border border-surface-variant/20 rounded-2xl p-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-outline text-[17px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search language..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container border-none focus:ring-1 focus:ring-primary outline-none font-medium text-[12px]"
          />
        </div>

        <div className="max-h-[260px] overflow-y-auto space-y-3.5 custom-scrollbar pr-1">
          {favLanguages.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9.5px] font-extrabold uppercase text-on-surface-variant tracking-wider px-1">Favorites</div>
              <div className="space-y-1">{favLanguages.map((l, idx) => renderItem(l, idx))}</div>
            </div>
          )}

          <div className="space-y-1">
            <div className="text-[9.5px] font-extrabold uppercase text-on-surface-variant tracking-wider px-1">All Languages</div>
            <div className="space-y-1">
              {allLanguages.map((l, idx) => renderItem(l, idx + favLanguages.length))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. DROPDOWN COMBOBOX MENU RENDERER
  return (
    <div className="relative inline-block text-left" ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 px-3.5 rounded-full flex items-center justify-center bg-surface border border-surface-variant/30 hover:bg-surface-container-low text-on-surface transition-all cursor-pointer gap-2 shadow-sm font-semibold text-[13px]"
        title="Change Language"
      >
        <span className="material-symbols-outlined text-[20px] text-primary">language</span>
        <span>{currentLanguage.flag}</span>
        <span className="font-bold text-on-surface dark:text-white">{currentLanguage.name}</span>
        <span className="material-symbols-outlined text-[16px] text-outline-variant transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
          expand_more
        </span>
      </button>

      {/* Combobox Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-surface border border-surface-variant/35 rounded-2xl shadow-xl z-[100] flex flex-col max-h-[380px] overflow-hidden animate-scale-up text-left">
          
          {/* Search Header */}
          <div className="p-2 border-b border-surface-variant/20 bg-surface-container-low">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-outline text-[16px]">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search language..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface border border-surface-variant/40 focus:ring-1 focus:ring-primary outline-none font-medium text-[12px] text-on-surface placeholder-outline-variant"
              />
            </div>
          </div>

          {/* List Box Area */}
          <div className="overflow-y-auto p-2 space-y-3 custom-scrollbar flex-grow pb-4 max-h-[300px]">
            {favLanguages.length > 0 && searchQuery === '' && (
              <div className="space-y-1">
                <div className="text-[9.5px] font-extrabold uppercase text-on-surface-variant tracking-wider px-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-amber-500">star</span> Favorites
                </div>
                <div className="space-y-1">{favLanguages.map((l, idx) => renderItem(l, idx))}</div>
              </div>
            )}

            <div className="space-y-1">
              <div className="text-[9.5px] font-extrabold uppercase text-on-surface-variant tracking-wider px-1">
                All Languages ({allLanguages.length})
              </div>
              <div className="space-y-1">
                {allLanguages.map((l, idx) => renderItem(l, idx + (searchQuery === '' ? favLanguages.length : 0)))}
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="p-2.5 bg-surface-container-low border-t border-surface-variant/20 text-center text-[10px] text-on-surface-variant font-bold shrink-0">
            TravelBuddy translates transcripts & guides instantly.
          </div>
        </div>
      )}
    </div>
  );
}
