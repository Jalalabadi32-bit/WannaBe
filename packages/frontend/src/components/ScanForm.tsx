import React, { useState } from 'react';
import { Search, GitBranch, Package, Play, AlertCircle } from 'lucide-react';
import type { ScanTarget } from '@wannabe/shared';
import { ScanTargetSchema } from '@wannabe/shared';

interface ScanFormProps {
  onScan: (target: ScanTarget) => void;
  isLoading: boolean;
}

export const ScanForm: React.FC<ScanFormProps> = ({ onScan, isLoading }) => {
  const [packageName, setPackageName] = useState('');
  const [version, setVersion] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [gitTag, setGitTag] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: ScanTarget = {
      packageName: packageName.trim(),
      version: version.trim(),
      repoUrl: repoUrl.trim() ? repoUrl.trim() : undefined,
      gitTag: gitTag.trim() ? gitTag.trim() : undefined
    };

    const parsed = ScanTargetSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue ? issue.message : 'Invalid scan parameters.');
      return;
    }

    onScan(parsed.data);
  };

  const handleFillSample = () => {
    setPackageName('express');
    setVersion('4.18.2');
    setRepoUrl('https://github.com/expressjs/express');
    setGitTag('4.18.2');
    setError(null);
  };

  return (
    <div className="glass-panel rounded-xl p-5 mb-6 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-cyber-border">
        <div className="flex items-center space-x-2">
          <Search className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-semibold text-white">Trigger Verification Scan</h2>
        </div>
        <button
          type="button"
          onClick={handleFillSample}
          disabled={isLoading}
          className="text-xs text-cyan-400 hover:text-cyan-300 font-mono underline disabled:opacity-50"
        >
          Auto-fill express@4.18.2
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        {/* Package Name */}
        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Package Name <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <Package className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="e.g. left-pad, express"
              disabled={isLoading}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors disabled:opacity-60"
            />
          </div>
        </div>

        {/* Version */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Version <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="e.g. 1.3.0"
            disabled={isLoading}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors disabled:opacity-60"
          />
        </div>

        {/* Repo URL */}
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-400 mb-1">
            GitHub Repository URL
          </label>
          <div className="relative">
            <GitBranch className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
              disabled={isLoading}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors disabled:opacity-60 font-mono text-xs"
            />
          </div>
        </div>

        {/* Git Tag */}
        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Git Tag
          </label>
          <input
            type="text"
            value={gitTag}
            onChange={(e) => setGitTag(e.target.value)}
            placeholder="v1.3.0"
            disabled={isLoading}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors disabled:opacity-60 font-mono text-xs"
          />
        </div>

        {/* Submit Button */}
        <div className="md:col-span-2 flex items-end">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center space-x-2 shadow-lg shadow-cyan-900/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Verify</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
