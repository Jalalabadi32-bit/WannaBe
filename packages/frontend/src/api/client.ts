import type { ScanReport, ScanTarget, ScanStatus } from '@wannabe/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY ?? 'wannabe-dev-api-key';

export interface HealthStatus {
  online: boolean;
  checks?: {
    sandboxStorage?: string;
    aiExplainer?: string;
    cacheStore?: string;
  };
}

export interface ScanStatusResponse {
  scanId: string;
  id: string;
  status: ScanStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface RecentScansResponse {
  total: number;
  limit: number;
  offset: number;
  items: ScanReport[];
}

// TODO: track future WebSocket / SSE streaming connection for live scan event logs
class ApiClient {
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    };
  }

  async checkHealth(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${API_BASE}/readyz`, {
        headers: this.getHeaders()
      });
      if (!res.ok) {
        return { online: false };
      }
      const data = await res.json();
      return {
        online: true,
        checks: data.checks
      };
    } catch {
      return { online: false };
    }
  }

  async triggerScan(target: ScanTarget): Promise<{ scanId: string; status: ScanStatus; message: string }> {
    const res = await fetch(`${API_BASE}/api/v1/scans`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(target)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Failed to initiate scan');
    }

    return res.json();
  }

  async getScanStatus(scanId: string): Promise<ScanStatusResponse> {
    const res = await fetch(`${API_BASE}/api/v1/scans/${encodeURIComponent(scanId)}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Failed to retrieve scan status');
    }

    return res.json();
  }

  async getScanReport(scanId: string): Promise<ScanReport> {
    const res = await fetch(`${API_BASE}/api/v1/scans/${encodeURIComponent(scanId)}/report`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Failed to retrieve scan report');
    }

    return res.json();
  }

  async listRecentScans(): Promise<ScanReport[]> {
    try {
      const res = await fetch(`${API_BASE}/api/v1/scans?limit=15`, {
        headers: this.getHeaders()
      });

      if (!res.ok) {
        return [];
      }

      const data: RecentScansResponse = await res.json();
      return data.items ?? [];
    } catch {
      return [];
    }
  }
}

export const apiClient = new ApiClient();
