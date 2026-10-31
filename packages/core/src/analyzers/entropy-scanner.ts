import type { SecurityFlag } from '@wannabe/shared';
import type { IEntropyScanner } from '../interfaces.js';

export interface EntropyScannerOptions {
  threshold?: number;
  minSnippetLength?: number;
}

const DEFAULT_ENTROPY_THRESHOLD = 5.2;
const DEFAULT_MIN_SNIPPET_LENGTH = 80;

export class EntropyScanner implements IEntropyScanner {
  private threshold: number;
  private minSnippetLength: number;

  constructor(options: EntropyScannerOptions = {}) {
    this.threshold = options.threshold ?? DEFAULT_ENTROPY_THRESHOLD;
    this.minSnippetLength = options.minSnippetLength ?? DEFAULT_MIN_SNIPPET_LENGTH;
  }

  calculateEntropy(content: string | Buffer): number {
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    if (buffer.length === 0) return 0;

    const frequencies = new Map<number, number>();
    for (const byte of buffer) {
      frequencies.set(byte, (frequencies.get(byte) ?? 0) + 1);
    }

    let entropy = 0;
    const total = buffer.length;
    for (const count of frequencies.values()) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  scanForObfuscation(filePath: string, content: string): SecurityFlag[] {
    const flags: SecurityFlag[] = [];
    const overallEntropy = this.calculateEntropy(content);

    // Flag high-entropy files
    if (content.length >= this.minSnippetLength && overallEntropy >= this.threshold) {
      flags.push({
        ruleId: 'WANNABE-HIGH-ENTROPY-FILE',
        severity: 'high',
        category: 'entropy_obfuscation',
        message: `High file entropy (${overallEntropy.toFixed(2)}) indicates packed, obfuscated, or encrypted payload in "${filePath}".`,
        filePath
      });
    }

    // Scan individual long string literals / tokens for embedded base64 or hex blobs
    const tokenRegex = /[A-Za-z0-9+/=]{80,}|[0-9a-fA-F]{80,}/g;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(content)) !== null) {
      const token = match[0];
      const tokenEntropy = this.calculateEntropy(token);

      if (tokenEntropy >= 4.5) {
        flags.push({
          ruleId: 'WANNABE-OBFUSCATED-STRING',
          severity: 'medium',
          category: 'entropy_obfuscation',
          message: `Suspicious high-entropy token (${tokenEntropy.toFixed(2)}) detected in "${filePath}".`,
          filePath,
          snippet: token.length > 100 ? `${token.slice(0, 97)}...` : token
        });
        break; // Only flag the first suspicious token per file to avoid noise
      }
    }

    return flags;
  }
}
