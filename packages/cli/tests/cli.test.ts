import { describe, it, expect } from 'vitest';
import type { SecurityFlag } from '@wannabe/shared';
import { createProgram } from '../src/cli.js';
import { computeExitCode } from '../src/runner/scan-runner.js';
import { runHealthCheck } from '../src/runner/health-runner.js';

describe('CLI Commands & Exit Code Evaluation', () => {
  describe('computeExitCode', () => {
    const criticalFlag: SecurityFlag = {
      ruleId: 'WANNABE-R001',
      severity: 'critical',
      category: 'lifecycle_hook',
      message: 'Malicious postinstall script',
      filePath: 'package.json'
    };

    const mediumFlag: SecurityFlag = {
      ruleId: 'WANNABE-R002',
      severity: 'medium',
      category: 'eval_execution',
      message: 'eval() statement detected',
      filePath: 'index.js'
    };

    const lowFlag: SecurityFlag = {
      ruleId: 'WANNABE-R004',
      severity: 'low',
      category: 'manifest_drift',
      message: 'Minor manifest divergence',
      filePath: 'package.json'
    };

    it('returns exit code 0 when failOn is never regardless of findings', () => {
      expect(computeExitCode([criticalFlag, mediumFlag], 'never')).toBe(0);
    });

    it('returns exit code 4 when critical finding exists and failOn is critical', () => {
      expect(computeExitCode([criticalFlag], 'critical')).toBe(4);
      expect(computeExitCode([mediumFlag, lowFlag], 'critical')).toBe(0);
    });

    it('returns exit code 4 when medium finding exists and failOn is warning', () => {
      expect(computeExitCode([mediumFlag], 'warning')).toBe(4);
      expect(computeExitCode([lowFlag], 'warning')).toBe(0);
    });

    it('returns exit code 0 when no flags present', () => {
      expect(computeExitCode([], 'critical')).toBe(0);
      expect(computeExitCode([], 'warning')).toBe(0);
    });
  });

  describe('createProgram', () => {
    it('configures the Commander CLI with all specified commands', () => {
      const program = createProgram();
      expect(program.name()).toBe('wannabe');

      const commands = program.commands.map((c) => c.name());
      expect(commands).toContain('scan');
      expect(commands).toContain('version');
      expect(commands).toContain('health');
    });

    it('scan command registers all options from cli-spec.yaml', () => {
      const program = createProgram();
      const scanCmd = program.commands.find((c) => c.name() === 'scan');
      expect(scanCmd).toBeDefined();

      const optionNames = scanCmd!.options.map((o) => o.attributeName());
      expect(optionNames).toContain('version');
      expect(optionNames).toContain('repo');
      expect(optionNames).toContain('tag');
      expect(optionNames).toContain('format');
      expect(optionNames).toContain('output');
      expect(optionNames).toContain('failOn');
      expect(optionNames).toContain('ollamaHost');
      expect(optionNames).toContain('offline');
      expect(optionNames).toContain('verbose');
    });
  });

  describe('runHealthCheck', () => {
    it('executes health probe and returns structured diagnostic status', async () => {
      const health = await runHealthCheck('http://127.0.0.1:19999'); // non-existent port to test offline status
      expect(health.ollama.status).toBe('offline');
      expect(health.sandbox.status).toBe('ready');
      expect(health.healthy).toBe(true);
    });
  });
});
