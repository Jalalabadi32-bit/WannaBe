import type { ScanReport, ScanTarget, AuthUser } from '@wannabe/shared';

export interface ServerConfig {
  host: string;
  port: number;
  jwtSecret: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

export interface IScanService {
  createScan(target: ScanTarget, user?: AuthUser): Promise<string>;
  getScanStatus(scanId: string): Promise<ScanReport | null>;
  listScans(limit?: number, offset?: number): Promise<ScanReport[]>;
}

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  host: '0.0.0.0',
  port: 3000,
  jwtSecret: process.env['JWT_SECRET'] ?? 'wannabe-dev-insecure-secret-key-change-in-prod',
  logLevel: 'info'
};
