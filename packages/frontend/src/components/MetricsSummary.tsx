import React from 'react';
import { CheckCircle2, FileEdit, FilePlus, FileX, ShieldAlert, Cpu } from 'lucide-react';
import type { ScanSummary } from '@wannabe/shared';

interface MetricsSummaryProps {
  summary?: ScanSummary;
}

export const MetricsSummary: React.FC<MetricsSummaryProps> = ({ summary }) => {
  if (!summary) return null;

  const fileMetrics = [
    {
      label: 'Matched Files',
      value: summary.matchedFiles,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/20 border-emerald-900/50',
      Icon: CheckCircle2,
      desc: 'Identical SHA-256'
    },
    {
      label: 'Ghost / Injected',
      value: summary.addedFiles,
      color: summary.addedFiles > 0 ? 'text-rose-400' : 'text-slate-400',
      bgColor: summary.addedFiles > 0 ? 'bg-rose-950/30 border-rose-800' : 'bg-slate-900/40 border-slate-800',
      Icon: FilePlus,
      desc: 'In tarball, missing in git'
    },
    {
      label: 'Modified Files',
      value: summary.modifiedFiles,
      color: summary.modifiedFiles > 0 ? 'text-amber-400' : 'text-slate-400',
      bgColor: summary.modifiedFiles > 0 ? 'bg-amber-950/30 border-amber-800' : 'bg-slate-900/40 border-slate-800',
      Icon: FileEdit,
      desc: 'Hash mismatch'
    },
    {
      label: 'Missing in Release',
      value: summary.missingFiles,
      color: 'text-slate-400',
      bgColor: 'bg-slate-900/40 border-slate-800',
      Icon: FileX,
      desc: 'In git, excluded from tarball'
    },
    {
      label: 'Expected Artifacts',
      value: summary.expectedArtifacts,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-950/20 border-cyan-900/50',
      Icon: Cpu,
      desc: 'Build / Transpiled'
    }
  ];

  const flagTotal =
    summary.criticalFlags + summary.highFlags + summary.mediumFlags + summary.lowFlags + summary.infoFlags;

  return (
    <div className="mb-6 space-y-3">
      {/* File Comparison Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {fileMetrics.map((m, idx) => {
          const Icon = m.Icon;
          return (
            <div key={idx} className={`p-3.5 rounded-xl border ${m.bgColor} backdrop-blur-md`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400 font-medium">{m.label}</span>
                <Icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div className={`text-xl font-bold font-mono ${m.color}`}>{m.value}</div>
              <p className="text-[10px] text-slate-500 mt-0.5">{m.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Flag Severity Breakdown Banner */}
      <div className="glass-panel p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 text-slate-300 font-medium">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span>Security Anomalies Detected ({flagTotal}):</span>
        </div>
        <div className="flex items-center space-x-2 font-mono">
          <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300">
            {summary.criticalFlags} Critical
          </span>
          <span className="px-2 py-0.5 rounded bg-orange-950/80 border border-orange-800 text-orange-300">
            {summary.highFlags} High
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-300">
            {summary.mediumFlags} Medium
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
            {summary.lowFlags + summary.infoFlags} Low/Info
          </span>
        </div>
      </div>
    </div>
  );
};
