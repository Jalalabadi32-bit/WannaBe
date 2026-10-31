import fsp from 'node:fs/promises';
import path from 'node:path';
import type { IPackageFetcher } from '../interfaces.js';

export interface NpmFetcherOptions {
  registryUrl?: string;
  fetchFn?: typeof fetch;
}

export class NpmFetcher implements IPackageFetcher {
  private registryUrl: string;
  private fetch: typeof fetch;

  constructor(options: NpmFetcherOptions = {}) {
    this.registryUrl = (options.registryUrl ?? 'https://registry.npmjs.org').replace(/\/$/, '');
    this.fetch = options.fetchFn ?? globalThis.fetch;
  }

  async fetchTarball(packageName: string, version: string, destinationDir: string): Promise<string> {
    const encodedName = packageName.startsWith('@')
      ? `@${encodeURIComponent(packageName.slice(1))}`
      : encodeURIComponent(packageName);

    const metaUrl = `${this.registryUrl}/${encodedName}/${encodeURIComponent(version)}`;
    const metaRes = await this.fetch(metaUrl);

    if (!metaRes.ok) {
      if (metaRes.status === 404) {
        throw new Error(`Package ${packageName}@${version} was not found on registry ${this.registryUrl}`);
      }
      throw new Error(`Failed to fetch metadata for ${packageName}@${version}: HTTP ${metaRes.status}`);
    }

    const metadata = (await metaRes.json()) as { dist?: { tarball?: string } };
    const tarballUrl = metadata.dist?.tarball;

    if (!tarballUrl) {
      throw new Error(`Package metadata for ${packageName}@${version} is missing dist.tarball`);
    }

    const tarballRes = await this.fetch(tarballUrl);
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
