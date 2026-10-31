import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as tar from 'tar';
import type { ISandboxManager, ExtractedWorkspace } from '../interfaces.js';

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export interface ExtractorOptions {
  maxDecompressedBytes?: number;
  maxEntryCount?: number;
  allowSymlinks?: boolean;
}

const DEFAULT_MAX_DECOMPRESSED_BYTES = 200 * 1024 * 1024; // 200 MB
const DEFAULT_MAX_ENTRY_COUNT = 10_000;

export class SandboxManager implements ISandboxManager {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.join(os.tmpdir(), 'wannabe-sandboxes');
  }

  async createWorkspace(scanId: string): Promise<ExtractedWorkspace> {
    const workspaceId = `scan-${scanId}-${Date.now()}`;
    const workspaceDir = path.join(this.baseDir, workspaceId);
    const sourceDir = path.join(workspaceDir, 'source');
    const packageDir = path.join(workspaceDir, 'package');

    await fsp.mkdir(sourceDir, { recursive: true });
    await fsp.mkdir(packageDir, { recursive: true });

    return {
      id: workspaceId,
      sourceDir,
      packageDir,
      cleanup: async () => {
        await this.cleanup(workspaceDir);
      }
    };
  }

  async safeExtractTarball(
    tarballPath: string,
    destinationDir: string,
    options: ExtractorOptions = {}
  ): Promise<void> {
    const maxBytes = options.maxDecompressedBytes ?? DEFAULT_MAX_DECOMPRESSED_BYTES;
    const maxEntries = options.maxEntryCount ?? DEFAULT_MAX_ENTRY_COUNT;
    const allowSymlinks = options.allowSymlinks ?? false;

    const canonicalDest = path.resolve(destinationDir);
    await fsp.mkdir(canonicalDest, { recursive: true });

    // Pre-flight validation: scan archive entries before writing to disk
    let totalBytes = 0;
    let entryCount = 0;
    let validationError: SecurityError | null = null;

    try {
      await tar.t({
        file: tarballPath,
        onentry: (entry) => {
          if (validationError) return;

          entryCount += 1;
          if (entryCount > maxEntries) {
            validationError = new SecurityError(
              `Archive entry count exceeds maximum limit of ${maxEntries}`
            );
            return;
          }

          totalBytes += entry.size ?? 0;
          if (totalBytes > maxBytes) {
            validationError = new SecurityError(
              `Archive decompressed size exceeds maximum limit of ${maxBytes} bytes`
            );
            return;
          }

          // Validate path traversal (Zip-Slip defense)
          const entryPath = entry.path;
          const resolvedPath = path.resolve(canonicalDest, entryPath);
          if (!resolvedPath.startsWith(canonicalDest + path.sep) && resolvedPath !== canonicalDest) {
            validationError = new SecurityError(
              `Path traversal attempt detected in archive entry: ${entryPath}`
            );
            return;
          }

          // Block symlink escapes
          if (entry.type === 'SymbolicLink' || entry.type === 'Link') {
            if (!allowSymlinks) {
              validationError = new SecurityError(
                `Symlinks are forbidden in untrusted packages: ${entryPath}`
              );
              return;
            }
            if (entry.linkpath) {
              const resolvedLink = path.resolve(path.dirname(resolvedPath), entry.linkpath);
              if (!resolvedLink.startsWith(canonicalDest + path.sep)) {
                validationError = new SecurityError(
                  `Symlink target escapes extraction sandbox: ${entry.linkpath}`
                );
                return;
              }
            }
          }
        }
      });
    } catch (err) {
      if (err instanceof SecurityError) {
        throw err;
      }
      // If tar.t itself failed with an error, wrap or rethrow
      throw err;
    }

    if (validationError) {
      throw validationError;
    }

    // Safe extraction pass
    await tar.x({
      file: tarballPath,
      cwd: canonicalDest,
      filter: (entryPath) => {
        const resolved = path.resolve(canonicalDest, entryPath);
        return resolved.startsWith(canonicalDest + path.sep) || resolved === canonicalDest;
      }
    });
  }

  async cleanup(targetDir: string): Promise<void> {
    try {
      if (fs.existsSync(targetDir)) {
        await fsp.rm(targetDir, { recursive: true, force: true });
      }
    } catch {
      // Best-effort cleanup
    }
  }
}
