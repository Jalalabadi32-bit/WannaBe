import { randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { ScanReport, ScanTarget, FileDiff, SecurityFlag } from '@wannabe/shared';
import {
  SandboxManager,
  NpmFetcher,
  GitFetcher,
  GhostCodeComparator,
  ASTAnalyzer,
  EntropyScanner,
  HybridAIExplainer,
  SecurityError
} from '@wannabe/core';

export interface ScanExecutionOptions {
  packageName: string;
  version: string;
  repoUrl?: string;
  gitTag?: string;
  format?: 'table' | 'json' | 'sarif';
  outputPath?: string;
  failOn?: 'never' | 'warning' | 'critical';
  ollamaHost?: string;
  offline?: boolean;
  verbose?: boolean;
}

export interface ScanExecutionResult {
  report: ScanReport;
  exitCode: number;
}

export class CLIExecutionError extends Error {
  public exitCode: number;
  constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'CLIExecutionError';
    this.exitCode = exitCode;
  }
}

export function computeExitCode(flags: SecurityFlag[], failOn: 'never' | 'warning' | 'critical' = 'critical'): number {
  if (failOn === 'never') {
    return 0;
  }

  const hasCritical = flags.some((f) => f.severity === 'critical');
  const hasWarning = flags.some((f) => f.severity === 'high' || f.severity === 'medium');

  if (failOn === 'critical' && hasCritical) {
    return 4;
  }

  if (failOn === 'warning' && (hasCritical || hasWarning)) {
    return 4;
  }

  return 0;
}

export async function runScanCli(options: ScanExecutionOptions): Promise<ScanExecutionResult> {
  const scanId = randomUUID();
  const startedAt = new Date().toISOString();

  const target: ScanTarget = {
    packageName: options.packageName,
    version: options.version,
    repoUrl: options.repoUrl,
    gitTag: options.gitTag
  };

  const log = (msg: string) => {
    if (options.verbose) {
      process.stderr.write(`[wannabe:debug] ${msg}\n`);
    }
  };

  log(`Initiating scan for ${target.packageName}@${target.version} (scanId: ${scanId})`);

  const sandbox = new SandboxManager();
  const workspace = await sandbox.createWorkspace(scanId);

  try {
    // 1. Fetch npm package tarball
    log(`Fetching npm tarball for ${target.packageName}@${target.version}...`);
    const npmFetcher = new NpmFetcher();
    let tarballPath: string;
    try {
      tarballPath = await npmFetcher.fetchTarball(target.packageName, target.version, workspace.packageDir);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new CLIExecutionError(`npm package retrieval failed: ${msg}`, 2);
    }

    // 2. Safe extraction with Zip-Slip protection
    log(`Safely extracting package tarball to ${workspace.packageDir}...`);
    try {
      await sandbox.safeExtractTarball(tarballPath, workspace.packageDir);
    } catch (err: unknown) {
      if (err instanceof SecurityError || (err as { name?: string })?.name === 'SecurityError') {
        throw new CLIExecutionError(`Security violation during extraction: ${(err as Error).message}`, 3);
      }
      throw err;
    }

    // 3. Auto-discover GitHub repo URL from package.json if omitted
    if (!target.repoUrl) {
      try {
        const pkgJsonPath = path.join(workspace.packageDir, 'package.json');
        const pkgRaw = await fsp.readFile(pkgJsonPath, 'utf8');
        const pkgData = JSON.parse(pkgRaw) as { repository?: string | { url?: string } };
        let repo = typeof pkgData.repository === 'string' ? pkgData.repository : pkgData.repository?.url;
        if (repo) {
          if (repo.startsWith('git+')) repo = repo.slice(4);
          if (repo.startsWith('git://')) repo = 'https://' + repo.slice(6);
          if (repo.endsWith('.git')) repo = repo.slice(0, -4);
          if (repo.startsWith('ssh://git@github.com/')) repo = 'https://github.com/' + repo.slice(22);
          target.repoUrl = repo;
          log(`Discovered repository URL from package.json: ${target.repoUrl}`);
        }
      } catch {
        log('Could not automatically determine repository URL from package.json.');
      }
    }

    // 4. Auto-discover Git release tag if omitted
    if (!target.gitTag) {
      target.gitTag = `v${target.version}`;
      log(`Defaulting release tag to ${target.gitTag}`);
    }

    // 5. Fetch GitHub source repository
    if (target.repoUrl && target.gitTag) {
      log(`Fetching Git source from ${target.repoUrl} at tag ${target.gitTag}...`);
      const gitFetcher = new GitFetcher();
      try {
        await gitFetcher.fetchSource(target.repoUrl, target.gitTag, workspace.sourceDir);
      } catch (err: unknown) {
        // If git fetch fails, try fallback to version without 'v' prefix if applicable
        if (target.gitTag.startsWith('v')) {
          const alternateTag = target.gitTag.slice(1);
          log(`Tag ${target.gitTag} failed, attempting alternate tag ${alternateTag}...`);
          try {
            await gitFetcher.fetchSource(target.repoUrl, alternateTag, workspace.sourceDir);
            target.gitTag = alternateTag;
          } catch {
            const msg = err instanceof Error ? err.message : String(err);
            throw new CLIExecutionError(`Git source retrieval failed: ${msg}`, 2);
          }
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          throw new CLIExecutionError(`Git source retrieval failed: ${msg}`, 2);
        }
      }
    }

    // 6. Tree comparison
    log('Comparing source and package directories...');
    const comparator = new GhostCodeComparator();
    const { fileDiffs, summary } = await comparator.compareDirectories(workspace.sourceDir, workspace.packageDir);

    // 7. AST & Shannon Entropy analysis on JS/TS files
    log('Running AST security rules and Shannon entropy scanner...');
    const astAnalyzer = new ASTAnalyzer();
    const entropyScanner = new EntropyScanner();

    for (const diff of fileDiffs) {
      if (diff.status === 'missing_in_package') continue;
      const ext = diff.path.split('.').pop()?.toLowerCase() ?? '';
      if (!['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx'].includes(ext)) continue;

      const absPath = path.join(workspace.packageDir, diff.path);
      let content: string;
      try {
        content = await fsp.readFile(absPath, 'utf8');
      } catch {
        continue;
      }

      const astFlags = await astAnalyzer.analyzeFile(diff.path, content);
      const entropyFlags = entropyScanner.scanForObfuscation(diff.path, content);
      diff.flags = [...(diff.flags ?? []), ...astFlags, ...entropyFlags];
    }

    const allFlags = fileDiffs.flatMap((d: FileDiff) => d.flags ?? []);

    // 8. AI explanation & threat narrative
    log('Generating security explanation verdict...');
    const explainer = new HybridAIExplainer({
      ollamaHost: options.ollamaHost,
      forceDeterministic: options.offline
    });
    const aiVerdict = await explainer.explain(target, fileDiffs, allFlags, summary);

    const completedAt = new Date().toISOString();

    const report: ScanReport = {
      id: scanId,
      target,
      status: 'completed',
      startedAt,
      completedAt,
      summary,
      fileDiffs,
      flags: allFlags,
      aiVerdict
    };

    const exitCode = computeExitCode(allFlags, options.failOn ?? 'critical');
    log(`Scan completed with exit code ${exitCode}.`);

    return {
      report,
      exitCode
    };
  } finally {
    log('Cleaning up ephemeral workspace...');
    await workspace.cleanup();
  }
}
