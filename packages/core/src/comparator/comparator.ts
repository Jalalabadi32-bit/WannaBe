import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  FileDiff,
  ScanSummary,
  SecurityFlag
} from '@wannabe/shared';
import type { IComparatorEngine } from '../interfaces.js';

export interface FileEntry {
  relativePath: string;
  absolutePath: string;
  sha256: string;
  sizeBytes: number;
}

const DANGEROUS_HOOKS = [
  'preinstall',
  'install',
  'postinstall',
  'preuninstall',
  'postuninstall'
] as const;

export class GhostCodeComparator implements IComparatorEngine {
  async compareDirectories(
    sourceDir: string,
    packageDir: string
  ): Promise<{ fileDiffs: FileDiff[]; summary: ScanSummary }> {
    const canonicalSource = path.resolve(sourceDir);
    let canonicalPackage = path.resolve(packageDir);

    // Standard npm packages extract with an internal "package/" directory
    const innerPackageDir = path.join(canonicalPackage, 'package');
    if (fs.existsSync(innerPackageDir) && (await fsp.stat(innerPackageDir)).isDirectory()) {
      canonicalPackage = innerPackageDir;
    }

    const sourceMap = await this.scanDirectory(canonicalSource);
    const packageMap = await this.scanDirectory(canonicalPackage);

    const fileDiffs: FileDiff[] = [];
    const allPaths = new Set([...sourceMap.keys(), ...packageMap.keys()]);

    for (const relPath of Array.from(allPaths).sort()) {
      const sourceFile = sourceMap.get(relPath);
      const pkgFile = packageMap.get(relPath);
      const flags: SecurityFlag[] = [];

      if (sourceFile && pkgFile) {
        if (sourceFile.sha256 === pkgFile.sha256) {
          fileDiffs.push({
            path: relPath,
            status: 'identical',
            sourceSha256: sourceFile.sha256,
            packageSha256: pkgFile.sha256,
            sizeDiffBytes: 0,
            flags: []
          });
        } else {
          // File content differs
          fileDiffs.push({
            path: relPath,
            status: 'modified',
            sourceSha256: sourceFile.sha256,
            packageSha256: pkgFile.sha256,
            sizeDiffBytes: pkgFile.sizeBytes - sourceFile.sizeBytes,
            flags: []
          });
        }
      } else if (pkgFile && !sourceFile) {
        // File exists only in published package
        const isArtifact = this.isExpectedBuildArtifact(relPath, sourceMap);
        const entropy = await this.calculateFileEntropy(pkgFile.absolutePath);

        if (isArtifact) {
          fileDiffs.push({
            path: relPath,
            status: 'expected_build_artifact',
            packageSha256: pkgFile.sha256,
            sizeDiffBytes: pkgFile.sizeBytes,
            entropy,
            flags: []
          });
        } else {
          // Ghost code detected
          const ext = path.extname(relPath).toLowerCase();
          const isScriptOrBinary = ['.sh', '.bash', '.node', '.exe', '.dll', '.so', '.dylib'].includes(ext);

          flags.push({
            ruleId: 'WANNABE-GHOST-CODE',
            severity: isScriptOrBinary ? 'critical' : 'high',
            category: isScriptOrBinary ? 'unmapped_binary' : 'manifest_drift',
            message: `Ghost code: File "${relPath}" is published in the package tarball but has no provenance in source git repository.`,
            filePath: relPath
          });

          if (entropy > 5.5) {
            flags.push({
              ruleId: 'WANNABE-HIGH-ENTROPY',
              severity: 'medium',
              category: 'entropy_obfuscation',
              message: `High Shannon entropy (${entropy.toFixed(2)}) indicates packed or obfuscated payload in ghost file "${relPath}".`,
              filePath: relPath
            });
          }

          fileDiffs.push({
            path: relPath,
            status: 'added_in_package',
            packageSha256: pkgFile.sha256,
            sizeDiffBytes: pkgFile.sizeBytes,
            entropy,
            flags
          });
        }
      } else if (sourceFile && !pkgFile) {
        // File exists in source, omitted from package
        fileDiffs.push({
          path: relPath,
          status: 'missing_in_package',
          sourceSha256: sourceFile.sha256,
          sizeDiffBytes: -sourceFile.sizeBytes,
          flags: []
        });
      }
    }

    // Inspect package.json lifecycle hooks drift
    await this.inspectManifestDrift(canonicalSource, canonicalPackage, fileDiffs);

    const summary = this.computeSummary(sourceMap.size, packageMap.size, fileDiffs);

    return { fileDiffs, summary };
  }

  private async scanDirectory(baseDir: string): Promise<Map<string, FileEntry>> {
    const map = new Map<string, FileEntry>();
    if (!fs.existsSync(baseDir)) return map;

    const walk = async (currentDir: string) => {
      const entries = await fsp.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          const content = await fsp.readFile(fullPath);
          const sha256 = crypto.createHash('sha256').update(content).digest('hex');

          map.set(relativePath, {
            relativePath,
            absolutePath: fullPath,
            sha256,
            sizeBytes: content.byteLength
          });
        }
      }
    };

    await walk(baseDir);
    return map;
  }

  private isExpectedBuildArtifact(
    packagePath: string,
    sourceMap: Map<string, FileEntry>
  ): boolean {
    // TypeScript/Babel compilation mappings (dist/x.js -> src/x.ts)
    if (packagePath.endsWith('.d.ts') || packagePath.endsWith('.map')) {
      return true;
    }

    if (packagePath.startsWith('dist/') || packagePath.startsWith('lib/') || packagePath.startsWith('build/')) {
      const sub = packagePath.replace(/^(dist|lib|build)\//, '');
      const sourceTs = `src/${sub.replace(/\.js$/, '.ts')}`;
      const sourceTsx = `src/${sub.replace(/\.js$/, '.tsx')}`;
      const rootTs = sub.replace(/\.js$/, '.ts');

      if (sourceMap.has(sourceTs) || sourceMap.has(sourceTsx) || sourceMap.has(rootTs)) {
        return true;
      }
    }

    return false;
  }

  private async inspectManifestDrift(
    sourceDir: string,
    packageDir: string,
    diffs: FileDiff[]
  ): Promise<void> {
    const sourcePkgJsonPath = path.join(sourceDir, 'package.json');
    const pkgPkgJsonPath = path.join(packageDir, 'package.json');

    if (!fs.existsSync(sourcePkgJsonPath) || !fs.existsSync(pkgPkgJsonPath)) {
      return;
    }

    try {
      const sourcePkg = JSON.parse(await fsp.readFile(sourcePkgJsonPath, 'utf-8')) as {
        scripts?: Record<string, string>;
      };
      const packagePkg = JSON.parse(await fsp.readFile(pkgPkgJsonPath, 'utf-8')) as {
        scripts?: Record<string, string>;
      };

      const sourceScripts = sourcePkg.scripts ?? {};
      const packageScripts = packagePkg.scripts ?? {};

      const manifestDiff = diffs.find((d) => d.path === 'package.json');

      for (const hook of DANGEROUS_HOOKS) {
        const pkgScript = packageScripts[hook];
        const sourceScript = sourceScripts[hook];

        if (pkgScript && !sourceScript) {
          const flag: SecurityFlag = {
            ruleId: 'WANNABE-UNCOMMITTED-HOOK',
            severity: 'critical',
            category: 'lifecycle_hook',
            message: `Poisoned manifest: Uncommitted lifecycle hook "${hook}" found in published package.json: "${pkgScript}"`,
            filePath: 'package.json',
            snippet: `"${hook}": "${pkgScript}"`
          };

          if (manifestDiff) {
            manifestDiff.flags.push(flag);
          } else {
            diffs.push({
              path: 'package.json',
              status: 'modified',
              sizeDiffBytes: 0,
              flags: [flag]
            });
          }
        } else if (pkgScript && sourceScript && pkgScript !== sourceScript) {
          const flag: SecurityFlag = {
            ruleId: 'WANNABE-MODIFIED-HOOK',
            severity: 'high',
            category: 'lifecycle_hook',
            message: `Modified lifecycle hook "${hook}": source executes "${sourceScript}", but package executes "${pkgScript}"`,
            filePath: 'package.json',
            snippet: `"${hook}": "${pkgScript}"`
          };

          if (manifestDiff) {
            manifestDiff.flags.push(flag);
          }
        }
      }
    } catch {
      // Manifest parsing failed or malformed JSON
    }
  }

  private async calculateFileEntropy(filePath: string): Promise<number> {
    try {
      const buffer = await fsp.readFile(filePath);
      if (buffer.length === 0) return 0;

      const freqs = new Map<number, number>();
      for (const byte of buffer) {
        freqs.set(byte, (freqs.get(byte) ?? 0) + 1);
      }

      let entropy = 0;
      const len = buffer.length;
      for (const count of freqs.values()) {
        const p = count / len;
        entropy -= p * Math.log2(p);
      }
      return entropy;
    } catch {
      return 0;
    }
  }

  private computeSummary(
    totalSource: number,
    totalPackage: number,
    diffs: FileDiff[]
  ): ScanSummary {
    let matched = 0;
    let modified = 0;
    let added = 0;
    let missing = 0;
    let expected = 0;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;

    for (const d of diffs) {
      if (d.status === 'identical') matched += 1;
      else if (d.status === 'modified') modified += 1;
      else if (d.status === 'added_in_package') added += 1;
      else if (d.status === 'missing_in_package') missing += 1;
      else if (d.status === 'expected_build_artifact') expected += 1;

      for (const f of d.flags) {
        if (f.severity === 'critical') critical += 1;
        else if (f.severity === 'high') high += 1;
        else if (f.severity === 'medium') medium += 1;
        else if (f.severity === 'low') low += 1;
        else if (f.severity === 'info') info += 1;
      }
    }

    return {
      totalFilesSource: totalSource,
      totalFilesPackage: totalPackage,
      matchedFiles: matched,
      modifiedFiles: modified,
      addedFiles: added,
      missingFiles: missing,
      expectedArtifacts: expected,
      criticalFlags: critical,
      highFlags: high,
      mediumFlags: medium,
      lowFlags: low,
      infoFlags: info
    };
  }
}
