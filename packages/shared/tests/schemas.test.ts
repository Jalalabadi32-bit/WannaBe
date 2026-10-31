import { describe, it, expect } from 'vitest';
import {
  ScanTargetSchema,
  SecurityFlagSchema,
  ScanSummarySchema,
  RiskLevelSchema
} from '../src/schemas.js';

describe('Shared Domain Schemas', () => {
  it('validates a correct ScanTarget', () => {
    const validTarget = {
      packageName: 'chalk',
      version: '5.3.0',
      repoUrl: 'https://github.com/chalk/chalk',
      gitTag: 'v5.3.0'
    };
    const parsed = ScanTargetSchema.parse(validTarget);
    expect(parsed.packageName).toBe('chalk');
    expect(parsed.version).toBe('5.3.0');
  });

  it('rejects an invalid ScanTarget missing packageName', () => {
    const invalidTarget = {
      version: '5.3.0'
    };
    expect(() => ScanTargetSchema.parse(invalidTarget)).toThrow();
  });

  it('validates SecurityFlag categories and severities', () => {
    const validFlag = {
      ruleId: 'WANNABE-R001',
      severity: 'critical',
      category: 'lifecycle_hook',
      message: 'Suspicious postinstall script detected',
      filePath: 'package.json'
    };
    const parsed = SecurityFlagSchema.parse(validFlag);
    expect(parsed.severity).toBe('critical');
    expect(parsed.category).toBe('lifecycle_hook');
  });

  it('validates ScanSummary counters', () => {
    const summary = {
      totalFilesSource: 10,
      totalFilesPackage: 12,
      matchedFiles: 10,
      modifiedFiles: 0,
      addedFiles: 2,
      missingFiles: 0,
      expectedArtifacts: 2,
      criticalFlags: 0,
      highFlags: 0,
      mediumFlags: 0,
      lowFlags: 0,
      infoFlags: 1
    };
    const parsed = ScanSummarySchema.parse(summary);
    expect(parsed.totalFilesPackage).toBe(12);
  });

  it('validates canonical RiskLevel values', () => {
    expect(RiskLevelSchema.parse('clean')).toBe('clean');
    expect(RiskLevelSchema.parse('suspicious')).toBe('suspicious');
    expect(RiskLevelSchema.parse('critical')).toBe('critical');
    expect(() => RiskLevelSchema.parse('unknown')).toThrow();
  });
});
