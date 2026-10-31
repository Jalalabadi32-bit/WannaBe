import fsp from 'node:fs/promises';
import path from 'node:path';
import type { ISourceFetcher, ISandboxManager } from '../interfaces.js';
import { SandboxManager } from '../sandbox/extractor.js';
import { createGitBreaker } from '../resilience/circuit-breaker.js';
import type CircuitBreaker from 'opossum';

export interface GitFetcherOptions {
  githubToken?: string;
  fetchFn?: typeof fetch;
  sandbox?: ISandboxManager;
  useBreaker?: boolean;
}

export class GitFetcher implements ISourceFetcher {
  private token?: string;
  private fetch: typeof fetch;
  private sandbox: ISandboxManager;
  private breaker?: CircuitBreaker<[string, RequestInit?], Response>;

  constructor(options: GitFetcherOptions = {}) {
    this.token = options.githubToken ?? process.env['GITHUB_TOKEN'];
    this.fetch = options.fetchFn ?? globalThis.fetch;
    this.sandbox = options.sandbox ?? new SandboxManager();

    if (options.useBreaker) {
      this.breaker = createGitBreaker(async (url: string, init?: RequestInit) => {
        return this.fetch(url, init);
      });
    }
  }

  private async executeFetch(url: string, init?: RequestInit): Promise<Response> {
    if (this.breaker) {
      return this.breaker.fire(url, init);
    }
    return this.fetch(url, init);
  }

  async fetchSource(repoUrl: string, gitTag: string, destinationDir: string): Promise<void> {
    const { owner, repo } = this.parseGitHubUrl(repoUrl);
    const archiveUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(gitTag)}`;

    const headers: Record<string, string> = {
      'User-Agent': 'WANNABE-Supply-Chain-Verifier/0.1.0',
      Accept: 'application/vnd.github+json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await this.executeFetch(archiveUrl, { headers });
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Git release tag ${gitTag} not found for repository ${owner}/${repo}`);
      }
      throw new Error(`Failed to fetch GitHub repository source for ${owner}/${repo}@${gitTag}: HTTP ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const tempTarPath = path.join(destinationDir, `__source_${Date.now()}.tar.gz`);

    await fsp.mkdir(destinationDir, { recursive: true });
    await fsp.writeFile(tempTarPath, Buffer.from(arrayBuffer));

    try {
      // Extract into a staging subfolder to unwrap GitHub's top-level directory prefix
      const stagingDir = path.join(destinationDir, '__staging');
      await fsp.mkdir(stagingDir, { recursive: true });

      await this.sandbox.safeExtractTarball(tempTarPath, stagingDir);

      // Unwrap root directory if GitHub tarball contains a single parent folder
      const entries = await fsp.readdir(stagingDir);
      if (entries.length === 1) {
        const singleEntry = path.join(stagingDir, entries[0]!);
        const stat = await fsp.stat(singleEntry);
        if (stat.isDirectory()) {
          const innerFiles = await fsp.readdir(singleEntry);
          for (const file of innerFiles) {
            await fsp.rename(path.join(singleEntry, file), path.join(destinationDir, file));
          }
          await fsp.rm(stagingDir, { recursive: true, force: true });
          return;
        }
      }

      // If multiple root files, move everything directly
      for (const entry of entries) {
        await fsp.rename(path.join(stagingDir, entry), path.join(destinationDir, entry));
      }
      await fsp.rm(stagingDir, { recursive: true, force: true });
    } finally {
      await fsp.rm(tempTarPath, { force: true });
    }
  }

  private parseGitHubUrl(url: string): { owner: string; repo: string } {
    const cleaned = url
      .replace(/^git\+/, '')
      .replace(/\.git$/, '')
      .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
      .replace(/^git@github\.com:/, 'https://github.com/');

    const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Invalid GitHub repository URL: ${url}`);
    }

    return {
      owner: match[1],
      repo: match[2]
    };
  }
}
