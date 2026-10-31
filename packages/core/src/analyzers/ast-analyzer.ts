import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { SecurityFlag } from '@wannabe/shared';
import type { IASTAnalyzer } from '../interfaces.js';

type TraverseFn = (node: any, visitors: any) => void;
// Handle ESM default export interop for @babel/traverse
const traverse: TraverseFn = ((_traverse as any).default ?? _traverse) as TraverseFn;

const SENSITIVE_ENV_VARS = new Set([
  'NPM_TOKEN',
  'NODE_AUTH_TOKEN',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'SSH_PRIVATE_KEY'
]);

const CHILD_PROCESS_METHODS = new Set([
  'exec',
  'execSync',
  'spawn',
  'spawnSync',
  'execFile',
  'execFileSync',
  'fork'
]);

const NETWORK_METHODS = new Set([
  'connect',
  'createConnection',
  'createSocket'
]);

export class ASTAnalyzer implements IASTAnalyzer {
  async analyzeFile(filePath: string, content: string): Promise<SecurityFlag[]> {
    const flags: SecurityFlag[] = [];

    // Skip non-code files
    if (!/\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(filePath)) {
      return flags;
    }

    let ast;
    try {
      ast = parse(content, {
        sourceType: 'unambiguous',
        plugins: ['typescript', 'jsx']
      });
    } catch {
      // Malformed or binary file parsed as text; fail closed without halting scan
      return flags;
    }

    const lines = content.split('\n');
    const getSnippet = (line: number): string => (lines[line - 1] ?? '').trim();

    traverse(ast, {
      CallExpression(pathNode: any) {
        const callee = pathNode.node.callee;
        const line = pathNode.node.loc?.start.line ?? 1;

        // 1. Dynamic evaluation (eval, Function)
        if (callee.type === 'Identifier') {
          if (callee.name === 'eval') {
            flags.push({
              ruleId: 'WANNABE-AST-EVAL',
              severity: 'critical',
              category: 'eval_execution',
              message: 'Dynamic code execution via eval() detected.',
              filePath,
              lineRange: [line, line],
              snippet: getSnippet(line)
            });
          } else if (callee.name === 'Function') {
            flags.push({
              ruleId: 'WANNABE-AST-FUNCTION-CONSTRUCTOR',
              severity: 'high',
              category: 'eval_execution',
              message: 'Dynamic code execution via Function() constructor detected.',
              filePath,
              lineRange: [line, line],
              snippet: getSnippet(line)
            });
          }
        }

        // 2. Child process execution (child_process.exec / spawn)
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          CHILD_PROCESS_METHODS.has(callee.property.name)
        ) {
          flags.push({
            ruleId: 'WANNABE-AST-CHILD-PROCESS',
            severity: 'high',
            category: 'lifecycle_hook',
            message: `Shell/Process execution via .${callee.property.name}() detected.`,
            filePath,
            lineRange: [line, line],
            snippet: getSnippet(line)
          });
        }

        // 3. Raw network sockets (net.connect, tls.connect)
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          NETWORK_METHODS.has(callee.property.name)
        ) {
          flags.push({
            ruleId: 'WANNABE-AST-NETWORK-SOCKET',
            severity: 'high',
            category: 'network_exfil',
            message: `Low-level network connection via .${callee.property.name}() detected.`,
            filePath,
            lineRange: [line, line],
            snippet: getSnippet(line)
          });
        }
      },

      NewExpression(pathNode: any) {
        const callee = pathNode.node.callee;
        const line = pathNode.node.loc?.start.line ?? 1;

        if (callee.type === 'Identifier' && callee.name === 'Function') {
          flags.push({
            ruleId: 'WANNABE-AST-FUNCTION-CONSTRUCTOR',
            severity: 'high',
            category: 'eval_execution',
            message: 'Dynamic code execution via new Function() constructor detected.',
            filePath,
            lineRange: [line, line],
            snippet: getSnippet(line)
          });
        }
      },

      MemberExpression(pathNode: any) {
        const node = pathNode.node;
        const line = node.loc?.start.line ?? 1;

        // 4. Sensitive environment variable harvesting
        if (
          node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier' &&
          node.object.object.name === 'process' &&
          node.object.property.type === 'Identifier' &&
          node.object.property.name === 'env'
        ) {
          let envVarName: string | undefined;
          if (node.property.type === 'Identifier') {
            envVarName = node.property.name;
          } else if (node.property.type === 'StringLiteral') {
            envVarName = node.property.value;
          }

          if (envVarName && SENSITIVE_ENV_VARS.has(envVarName)) {
            flags.push({
              ruleId: 'WANNABE-AST-CREDENTIAL-HARVEST',
              severity: 'critical',
              category: 'network_exfil',
              message: `Access to sensitive environment secret process.env.${envVarName} detected.`,
              filePath,
              lineRange: [line, line],
              snippet: getSnippet(line)
            });
          }
        }
      },

      StringLiteral(pathNode: any) {
        const val = pathNode.node.value;
        const line = pathNode.node.loc?.start.line ?? 1;

        // 5. Sensitive filesystem paths
        if (val.includes('/etc/passwd') || val.includes('/etc/shadow') || val.includes('.ssh/id_')) {
          flags.push({
            ruleId: 'WANNABE-AST-SENSITIVE-FS',
            severity: 'critical',
            category: 'filesystem_access',
            message: `Reference to sensitive system path "${val}" detected.`,
            filePath,
            lineRange: [line, line],
            snippet: getSnippet(line)
          });
        }
      }
    });

    return flags;
  }
}
