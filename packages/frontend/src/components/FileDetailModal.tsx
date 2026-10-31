import React from 'react';
import { X, FileCode, Hash, ShieldAlert } from 'lucide-react';
import type { FileDiff } from '@wannabe/shared';

interface FileDetailModalProps {
  file: FileDiff | null;
  onClose: () => void;
}

export const FileDetailModal: React.FC<FileDetailModalProps> = ({ file, onClose }) => {
  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-2">
            <FileCode className="w-5 h-5 text-cyan-400" />
            <span className="font-mono text-sm font-semibold text-white truncate max-w-lg">
              {file.path}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="block text-[10px] uppercase font-mono text-slate-400">Status</span>
              <span className="text-xs font-mono font-semibold text-white capitalize">
                {file.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="block text-[10px] uppercase font-mono text-slate-400">Size Delta</span>
              <span className="text-xs font-mono font-semibold text-white">
                {file.sizeDiffBytes > 0 ? `+${file.sizeDiffBytes}` : file.sizeDiffBytes} bytes
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="block text-[10px] uppercase font-mono text-slate-400">Shannon Entropy</span>
              <span
                className={`text-xs font-mono font-semibold ${
                  (file.entropy ?? 0) > 5.5 ? 'text-rose-400' : 'text-slate-300'
                }`}
              >
                {file.entropy ? file.entropy.toFixed(3) : 'N/A'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="block text-[10px] uppercase font-mono text-slate-400">Flags Attached</span>
              <span className="text-xs font-mono font-semibold text-white">
                {file.flags?.length ?? 0}
              </span>
            </div>
          </div>

          {/* Cryptographic Hashes */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
              <Hash className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cryptographic SHA-256 Checksums</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Source Repository Tag:</span>
              <span className="text-slate-300 break-all select-all">
                {file.sourceSha256 || '(File absent in source Git repository)'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Published npm Tarball:</span>
              <span className="text-slate-300 break-all select-all">
                {file.packageSha256 || '(File absent in published npm package)'}
              </span>
            </div>
          </div>

          {/* File Specific Security Flags */}
          {file.flags && file.flags.length > 0 && (
            <div>
              <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-2 font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Security Flags ({file.flags.length})
              </h4>
              <div className="space-y-2.5">
                {file.flags.map((flag, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-rose-900/60 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-mono font-bold text-[10px] border border-rose-800">
                        {flag.ruleId} • {flag.severity.toUpperCase()}
                      </span>
                      <span className="font-mono text-slate-400 text-[11px]">{flag.category}</span>
                    </div>
                    <p className="text-slate-200 font-sans mb-2">{flag.message}</p>
                    {flag.snippet && (
                      <pre className="p-2.5 rounded bg-slate-900 text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                        <code>{flag.snippet}</code>
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
