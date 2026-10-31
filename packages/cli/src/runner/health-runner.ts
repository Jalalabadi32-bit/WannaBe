import os from 'node:os';
import fsp from 'node:fs/promises';
import path from 'node:path';

export interface HealthStatusResult {
  ollama: {
    status: 'available' | 'offline';
    url: string;
    details: string;
  };
  sandbox: {
    status: 'ready' | 'error';
    directory: string;
    details: string;
  };
  healthy: boolean;
}

export async function runHealthCheck(ollamaHost: string = 'http://localhost:11434'): Promise<HealthStatusResult> {
  // 1. Check Ollama API
  let ollamaStatus: 'available' | 'offline' = 'offline';
  let ollamaDetails = '';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${ollamaHost.replace(/\/$/, '')}/api/tags`, {
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      ollamaStatus = 'available';
      ollamaDetails = 'Ollama inference service reachable';
    } else {
      ollamaDetails = `Ollama returned HTTP ${res.status}`;
    }
  } catch {
    ollamaDetails = 'Ollama endpoint unreachable (rule-based heuristic fallback active)';
  }

  // 2. Check Sandbox filesystem permissions
  let sandboxStatus: 'ready' | 'error' = 'ready';
  let sandboxDetails = 'Temporary staging workspace permissions verified';
  const testDir = path.join(os.tmpdir(), `wannabe-health-${Date.now()}`);

  try {
    await fsp.mkdir(testDir, { recursive: true });
    const probeFile = path.join(testDir, 'probe.txt');
    await fsp.writeFile(probeFile, 'wannabe-health-check', 'utf8');
    await fsp.rm(testDir, { recursive: true, force: true });
  } catch (err: unknown) {
    sandboxStatus = 'error';
    sandboxDetails = err instanceof Error ? err.message : String(err);
  }

  return {
    ollama: {
      status: ollamaStatus,
      url: ollamaHost,
      details: ollamaDetails
    },
    sandbox: {
      status: sandboxStatus,
      directory: os.tmpdir(),
      details: sandboxDetails
    },
    healthy: sandboxStatus === 'ready'
  };
}
