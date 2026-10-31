import type { ScanReport } from '@wannabe/shared';

export interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
        rules: Array<{
          id: string;
          name: string;
          shortDescription: { text: string };
          defaultConfiguration: {
            level: 'error' | 'warning' | 'note';
          };
        }>;
      };
    };
    results: Array<{
      ruleId: string;
      level: 'error' | 'warning' | 'note';
      message: { text: string };
      locations?: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
          region?: {
            startLine: number;
            endLine: number;
            snippet?: { text: string };
          };
        };
      }>;
    }>;
  }>;
}

function mapSeverityToSarifLevel(severity: string): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    default:
      return 'note';
  }
}

export function toSarif(report: ScanReport): SarifLog {
  const ruleMap = new Map<string, { id: string; name: string; severity: string; message: string }>();

  for (const flag of report.flags) {
    if (!ruleMap.has(flag.ruleId)) {
      ruleMap.set(flag.ruleId, {
        id: flag.ruleId,
        name: flag.category,
        severity: flag.severity,
        message: flag.message
      });
    }
  }

  const sarifRules = Array.from(ruleMap.values()).map((r) => ({
    id: r.id,
    name: r.name,
    shortDescription: { text: r.message },
    defaultConfiguration: {
      level: mapSeverityToSarifLevel(r.severity)
    }
  }));

  const results = report.flags.map((flag) => {
    const level = mapSeverityToSarifLevel(flag.severity);
    const region = flag.lineRange
      ? {
          startLine: flag.lineRange[0],
          endLine: flag.lineRange[1],
          ...(flag.snippet ? { snippet: { text: flag.snippet } } : {})
        }
      : undefined;

    return {
      ruleId: flag.ruleId,
      level,
      message: { text: flag.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: flag.filePath
            },
            ...(region ? { region } : {})
          }
        }
      ]
    };
  });

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'WANNABE',
            version: '0.1.0',
            informationUri: 'https://github.com/Jalalabadi32-bit/WannaBe',
            rules: sarifRules
          }
        },
        results
      }
    ]
  };
}

export function formatSarif(report: ScanReport): string {
  return JSON.stringify(toSarif(report), null, 2);
}
