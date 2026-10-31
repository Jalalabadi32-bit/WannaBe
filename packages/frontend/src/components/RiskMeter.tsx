import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { RiskLevel } from '@wannabe/shared';

interface RiskMeterProps {
  score: number;
  level: RiskLevel;
}

export const RiskMeter: React.FC<RiskMeterProps> = ({ score, level }) => {
  // Clamped score
  const clampedScore = Math.max(0, Math.min(100, score));

  const config = {
    clean: {
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40',
      borderColor: 'border-emerald-800',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-600',
      barColor: 'from-emerald-500 to-teal-400',
      title: 'CLEAN RELEASE',
      description: 'Source-to-package verification passed with 100% cryptographic and AST parity.',
      Icon: ShieldCheck
    },
    suspicious: {
      color: 'text-amber-400',
      bgColor: 'bg-amber-950/40',
      borderColor: 'border-amber-800',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-600',
      barColor: 'from-amber-500 to-yellow-400',
      title: 'SUSPICIOUS RELEASE',
      description: 'Discrepancies found between source and tarball. Manual review advised.',
      Icon: AlertTriangle
    },
    critical: {
      color: 'text-rose-400',
      bgColor: 'bg-rose-950/40',
      borderColor: 'border-rose-800',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-600',
      barColor: 'from-rose-600 to-red-500',
      title: 'CRITICAL THREAT',
      description: 'Malicious supply-chain attack or unauthorized code execution detected.',
      Icon: ShieldAlert
    }
  }[level] ?? {
    color: 'text-slate-400',
    bgColor: 'bg-slate-900',
    borderColor: 'border-slate-800',
    badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
    barColor: 'from-slate-500 to-slate-400',
    title: 'UNKNOWN',
    description: 'Awaiting verdict.',
    Icon: ShieldCheck
  };

  const Icon = config.Icon;

  return (
    <div className={`p-6 rounded-2xl border ${config.borderColor} ${config.bgColor} backdrop-blur-md relative overflow-hidden`}>
      {/* Background glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-current opacity-10 filter blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Score & Icon Display */}
        <div className="flex items-center space-x-5">
          <div className="relative flex items-center justify-center">
            {/* Circular Gauge Ring */}
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`${config.color} transition-all duration-1000 ease-out`}
                strokeDasharray={`${clampedScore}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className={`text-2xl font-bold font-mono ${config.color}`}>{clampedScore}</span>
              <span className="text-[10px] text-slate-400 font-mono">/ 100</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-5 h-5 ${config.color}`} />
              <h3 className="text-lg font-bold tracking-tight text-white font-mono">{config.title}</h3>
            </div>
            <p className="text-xs text-slate-300 max-w-md">{config.description}</p>
          </div>
        </div>

        {/* Severity Badge & Progress Bar */}
        <div className="w-full md:w-64 flex flex-col items-start md:items-end">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${config.badgeBg} mb-3`}>
            {level} Risk Tier
          </span>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className={`h-full bg-gradient-to-r ${config.barColor} transition-all duration-1000 ease-out`}
              style={{ width: `${clampedScore}%` }}
            />
          </div>
          <div className="w-full flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>0 Clean</span>
            <span>50 Suspicious</span>
            <span>100 Critical</span>
          </div>
        </div>
      </div>
    </div>
  );
};
