import React, { useState } from 'react';
import { Bug, Terminal, Filter } from 'lucide-react';
import type { SecurityFlag, SecuritySeverity } from '@wannabe/shared';

interface SecurityFindingsProps {
  flags: SecurityFlag[];
}

export const SecurityFindings: React.FC<SecurityFindingsProps> = ({ flags }) => {
  const [severityFilter, setSeverityFilter] = useState<'all' | SecuritySeverity>('all');

  const filteredFlags = flags.filter((f) => {
    if (severityFilter === 'all') return true;
    return f.severity === severityFilter;
  });

  const getSeverityBadge = (sev: SecuritySeverity) => {
    switch (sev) {
      case 'critical':
        return 'bg-rose-950/80 border-rose-700 text-rose-300';
      case 'high':
        return 'bg-orange-950/80 border-orange-700 text-orange-300';
      case 'medium':
        return 'bg-amber-950/80 border-amber-700 text-amber-300';
      case 'low':
      case 'info':
      default:
        return 'bg-slate-900 border-slate-700 text-slate-400';
    }
  };

  return (
    <div className="glass-panel rounded-xl p-5 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-cyber-border">
        <div className="flex items-center space-x-2">
          <Bug className="w-5 h-5 text-rose-400" />
          <h3 className="text-base font-semibold text-white">Security Vulnerabilities & AST Detections</h3>
          <span className="text-xs font-mono text-slate-400">({filteredFlags.length} findings)</span>
        </div>

        {/* Severity Filter Pills */}
        <div className="flex items-center space-x-1.5 text-xs font-mono">
          <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2 py-0.5 rounded border capitalize transition-colors ${
                severityFilter === sev
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-semibold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {filteredFlags.length === 0 ? (
        <div className="py-8 text-center text-slate-500 font-mono text-xs">
          No security anomalies detected matching the filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFlags.map((flag, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getSeverityBadge(
                      flag.severity
                    )}`}
                  >
                    {flag.severity}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
                    {flag.ruleId}
                  </span>
                  <span className="text-xs font-mono text-cyan-400 font-medium">
                    {flag.filePath}
                    {flag.lineRange ? `:${flag.lineRange[0]}-${flag.lineRange[1]}` : ''}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {flag.category}
                </span>
              </div>

              <p className="text-xs text-slate-200 font-sans mb-2.5 leading-relaxed">
                {flag.message}
              </p>

              {flag.snippet && (
                <div className="rounded-lg bg-slate-950 border border-slate-800 p-2.5 overflow-x-auto">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mb-1">
                    <Terminal className="w-3 h-3" />
                    <span>Offending Source Snippet:</span>
                  </div>
                  <pre className="text-xs font-mono text-rose-300/90 whitespace-pre">
                    <code>{flag.snippet}</code>
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
