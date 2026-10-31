import React, { useState } from 'react';
import { Search, FileCode, ChevronRight, ShieldAlert } from 'lucide-react';
import type { FileDiff, FileDiffStatus } from '@wannabe/shared';

interface FileDiffTreeProps {
  files: FileDiff[];
  onSelectFile: (file: FileDiff) => void;
}

type FilterType = 'all' | FileDiffStatus;

export const FileDiffTree: React.FC<FileDiffTreeProps> = ({ files, onSelectFile }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.path.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || f.status === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: FileDiffStatus) => {
    switch (status) {
      case 'identical':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/60 border border-emerald-800 text-emerald-300">
            Identical
          </span>
        );
      case 'added_in_package':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-950/60 border border-rose-800 text-rose-300 font-semibold">
            Ghost / Added
          </span>
        );
      case 'modified':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-950/60 border border-amber-800 text-amber-300">
            Modified
          </span>
        );
      case 'missing_in_package':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 border border-slate-700 text-slate-400">
            Missing in Release
          </span>
        );
      case 'expected_build_artifact':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/60 border border-cyan-800 text-cyan-300">
            Expected Artifact
          </span>
        );
      default:
        return null;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const sign = bytes > 0 ? '+' : '';
    if (Math.abs(bytes) >= 1024) {
      return `${sign}${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${sign}${bytes} B`;
  };

  return (
    <div className="glass-panel rounded-xl p-5 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-cyber-border">
        <div className="flex items-center space-x-2">
          <FileCode className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-semibold text-white">Source vs. Package File Tree</h3>
          <span className="text-xs font-mono text-slate-400">({filteredFiles.length} files)</span>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4 text-xs font-mono">
        {(
          [
            ['all', 'All Files'],
            ['added_in_package', 'Ghost Files'],
            ['modified', 'Modified'],
            ['missing_in_package', 'Missing'],
            ['expected_build_artifact', 'Expected Build'],
            ['identical', 'Identical']
          ] as [FilterType, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-2.5 py-1 rounded-md border transition-colors ${
              filter === key
                ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Files List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
              <th className="py-2.5 px-3">File Path</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Size Delta</th>
              <th className="py-2.5 px-3">Entropy</th>
              <th className="py-2.5 px-3 text-right">Security Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 font-mono text-xs">
                  No files matched the current filters.
                </td>
              </tr>
            ) : (
              filteredFiles.map((file, idx) => {
                const hasFlags = file.flags && file.flags.length > 0;
                const highEntropy = (file.entropy ?? 0) > 5.5;

                return (
                  <tr
                    key={idx}
                    onClick={() => onSelectFile(file)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-200 font-medium flex items-center gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                      <span className="truncate max-w-xs md:max-w-md">{file.path}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{getStatusBadge(file.status)}</td>
                    <td
                      className={`py-2.5 px-3 font-mono whitespace-nowrap ${
                        file.sizeDiffBytes > 0
                          ? 'text-rose-400'
                          : file.sizeDiffBytes < 0
                          ? 'text-slate-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {formatSize(file.sizeDiffBytes)}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {file.entropy ? (
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            highEntropy
                              ? 'bg-rose-950/80 border border-rose-800 text-rose-300 font-semibold'
                              : 'text-slate-400'
                          }`}
                        >
                          {file.entropy.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {hasFlags ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 font-mono font-bold">
                          <ShieldAlert className="w-3 h-3 text-rose-400" />
                          {file.flags.length} flag{file.flags.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
