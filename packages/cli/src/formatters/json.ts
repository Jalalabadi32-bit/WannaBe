import type { ScanReport } from '@wannabe/shared';

export function formatJson(report: ScanReport): string {
  return JSON.stringify(report, null, 2);
}
