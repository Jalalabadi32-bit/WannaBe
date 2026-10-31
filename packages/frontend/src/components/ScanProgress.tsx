import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, Cpu, Terminal, ShieldAlert } from 'lucide-react';
import type { ScanStatus } from '@wannabe/shared';

interface ScanProgressProps {
  status: ScanStatus;
  error?: string;
}

const STAGES: { key: ScanStatus; label: string; icon: React.ElementType }[] = [
  { key: 'queued', label: 'Queued', icon: Clock },
  { key: 'fetching', label: 'Fetching Source & Package', icon: Terminal },
  { key: 'extracting', label: 'Sandbox Extraction', icon: ShieldAlert },
  { key: 'analyzing', label: 'AST & Diff Analysis', icon: Cpu },
  { key: 'evaluating_ai', label: 'Gemma AI Verdict', icon: Cpu },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 }
];

export const ScanProgress: React.FC<ScanProgressProps> = ({ status, error }) => {
  const currentIndex = STAGES.findIndex((s) => s.key === status);

  if (status === 'failed') {
    return (
      <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-semibold text-sm text-rose-200">Verification Scan Failed</h4>
          <p className="text-xs text-rose-300/90 mt-1">{error || 'An unexpected error occurred during execution.'}</p>
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return null; // When completed, report view takes over
  }

  return (
    <div className="glass-panel rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          Scan Execution Pipeline Active
        </h3>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 uppercase">
          {status}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {STAGES.map((stage, idx) => {
          const isDone = currentIndex > idx;
          const isCurrent = currentIndex === idx;
          const Icon = stage.icon;

          return (
            <div
              key={stage.key}
              className={`p-3 rounded-lg border text-center transition-all ${
                isDone
                  ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                  : isCurrent
                  ? 'bg-cyan-950/50 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/40 animate-pulse'
                  : 'bg-slate-900/40 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex justify-center mb-1.5">
                <Icon className={`w-4 h-4 ${isDone ? 'text-emerald-400' : isCurrent ? 'text-cyan-400' : 'text-slate-600'}`} />
              </div>
              <p className="text-xs font-medium leading-tight">{stage.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
