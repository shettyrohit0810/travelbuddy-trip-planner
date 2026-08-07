'use client';

import React, { useState } from 'react';

export interface TrajectoryStep {
  index: number;
  kind: 'tool_call' | 'decision' | 'outcome' | string;
  name: string;
  arguments?: Record<string, unknown> | null;
  observation?: unknown;
  reasoning?: string | null;
  duration_ms?: number | null;
  error?: string | null;
}

export interface Trajectory {
  agent: string;
  goal: string;
  steps: TrajectoryStep[];
  outcome?: string | null;
  summary?: string | null;
  tool_calls_used: number;
  tool_call_budget?: number | null;
  wall_clock_ms?: number | null;
}

interface AgentTraceViewProps {
  trajectories?: Trajectory[] | null;
}

/** Outcome styling. `unavailable` is deliberately neutral rather than an error colour:
 *  "no model was configured" is a state of the deployment, not a failure of the run. */
const OUTCOME_STYLE: Record<string, { label: string; className: string }> = {
  succeeded: { label: 'Recovered', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  gave_up: { label: 'Gave up (honestly)', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  budget_exhausted: { label: 'Hit tool-call budget', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  timeout: { label: 'Hit time budget', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  error: { label: 'Errored', className: 'bg-red-500/10 text-red-700 border-red-500/20' },
  unavailable: { label: 'Not run — no model configured', className: 'bg-surface-container-low text-on-surface-variant border-surface-variant/30' },
};

const KIND_ICON: Record<string, string> = {
  tool_call: 'build',
  decision: 'psychology',
  outcome: 'flag',
};

function preview(value: unknown, max = 260): string {
  if (value === null || value === undefined) return '—';
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 1);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function AgentTraceView({ trajectories }: AgentTraceViewProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!trajectories || trajectories.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-surface-variant/30 rounded-2xl p-6 shadow-sm text-left">
        <h3 className="text-[17px] font-black text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">route</span>
          Agent Trace
        </h3>
        <p className="text-[12.5px] text-on-surface-variant mt-2 leading-relaxed">
          No agent ran for this trip. The deterministic pipeline found enough data on its
          own, so there was nothing to recover from — which is the expected path for a
          well-mapped destination.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-surface-variant/30 rounded-2xl p-6 shadow-sm text-left space-y-5">
      <div>
        <h3 className="text-[17px] font-black text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">route</span>
          Agent Trace
        </h3>
        <p className="text-[12px] text-on-surface-variant mt-0.5 leading-relaxed">
          Every tool the agent called, what came back, and why it chose the next step. The
          agent decides only <strong>what data to fetch</strong> — the scheduler, the budget
          arithmetic and the verifier stay deterministic and are not shown here.
        </p>
      </div>

      {trajectories.map((trajectory, ti) => {
        const style = OUTCOME_STYLE[trajectory.outcome ?? ''] ?? {
          label: trajectory.outcome ?? 'unknown',
          className: 'bg-surface-container-low text-on-surface-variant border-surface-variant/30',
        };

        return (
          <div key={`${trajectory.agent}-${ti}`} className="border border-surface-variant/20 rounded-xl overflow-hidden">
            <div className="bg-surface-container-low px-4 py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="font-bold text-[13.5px] text-on-surface capitalize">
                  {trajectory.agent} agent
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${style.className}`}>
                  {style.label}
                </span>
              </div>
              <p className="text-[11.5px] text-on-surface-variant leading-relaxed">
                <strong>Goal:</strong> {trajectory.goal}
              </p>
              <div className="flex flex-wrap gap-3 text-[11px] text-on-surface-variant font-medium">
                <span>
                  Tool calls: <strong>{trajectory.tool_calls_used}</strong>
                  {trajectory.tool_call_budget ? ` / ${trajectory.tool_call_budget}` : ''}
                </span>
                {trajectory.wall_clock_ms != null && (
                  <span>Elapsed: <strong>{(trajectory.wall_clock_ms / 1000).toFixed(2)}s</strong></span>
                )}
              </div>
              {trajectory.summary && (
                <p className="text-[11.5px] text-on-surface leading-relaxed">{trajectory.summary}</p>
              )}
            </div>

            <ol className="divide-y divide-surface-variant/15">
              {trajectory.steps.map((step) => {
                const key = `${ti}-${step.index}`;
                const isOpen = expanded === key;
                return (
                  <li key={key} className="px-4 py-3">
                    <button
                      onClick={() => setExpanded(isOpen ? null : key)}
                      className="w-full flex items-start gap-2.5 text-left bg-transparent border-none cursor-pointer p-0"
                      aria-expanded={isOpen}
                    >
                      <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">
                        {KIND_ICON[step.kind] ?? 'chevron_right'}
                      </span>
                      <span className="flex-grow">
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="font-bold text-[12.5px] text-on-surface">
                            {step.index + 1}. {step.name}
                          </span>
                          <span className="text-[10.5px] uppercase tracking-wider text-on-surface-variant">
                            {step.kind.replace('_', ' ')}
                          </span>
                          {step.duration_ms != null && (
                            <span className="text-[10.5px] text-on-surface-variant">
                              {step.duration_ms.toFixed(0)} ms
                            </span>
                          )}
                          {step.error && (
                            <span className="text-[10.5px] font-bold text-red-600">error</span>
                          )}
                        </span>
                        {step.reasoning && (
                          <span className="block text-[11.5px] text-on-surface-variant mt-0.5 leading-relaxed">
                            {step.reasoning}
                          </span>
                        )}
                      </span>
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                        {isOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="mt-2.5 ml-7 space-y-2 text-[11px]">
                        {step.arguments && (
                          <div>
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-primary">Arguments</span>
                            <pre className="mt-1 bg-surface-container p-2.5 rounded-lg overflow-x-auto text-on-surface-variant whitespace-pre-wrap break-words">
                              {preview(step.arguments)}
                            </pre>
                          </div>
                        )}
                        {step.error ? (
                          <div>
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-red-600">Error</span>
                            <pre className="mt-1 bg-red-500/5 border border-red-500/20 p-2.5 rounded-lg overflow-x-auto text-red-700 whitespace-pre-wrap break-words">
                              {step.error}
                            </pre>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-primary">Observation</span>
                            <pre className="mt-1 bg-surface-container p-2.5 rounded-lg overflow-x-auto text-on-surface-variant whitespace-pre-wrap break-words">
                              {preview(step.observation)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
