import React from 'react';
import { ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import type { HealthStatus } from '../api/client';

interface HeaderProps {
  health: HealthStatus;
  isDemoMode: boolean;
  onLoadCleanDemo: () => void;
  onLoadMaliciousDemo: () => void;
  onRefreshHealth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  isDemoMode,
  onLoadCleanDemo,
  onLoadMaliciousDemo,
  onRefreshHealth
}) => {
  return (
    <header className="border-b border-cyber-border bg-cyber-dark/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-white font-mono">WANNABE</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-cyan-950 border border-cyan-800 text-cyan-300">
                v0.1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Source-to-Package Security & Supply-Chain Verification Engine
            </p>
          </div>
        </div>

        {/* Actions & Health Telemetry */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Quick Demos */}
          <div className="flex items-center bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 px-2 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Demo:
            </span>
            <button
              onClick={onLoadCleanDemo}
              className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-emerald-950 hover:text-emerald-300 text-slate-300 transition-colors font-medium"
              title="Load verified clean package release"
            >
              Clean Baseline
            </button>
            <button
              onClick={onLoadMaliciousDemo}
              className="ml-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-rose-950 hover:text-rose-300 text-slate-300 transition-colors font-medium"
              title="Load compromised package with injected postinstall and payload"
            >
              Tampered Package
            </button>
          </div>

          {/* Backend Status Pill */}
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
              health.online
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-amber-950/40 border-amber-800 text-amber-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                health.online ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-medium">
              {health.online ? 'API Online' : isDemoMode ? 'Demo Mode' : 'API Offline'}
            </span>
            <button
              onClick={onRefreshHealth}
              className="hover:text-white transition-colors ml-1 p-0.5"
              title="Re-check API status"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
