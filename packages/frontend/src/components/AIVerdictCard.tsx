import React from 'react';
import { Cpu, CheckSquare, Terminal } from 'lucide-react';
import type { AIVerdict } from '@wannabe/shared';

interface AIVerdictCardProps {
  verdict: AIVerdict;
}

export const AIVerdictCard: React.FC<AIVerdictCardProps> = ({ verdict }) => {
  return (
    <div className="glass-panel rounded-xl p-5 mb-6 border border-slate-800 shadow-xl">
      {/* Header with Model Attribution */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-cyber-border">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-semibold text-white">AI Security Intelligence Narrative</h3>
        </div>
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-xs font-mono text-cyan-300">
          <Terminal className="w-3.5 h-3.5" />
          <span>{verdict.modelAttribution}</span>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="mb-4">
        <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-1.5 font-semibold">
          Executive Summary
        </h4>
        <p className="text-sm text-slate-200 leading-relaxed bg-slate-900/60 p-3.5 rounded-lg border border-slate-800">
          {verdict.summary}
        </p>
      </div>

      {/* Technical Analysis */}
      <div className="mb-4">
        <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-1.5 font-semibold">
          Deep Technical Analysis
        </h4>
        <div className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950 p-3.5 rounded-lg border border-slate-800 whitespace-pre-line">
          {verdict.technicalAnalysis}
        </div>
      </div>

      {/* Recommendations Checklist */}
      {verdict.recommendations && verdict.recommendations.length > 0 && (
        <div>
          <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-2 font-semibold">
            Actionable Remediation Guidance
          </h4>
          <ul className="space-y-2">
            {verdict.recommendations.map((rec, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs text-slate-200 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80"
              >
                <CheckSquare className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
