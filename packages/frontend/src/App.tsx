import React, { useState, useEffect, useCallback } from 'react';
import type { ScanReport, ScanTarget, ScanStatus, FileDiff } from '@wannabe/shared';
import { apiClient, type HealthStatus } from './api/client';
import { MOCK_CLEAN_SCAN, MOCK_MALICIOUS_SCAN } from './api/mock-data';
import { Header } from './components/Header';
import { ScanForm } from './components/ScanForm';
import { ScanProgress } from './components/ScanProgress';
import { RiskMeter } from './components/RiskMeter';
import { AIVerdictCard } from './components/AIVerdictCard';
import { MetricsSummary } from './components/MetricsSummary';
import { FileDiffTree } from './components/FileDiffTree';
import { FileDetailModal } from './components/FileDetailModal';
import { SecurityFindings } from './components/SecurityFindings';
import { ScanHistoryDrawer } from './components/ScanHistoryDrawer';
import { Package, GitBranch, Clock, ShieldCheck, Cpu } from 'lucide-react';

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus>({ online: false });
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [activeReport, setActiveReport] = useState<ScanReport | null>(MOCK_CLEAN_SCAN);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('completed');
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileDiff | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'findings'>('overview');
  const [recentScans, setRecentScans] = useState<ScanReport[]>([
    MOCK_CLEAN_SCAN,
    MOCK_MALICIOUS_SCAN
  ]);

  // Check backend health & sync recent scans
  const refreshHealth = useCallback(async () => {
    const status = await apiClient.checkHealth();
    setHealth(status);
    setIsDemoMode(!status.online);

    if (status.online) {
      const serverScans = await apiClient.listRecentScans();
      if (serverScans.length > 0) {
        setRecentScans(serverScans);
        const latest = serverScans[0];
        if (latest) setActiveReport(latest);
      }
    }
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  // Handle Trigger Scan
  const handleTriggerScan = async (target: ScanTarget) => {
    setIsScanning(true);
    setScanStatus('queued');
    setScanError(null);

    if (health.online) {
      try {
        const { scanId } = await apiClient.triggerScan(target);

        // Polling loop
        const interval = setInterval(async () => {
          try {
            const statusRes = await apiClient.getScanStatus(scanId);
            setScanStatus(statusRes.status);

            if (statusRes.status === 'completed') {
              clearInterval(interval);
              const fullReport = await apiClient.getScanReport(scanId);
              setActiveReport(fullReport);
              setRecentScans((prev) => [fullReport, ...prev.filter((s) => s.id !== fullReport.id)]);
              setIsScanning(false);
            } else if (statusRes.status === 'failed') {
              clearInterval(interval);
              setScanError(statusRes.error || 'Verification scan encountered an execution error');
              setIsScanning(false);
            }
          } catch (pollErr: unknown) {
            clearInterval(interval);
            const msg = pollErr instanceof Error ? pollErr.message : String(pollErr);
            setScanError(msg);
            setIsScanning(false);
          }
        }, 1500);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setScanError(msg);
        setIsScanning(false);
      }
    } else {
      // Offline Demo Mode: simulate realistic pipeline progression
      const steps: ScanStatus[] = ['fetching', 'extracting', 'analyzing', 'evaluating_ai', 'completed'];
      let stepIndex = 0;

      const timer = setInterval(() => {
        if (stepIndex < steps.length) {
          const current = steps[stepIndex];
          if (current) setScanStatus(current);
          stepIndex++;
        } else {
          clearInterval(timer);
          setIsScanning(false);

          // Return clean or tampered depending on target name
          const isTampered =
            target.packageName.includes('tamper') || target.packageName.includes('malicious');
          const report = isTampered ? MOCK_MALICIOUS_SCAN : MOCK_CLEAN_SCAN;

          const customReport: ScanReport = {
            ...report,
            id: `demo-${Date.now()}`,
            target: {
              ...target,
              repoUrl: target.repoUrl || 'https://github.com/demo/repo',
              gitTag: target.gitTag || `v${target.version}`
            },
            startedAt: new Date(Date.now() - 5000).toISOString(),
            completedAt: new Date().toISOString()
          };

          setActiveReport(customReport);
          setRecentScans((prev) => [customReport, ...prev]);
        }
      }, 700);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-darkest text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        health={health}
        isDemoMode={isDemoMode}
        onLoadCleanDemo={() => {
          setActiveReport(MOCK_CLEAN_SCAN);
          setScanStatus('completed');
          setScanError(null);
        }}
        onLoadMaliciousDemo={() => {
          setActiveReport(MOCK_MALICIOUS_SCAN);
          setScanStatus('completed');
          setScanError(null);
        }}
        onRefreshHealth={refreshHealth}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Scan Input Form */}
        <ScanForm onScan={handleTriggerScan} isLoading={isScanning} />

        {/* Scan Progress Pipeline */}
        {isScanning && <ScanProgress status={scanStatus} error={scanError ?? undefined} />}

        {/* Scan History Bar */}
        <ScanHistoryDrawer
          scans={recentScans}
          activeScanId={activeReport?.id}
          onSelectScan={(s) => setActiveReport(s)}
        />

        {/* Scan Results View */}
        {activeReport && (
          <div className="space-y-6">
            {/* Target Release Metadata Bar */}
            <div className="glass-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <Package className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold font-mono text-white">
                      {activeReport.target.packageName}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      v{activeReport.target.version}
                    </span>
                  </div>
                  {activeReport.target.repoUrl && (
                    <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-mono mt-0.5">
                      <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate max-w-md">{activeReport.target.repoUrl}</span>
                      {activeReport.target.gitTag && (
                        <span className="text-cyan-400">@{activeReport.target.gitTag}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Audited: {new Date(activeReport.completedAt || activeReport.startedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
                  ID: {activeReport.id.slice(0, 8)}...
                </div>
              </div>
            </div>

            {/* Risk Gauge Header */}
            {activeReport.aiVerdict && (
              <RiskMeter
                score={activeReport.aiVerdict.riskScore}
                level={activeReport.aiVerdict.riskLevel}
              />
            )}

            {/* Tab Navigation */}
            <div className="border-b border-cyber-border flex space-x-6 text-sm font-medium">
              <button
                onClick={() => setActiveTab('overview')}
                className={`pb-3 font-mono flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>Executive Verdict & Metrics</span>
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`pb-3 font-mono flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'files'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>File Tree & Hashes ({activeReport.fileDiffs.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('findings')}
                className={`pb-3 font-mono flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === 'findings'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>AST & Entropy Flags ({activeReport.flags.length})</span>
              </button>
            </div>

            {/* Active Tab Content */}
            {activeTab === 'overview' && (
              <div>
                <MetricsSummary summary={activeReport.summary} />
                {activeReport.aiVerdict && <AIVerdictCard verdict={activeReport.aiVerdict} />}
              </div>
            )}

            {activeTab === 'files' && (
              <FileDiffTree
                files={activeReport.fileDiffs}
                onSelectFile={(f) => setSelectedFile(f)}
              />
            )}

            {activeTab === 'findings' && <SecurityFindings flags={activeReport.flags} />}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      <FileDetailModal file={selectedFile} onClose={() => setSelectedFile(null)} />

      {/* Footer */}
      <footer className="border-t border-cyber-border bg-cyber-dark/40 py-6 mt-12 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-slate-300 font-bold">WANNABE</span>
            <span>•</span>
            <span>Problem Statement 4 (Hacktoberfest HackDay Sonipat)</span>
            <span>•</span>
            <span>Team Spice Girls</span>
          </div>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Google Gemma 4 E4B / Gemma 2 via Ollama</span>
            <span>•</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
