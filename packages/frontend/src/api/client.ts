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

// SSE streaming is implemented via GET /api/v1/scans/:id/stream using the native EventSource API.
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

  /**
   * Open a Server-Sent Events stream for live scan progress updates.
   *
   * Calls onStatus on every progress frame. Calls onClose when the scan
   * reaches a terminal state (completed / failed) or the connection drops.
   *
   * Returns a cleanup function — call it to close the EventSource manually
   * (e.g., on React component unmount).
   */
  streamScanProgress(
    scanId: string,
    onStatus: (status: ScanStatus) => void,
    onClose: () => void
  ): () => void {
    const url = `${API_BASE}/api/v1/scans/${encodeURIComponent(scanId)}/stream`;
    const es = new EventSource(url);

    es.onmessage = (event: MessageEvent) => {
      try {
        const { status } = JSON.parse(event.data as string) as { scanId: string; status: ScanStatus };
        onStatus(status);
        if (status === 'completed' || status === 'failed') {
          es.close();
          onClose();
        }
      } catch {
        // malformed frame — ignore
      }
    };

    es.onerror = () => {
      es.close();
      onClose();
    };

    return () => es.close();
  }
}

export const apiClient = new ApiClient();
