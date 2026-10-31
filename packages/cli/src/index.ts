import type { ScanTarget } from '@wannabe/shared';

export interface CLIOptions {
  pkg: string;
  version: string;
  repo?: string;
  tag?: string;
  format: 'table' | 'json' | 'sarif';
  failOn: 'never' | 'warning' | 'critical';
  verbose?: boolean;
}

export function parseScanTarget(options: CLIOptions): ScanTarget {
  return {
    packageName: options.pkg,
    version: options.version,
    repoUrl: options.repo,
    gitTag: options.tag
  };
}
