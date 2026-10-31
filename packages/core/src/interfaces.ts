import type {
  ScanTarget,
  FileDiff,
  SecurityFlag,
  ScanSummary,
  AIVerdict
} from '@wannabe/shared';

export interface ExtractedWorkspace {
  id: string;
  sourceDir: string;
  packageDir: string;
  cleanup: () => Promise<void>;
}

export interface ISandboxManager {
  createWorkspace(scanId: string): Promise<ExtractedWorkspace>;
  safeExtractTarball(tarballPath: string, destinationDir: string): Promise<void>;
}

export interface IPackageFetcher {
  fetchTarball(packageName: string, version: string, destinationDir: string): Promise<string>;
}

export interface ISourceFetcher {
  fetchSource(repoUrl: string, gitTag: string, destinationDir: string): Promise<void>;
}

export interface IComparatorEngine {
  compareDirectories(sourceDir: string, packageDir: string): Promise<{
    fileDiffs: FileDiff[];
    summary: ScanSummary;
  }>;
}

export interface IASTAnalyzer {
  analyzeFile(filePath: string, content: string): Promise<SecurityFlag[]>;
}

export interface IEntropyScanner {
  calculateEntropy(content: string | Buffer): number;
  scanForObfuscation(filePath: string, content: string): SecurityFlag[];
}

export interface IAIExplainer {
  explain(
    target: ScanTarget,
    diffs: FileDiff[],
    flags: SecurityFlag[],
    summary: ScanSummary
  ): Promise<AIVerdict>;
}
