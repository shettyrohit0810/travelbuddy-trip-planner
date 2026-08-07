'use client';

import React, { useMemo } from 'react';
import BudgetBreakdown, { BudgetCategory } from './BudgetBreakdown';
import DailyExpenseTimeline, { DailyExpense } from './DailyExpenseTimeline';

/**
 * The real budget the backend's budget agent produced, as returned in
 * `plan.budget_summary`. Every figure rendered by this component comes from here --
 * nothing on this dashboard is invented client-side.
 */
export interface BudgetSummary {
  travel_cost: number;
  accommodation_cost: number;
  food_cost: number;
  activities_cost: number;
  buffer: number;
  total: number;
}

interface BudgetDashboardProps {
  destination?: string;
  peopleCount?: number;
  daysCount?: number;
  budgetSummary?: BudgetSummary | null;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function BudgetDashboard({
  peopleCount = 1,
  daysCount = 5,
  budgetSummary = null
}: BudgetDashboardProps) {
  const travelers = peopleCount || 1;
  const days = daysCount || 5;

  const categories: BudgetCategory[] = useMemo(() => {
    if (!budgetSummary) return [];
    return [
      { title: 'Transportation', items: [{ label: 'Travel to and around the destination', cost: budgetSummary.travel_cost }] },
      { title: 'Hotels & Accommodation', items: [{ label: 'Lodging for the full stay', cost: budgetSummary.accommodation_cost }] },
      { title: 'Dining & Food', items: [{ label: 'Meals across the trip', cost: budgetSummary.food_cost }] },
      { title: 'Activities & Sightseeing', items: [{ label: 'Scheduled attractions and entry costs', cost: budgetSummary.activities_cost }] },
      { title: 'Emergency Buffer', items: [{ label: 'Reserve held back for the unexpected', cost: budgetSummary.buffer }] }
    ];
  }, [budgetSummary]);

  // An even split of the real total -- labelled as exactly that. The planner does
  // not produce per-day spend, so presenting anything more granular here would be
  // inventing numbers.
  const dailyExpenses: DailyExpense[] = useMemo(() => {
    if (!budgetSummary || days <= 0) return [];
    const perDay = budgetSummary.total / days;
    return Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      items: [{ label: 'Average daily allowance (even split of trip total)', cost: Math.round(perDay) }]
    }));
  }, [budgetSummary, days]);

  if (!budgetSummary) {
    return (
      <div className="bg-surface-container-lowest border border-surface-variant/30 rounded-2xl p-6 shadow-sm text-left">
        <h3 className="text-[17px] font-black text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">payments</span>
          Budget Breakdown
        </h3>
        <p className="text-[12.5px] text-on-surface-variant mt-2">
          No budget has been generated for this trip yet. Plan a trip to see a costed
          breakdown here.
        </p>
      </div>
    );
  }

  const costPerPerson = budgetSummary.total / travelers;

  return (
    <div className="bg-surface-container-lowest border border-surface-variant/30 rounded-2xl p-6 shadow-sm text-left space-y-6">

      <div>
        <h3 className="text-[17px] font-black text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">payments</span>
          Budget Breakdown
        </h3>
        <p className="text-[12px] text-on-surface-variant mt-0.5">
          Estimated for <span className="font-bold text-primary">{travelers}</span> traveler(s)
          over <span className="font-bold text-primary">{days}</span> days.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
        <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant/20">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Estimated Total</span>
          <span className="font-black text-[22px] text-primary mt-1 block">{inr(budgetSummary.total)}</span>
        </div>
        <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant/20">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Cost Per Person</span>
          <span className="font-black text-[22px] text-on-surface mt-1 block">{inr(costPerPerson)}</span>
        </div>
        <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant/20">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Emergency Buffer</span>
          <span className="font-black text-[22px] text-orange-600 mt-1 block">{inr(budgetSummary.buffer)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetBreakdown categories={categories} />
        <DailyExpenseTimeline days={dailyExpenses} />
      </div>

      <p className="text-[11px] text-on-surface-variant/80 leading-relaxed border-t border-surface-variant/20 pt-3">
        These are estimates produced by the planning agents from the trip parameters, not
        quoted prices. Activity costs come from a per-category rate table; transport and
        lodging come from the transport and accommodation agents.
      </p>
    </div>
  );
}
