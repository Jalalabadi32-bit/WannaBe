/**
 * WANNABE Canonical Domain Types
 * Shared across @wannabe/core, @wannabe/api, @wannabe/cli, and Frontend.
 */

export type UserRole = 'viewer' | 'analyst' | 'admin';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface ScanTarget {
  packageName: string;
  version: string;
  repoUrl?: string;
  gitTag?: string;
}

export type FileDiffStatus =
  | 'identical'
  | 'modified'
  | 'added_in_package'
  | 'missing_in_package'
  | 'expected_build_artifact';

export type SecuritySeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type SecurityFlagCategory =
  | 'lifecycle_hook'
  | 'eval_execution'
  | 'entropy_obfuscation'
  | 'network_exfil'
  | 'filesystem_access'
  | 'manifest_drift'
  | 'unmapped_binary';

export interface SecurityFlag {
  ruleId: string;
  severity: SecuritySeverity;
  category: SecurityFlagCategory;
  message: string;
  filePath: string;
  lineRange?: [number, number];
  snippet?: string;
}

export interface FileDiff {
  path: string;
  status: FileDiffStatus;
  sourceSha256?: string;
  packageSha256?: string;
  sizeDiffBytes: number;
  entropy?: number;
  flags: SecurityFlag[];
}

export interface ScanSummary {
  totalFilesSource: number;
  totalFilesPackage: number;
  matchedFiles: number;
  modifiedFiles: number;
  addedFiles: number;
  missingFiles: number;
  expectedArtifacts: number;
  criticalFlags: number;
  highFlags: number;
  mediumFlags: number;
  lowFlags: number;
  infoFlags: number;
}

export type RiskLevel = 'clean' | 'suspicious' | 'critical';

export interface AIVerdict {
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  summary: string;
  technicalAnalysis: string;
  recommendations: string[];
  modelAttribution: string;
}

export type ScanStatus =
  | 'queued'
  | 'fetching'
  | 'extracting'
  | 'analyzing'
  | 'evaluating_ai'
  | 'completed'
  | 'failed';

export interface ScanReport {
  id: string;
  target: ScanTarget;
  status: ScanStatus;
  startedAt: string;
  completedAt?: string;
  summary?: ScanSummary;
  fileDiffs: FileDiff[];
  flags: SecurityFlag[];
  aiVerdict?: AIVerdict;
  error?: string;
}
