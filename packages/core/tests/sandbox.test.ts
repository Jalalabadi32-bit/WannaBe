import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as tar from 'tar';
import { SandboxManager, SecurityError } from '../src/sandbox/extractor.js';

describe('SandboxManager & Safe Extractor', () => {
  let tempDir: string;
  let sandbox: SandboxManager;

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wannabe-test-'));
    sandbox = new SandboxManager(tempDir);
  });

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  it('creates isolated workspaces with source and package directories', async () => {
    const ws = await sandbox.createWorkspace('test-scan-1');
    expect(ws.sourceDir).toContain('source');
    expect(ws.packageDir).toContain('package');

    const sourceStat = await fsp.stat(ws.sourceDir);
    const pkgStat = await fsp.stat(ws.packageDir);
    expect(sourceStat.isDirectory()).toBe(true);
    expect(pkgStat.isDirectory()).toBe(true);

    await ws.cleanup();
    const exists = await fsp.stat(path.dirname(ws.sourceDir)).catch(() => false);
    expect(exists).toBe(false);
  });

  it('safely extracts a valid tarball archive', async () => {
    const sampleDir = path.join(tempDir, 'sample');
    await fsp.mkdir(sampleDir, { recursive: true });
    await fsp.writeFile(path.join(sampleDir, 'index.js'), 'console.log("hello");');
    await fsp.writeFile(path.join(sampleDir, 'package.json'), '{"name":"test"}');

    const tarPath = path.join(tempDir, 'sample.tar');
    await tar.c({ file: tarPath, cwd: sampleDir }, ['index.js', 'package.json']);

    const extractDest = path.join(tempDir, 'extracted');
    await sandbox.safeExtractTarball(tarPath, extractDest);

    const extractedIndex = await fsp.readFile(path.join(extractDest, 'index.js'), 'utf-8');
    expect(extractedIndex).toBe('console.log("hello");');
  });

  it('blocks Zip-Slip path traversal attempts in tarball entries', async () => {
    const maliciousDir = path.join(tempDir, 'malicious');
    await fsp.mkdir(maliciousDir, { recursive: true });
    await fsp.writeFile(path.join(maliciousDir, 'evil.txt'), 'owned');

    // Create tar with an entry that attempts to break out of root
    const tarPath = path.join(tempDir, 'evil.tar');
    await tar.c(
      {
        file: tarPath,
        cwd: maliciousDir,
        prefix: '../../outside'
      },
      ['evil.txt']
    );

    const extractDest = path.join(tempDir, 'safe_dest');
    await expect(sandbox.safeExtractTarball(tarPath, extractDest)).rejects.toThrow(SecurityError);
  });

  it('enforces entry count quota limits', async () => {
    const sampleDir = path.join(tempDir, 'quota_entries');
    await fsp.mkdir(sampleDir, { recursive: true });
    for (let i = 0; i < 5; i++) {
      await fsp.writeFile(path.join(sampleDir, `file_${i}.txt`), `data ${i}`);
    }

    const tarPath = path.join(tempDir, 'quota_entries.tar');
    await tar.c({ file: tarPath, cwd: sampleDir }, ['file_0.txt', 'file_1.txt', 'file_2.txt', 'file_3.txt', 'file_4.txt']);

    const extractDest = path.join(tempDir, 'quota_dest');
    await expect(
      sandbox.safeExtractTarball(tarPath, extractDest, { maxEntryCount: 3 })
    ).rejects.toThrow(SecurityError);
  });

  it('enforces decompressed byte size quota limits', async () => {
    const sampleDir = path.join(tempDir, 'quota_bytes');
    await fsp.mkdir(sampleDir, { recursive: true });
    await fsp.writeFile(path.join(sampleDir, 'big.txt'), Buffer.alloc(1024 * 50)); // 50 KB

    const tarPath = path.join(tempDir, 'quota_bytes.tar');
    await tar.c({ file: tarPath, cwd: sampleDir }, ['big.txt']);

    const extractDest = path.join(tempDir, 'quota_bytes_dest');
    await expect(
      sandbox.safeExtractTarball(tarPath, extractDest, { maxDecompressedBytes: 1024 * 10 }) // 10 KB limit
    ).rejects.toThrow(SecurityError);
  });
});
