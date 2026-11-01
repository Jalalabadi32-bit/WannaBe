import type {
  ScanTarget,
  FileDiff,
  SecurityFlag,
  ScanSummary,
  AIVerdict,
  RiskLevel
} from '@wannabe/shared';
import type { IAIExplainer } from '../interfaces.js';
import { createOllamaBreaker } from '../resilience/circuit-breaker.js';
import type CircuitBreaker from 'opossum';

export interface AIExplainerOptions {
  ollamaHost?: string;
  modelName?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  forceDeterministic?: boolean;
  useBreaker?: boolean;
}

export class HybridAIExplainer implements IAIExplainer {
  private ollamaHost: string;
  private modelName: string;
  private timeoutMs: number;
  private fetch: typeof fetch;
  private forceDeterministic: boolean;
  private breaker?: CircuitBreaker<[ScanTarget, FileDiff[], SecurityFlag[], ScanSummary], AIVerdict>;

  constructor(options: AIExplainerOptions = {}) {
    this.ollamaHost = (options.ollamaHost ?? process.env['OLLAMA_HOST'] ?? 'http://localhost:11434').replace(/\/$/, '');
    this.modelName = options.modelName ?? process.env['OLLAMA_MODEL'] ?? 'gemma2:2b';
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.fetch = options.fetchFn ?? globalThis.fetch;
    this.forceDeterministic =
      options.forceDeterministic ??
      (process.env['WANNABE_FORCE_DETERMINISTIC_AI'] === 'true' ||
        process.env['WANNABE_DETERMINISTIC_AI'] === 'true' ||
        process.env['OLLAMA_DISABLED'] === 'true');

    if (options.useBreaker) {
      this.breaker = createOllamaBreaker(async (t, d, f, s) => {
        return this.callOllamaDirect(t, d, f, s);
      });
    }
  }

  async explain(
    target: ScanTarget,
    diffs: FileDiff[],
    flags: SecurityFlag[],
    summary: ScanSummary
  ): Promise<AIVerdict> {
    if (this.forceDeterministic) {
      return this.generateDeterministicVerdict(target, diffs, flags, summary);
    }

    try {
      if (this.breaker) {
        return await this.breaker.fire(target, diffs, flags, summary);
      }
      return await this.callOllamaDirect(target, diffs, flags, summary);
    } catch {
      // Graceful fallback to deterministic rule engine if Ollama is unreachable or breaker is open
      return this.generateDeterministicVerdict(target, diffs, flags, summary);
    }
  }

  private async callOllamaDirect(
    target: ScanTarget,
    diffs: FileDiff[],
    flags: SecurityFlag[],
    summary: ScanSummary
  ): Promise<AIVerdict> {
    const prompt = this.buildPrompt(target, diffs, flags, summary);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetch(`${this.ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: false,
          format: 'json'
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`Ollama returned HTTP ${res.status}`);
      }

      const data = (await res.json()) as { response?: string };
      if (!data.response) {
        throw new Error('Empty response from Ollama');
      }

      const parsed = JSON.parse(data.response) as Partial<AIVerdict>;
      const fallback = this.generateDeterministicVerdict(target, diffs, flags, summary);

      return {
        riskScore: typeof parsed.riskScore === 'number' ? Math.min(100, Math.max(0, parsed.riskScore)) : fallback.riskScore,
        riskLevel: (['clean', 'suspicious', 'critical'].includes(parsed.riskLevel as string) ? parsed.riskLevel : fallback.riskLevel) as RiskLevel,
        summary: parsed.summary ?? fallback.summary,
        technicalAnalysis: parsed.technicalAnalysis ?? fallback.technicalAnalysis,
        recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0 ? parsed.recommendations : fallback.recommendations,
        modelAttribution: `Google Gemma (${this.modelName}) via Ollama`
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildPrompt(
    target: ScanTarget,
    diffs: FileDiff[],
    flags: SecurityFlag[],
    summary: ScanSummary
  ): string {
    return `You are a software supply chain security analyst. Evaluate this package release:
Package: ${target.packageName}@${target.version}
Repository: ${target.repoUrl ?? 'unknown'}
Evaluated Files: ${diffs.length}
Summary: ${JSON.stringify(summary)}
Critical/High Flags: ${JSON.stringify(flags.filter((f) => f.severity === 'critical' || f.severity === 'high'))}

Respond ONLY with valid JSON conforming to this schema:
{
  "riskScore": number (0 to 100),
  "riskLevel": "clean" | "suspicious" | "critical",
  "summary": "plain English executive summary",
  "technicalAnalysis": "technical explanation of differences and threats",
  "recommendations": ["string"]
}`;
  }

  private generateDeterministicVerdict(
    target: ScanTarget,
    diffs: FileDiff[],
    flags: SecurityFlag[],
    summary: ScanSummary
  ): AIVerdict {
    let score = 0;

    score += summary.criticalFlags * 35;
    score += summary.highFlags * 15;
    score += summary.mediumFlags * 5;
    score += summary.addedFiles * 5;
    score += summary.modifiedFiles * 3;

    score = Math.min(100, Math.max(0, score));

    let riskLevel: RiskLevel = 'clean';
    if (score >= 60 || summary.criticalFlags > 0) {
      riskLevel = 'critical';
    } else if (score >= 20 || summary.highFlags > 0 || summary.addedFiles > 0) {
      riskLevel = 'suspicious';
    }

    const findingDescriptions: string[] = [];
    if (summary.criticalFlags > 0) {
      const critMsgs = flags.filter((f) => f.severity === 'critical').map((f) => f.message);
      findingDescriptions.push(`Critical threats identified: ${critMsgs.join('; ')}`);
    }
    if (summary.addedFiles > 0) {
      findingDescriptions.push(`${summary.addedFiles} uncommitted ghost file(s) present in package release.`);
    }
    if (summary.modifiedFiles > 0) {
      findingDescriptions.push(`${summary.modifiedFiles} file(s) modified between source git tag and package tarball.`);
    }

    const summaryText =
      riskLevel === 'clean'
        ? `Package ${target.packageName}@${target.version} aligns with source git tag. No malicious discrepancies detected.`
        : riskLevel === 'critical'
          ? `Package ${target.packageName}@${target.version} exhibits critical supply chain security tampering. ${findingDescriptions.join(' ')}`
          : `Package ${target.packageName}@${target.version} contains notable deviations from source repository. ${findingDescriptions.join(' ')}`;

    const technicalAnalysis =
      flags.length > 0
        ? `Found ${flags.length} security flag(s) across ${diffs.length} evaluated files. Detected patterns include: ${Array.from(new Set(flags.map((f) => f.category))).join(', ')}.`
        : 'All verified files match the declared source release cryptographically and syntactically.';

    const recommendations: string[] = [];
    if (riskLevel === 'critical') {
      recommendations.push('Do NOT install or deploy this package version in production or CI environments.');
      recommendations.push('Inspect uncommitted scripts and report anomalous tarball additions to the registry.');
    } else if (riskLevel === 'suspicious') {
      recommendations.push('Manually review uncommitted ghost files and modified build artifacts before installing.');
    } else {
      recommendations.push('Package is verified against source tag; safe to proceed with standard testing.');
    }

    return {
      riskScore: score,
      riskLevel,
      summary: summaryText,
      technicalAnalysis,
      recommendations,
      modelAttribution: 'Deterministic Security Heuristic Engine (Offline Fallback)'
    };
  }
}
