import React from 'react';
import { History } from 'lucide-react';
import type { ScanReport } from '@wannabe/shared';

interface ScanHistoryDrawerProps {
  scans: ScanReport[];
  activeScanId?: string;
  onSelectScan: (scan: ScanReport) => void;
}

export const ScanHistoryDrawer: React.FC<ScanHistoryDrawerProps> = ({
  scans,
  activeScanId,
  onSelectScan
}) => {
  if (scans.length === 0) return null;

  return (
    <div className="glass-panel rounded-xl p-4 mb-6">
      <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-cyber-border">
        <History className="w-4 h-4 text-cyan-400" />
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
          Recent Scans ({scans.length})
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {scans.map((s) => {
          const isActive = s.id === activeScanId;
          const isCritical = (s.aiVerdict?.riskScore ?? 0) >= 70;
          const isSuspicious = (s.aiVerdict?.riskScore ?? 0) >= 25 && !isCritical;

          return (
            <button
              key={s.id}
              onClick={() => onSelectScan(s)}
              className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                isActive
                  ? 'bg-cyan-950/60 border-cyan-500 shadow-sm shadow-cyan-900/30'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                  {s.target.packageName}
                </span>
                <span className="text-[10px] font-mono text-slate-400">v{s.target.version}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono mt-1">
                <span
                  className={`capitalize ${
                    s.status === 'completed'
                      ? 'text-emerald-400'
                      : s.status === 'failed'
                      ? 'text-rose-400'
                      : 'text-cyan-400 animate-pulse'
                  }`}
                >
                  {s.status}
                </span>

                {s.aiVerdict && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isCritical
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : isSuspicious
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {s.aiVerdict.riskScore}/100
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
