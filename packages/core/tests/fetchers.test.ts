import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as tar from 'tar';
import { NpmFetcher } from '../src/retrieval/npm-fetcher.js';
import { GitFetcher } from '../src/retrieval/git-fetcher.js';

describe('NpmFetcher', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wannabe-npm-test-'));
  });

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  it('downloads tarball successfully when metadata and tarball respond with 200', async () => {
    const rawString = 'fake-tarball-bytes';
    const mockBytes = new TextEncoder().encode(rawString);

    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/chalk/5.3.0')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            dist: { tarball: 'https://registry.npmjs.org/chalk/-/chalk-5.3.0.tgz' }
          })
        } as unknown as Response;
      }
      if (urlStr.endsWith('chalk-5.3.0.tgz')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => mockBytes.buffer.slice(mockBytes.byteOffset, mockBytes.byteOffset + mockBytes.byteLength)
        } as unknown as Response;
      }
      return { ok: false, status: 404 } as unknown as Response;
    };

    const fetcher = new NpmFetcher({ fetchFn: mockFetch });
    const downloadedPath = await fetcher.fetchTarball('chalk', '5.3.0', tempDir);

    expect(downloadedPath).toContain('chalk-5.3.0.tgz');
    const content = await fsp.readFile(downloadedPath, 'utf-8');
    expect(content).toBe(rawString);
  });

  it('throws an informative error if package version is not found (404)', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 404
    } as unknown as Response);

    const fetcher = new NpmFetcher({ fetchFn: mockFetch });
    await expect(fetcher.fetchTarball('chalk', '99.9.9', tempDir)).rejects.toThrow(
      'Package chalk@99.9.9 was not found'
    );
  });

  it('throws error if metadata response is missing dist.tarball', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ dist: {} })
    } as unknown as Response);

    const fetcher = new NpmFetcher({ fetchFn: mockFetch });
    await expect(fetcher.fetchTarball('invalid-pkg', '1.0.0', tempDir)).rejects.toThrow(
      'missing dist.tarball'
    );
  });
});

describe('GitFetcher', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wannabe-git-test-'));
  });

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  it('fetches and unwraps GitHub release archive', async () => {
    // Create a synthetic GitHub tarball with an internal root directory (e.g., repo-v1.0.0/)
    const srcDir = path.join(tempDir, 'sample_src');
    const innerDir = path.join(srcDir, 'chalk-5.3.0');
    await fsp.mkdir(innerDir, { recursive: true });
    await fsp.writeFile(path.join(innerDir, 'index.ts'), 'export const red = () => {};');
    await fsp.writeFile(path.join(innerDir, 'package.json'), '{"name":"chalk"}');

    const tarGzPath = path.join(tempDir, 'github.tar.gz');
    await tar.c({ file: tarGzPath, cwd: srcDir, gzip: true }, ['chalk-5.3.0']);

    const tarBytes = await fsp.readFile(tarGzPath);

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => tarBytes.buffer
    } as unknown as Response);

    const gitFetcher = new GitFetcher({ fetchFn: mockFetch });
    const destDir = path.join(tempDir, 'dest');

    await gitFetcher.fetchSource('https://github.com/chalk/chalk', 'v5.3.0', destDir);

    // Verify files were unwrapped directly into destDir
    const indexContent = await fsp.readFile(path.join(destDir, 'index.ts'), 'utf-8');
    expect(indexContent).toContain('export const red');
  });

  it('throws 404 error when release tag is missing', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 404
    } as unknown as Response);

    const gitFetcher = new GitFetcher({ fetchFn: mockFetch });
    await expect(
      gitFetcher.fetchSource('https://github.com/chalk/chalk', 'missing-tag', tempDir)
    ).rejects.toThrow('Git release tag missing-tag not found');
  });

  it('parses various GitHub URL formats cleanly', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 404
    } as unknown as Response);

    const gitFetcher = new GitFetcher({ fetchFn: mockFetch });

    // Valid URLs fail at network step (404), proving regex matched owner and repo
    await expect(
      gitFetcher.fetchSource('git+https://github.com/user/project.git', 'v1.0.0', tempDir)
    ).rejects.toThrow('Git release tag v1.0.0 not found for repository user/project');

    // Invalid URL throws parse error
    await expect(
      gitFetcher.fetchSource('https://gitlab.com/other/project', 'v1.0.0', tempDir)
    ).rejects.toThrow('Invalid GitHub repository URL');
  });
});
