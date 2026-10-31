import fsp from 'node:fs/promises';
import path from 'node:path';
import type { IPackageFetcher } from '../interfaces.js';
import type { ICacheStore } from '../cache/index.js';
import { createNpmBreaker } from '../resilience/circuit-breaker.js';
import type CircuitBreaker from 'opossum';

export interface NpmFetcherOptions {
  registryUrl?: string;
  fetchFn?: typeof fetch;
  cache?: ICacheStore;
  useBreaker?: boolean;
}

export class NpmFetcher implements IPackageFetcher {
  private registryUrl: string;
  private fetch: typeof fetch;
  private cache?: ICacheStore;
  private breaker?: CircuitBreaker<[string, RequestInit?], Response>;

  constructor(options: NpmFetcherOptions = {}) {
    this.registryUrl = (options.registryUrl ?? 'https://registry.npmjs.org').replace(/\/$/, '');
    this.fetch = options.fetchFn ?? globalThis.fetch;
    this.cache = options.cache;

    if (options.useBreaker) {
      this.breaker = createNpmBreaker(async (url: string, init?: RequestInit) => {
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

  async fetchTarball(packageName: string, version: string, destinationDir: string): Promise<string> {
    const encodedName = packageName.startsWith('@')
      ? `@${encodeURIComponent(packageName.slice(1))}`
      : encodeURIComponent(packageName);

    const metaUrl = `${this.registryUrl}/${encodedName}/${encodeURIComponent(version)}`;
    const cacheKey = `npm:meta:${packageName}:${version}`;

    let metadata: { dist?: { tarball?: string } } | null = null;
    if (this.cache) {
      metadata = await this.cache.get<{ dist?: { tarball?: string } }>(cacheKey);
    }

    if (!metadata) {
      const metaRes = await this.executeFetch(metaUrl);

      if (!metaRes.ok) {
        if (metaRes.status === 404) {
          throw new Error(`Package ${packageName}@${version} was not found on registry ${this.registryUrl}`);
        }
        throw new Error(`Failed to fetch metadata for ${packageName}@${version}: HTTP ${metaRes.status}`);
      }

      metadata = (await metaRes.json()) as { dist?: { tarball?: string } };
      if (this.cache && metadata) {
        await this.cache.set(cacheKey, metadata, 86400); // cache for 24 hours
      }
    }

    const tarballUrl = metadata?.dist?.tarball;
    if (!tarballUrl) {
      throw new Error(`Package metadata for ${packageName}@${version} is missing dist.tarball`);
    }

    const tarballRes = await this.executeFetch(tarballUrl);
    if (!tarballRes.ok) {
      throw new Error(`Failed to download tarball from ${tarballUrl}: HTTP ${tarballRes.status}`);
    }

    const arrayBuffer = await tarballRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fsp.mkdir(destinationDir, { recursive: true });
    const safeFilename = `${packageName.replace(/\//g, '__')}-${version}.tgz`;
    const targetPath = path.join(destinationDir, safeFilename);

    await fsp.writeFile(targetPath, buffer);
    return targetPath;
  }
}
