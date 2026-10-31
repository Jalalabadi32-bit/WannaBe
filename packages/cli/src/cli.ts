import { Command } from 'commander';
import fsp from 'node:fs/promises';
import { runScanCli, CLIExecutionError } from './runner/scan-runner.js';
import { runHealthCheck } from './runner/health-runner.js';
import { formatTable, formatJson, formatSarif } from './formatters/index.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('wannabe')
    .description('Automated Software Supply Chain Security & Source-to-Package Verification CLI')
    .version('0.1.0');

  // 1. scan command
  program
    .command('scan')
    .description('Run a source-to-package verification scan comparing an npm package against its GitHub repository.')
    .argument('<package>', 'Published npm package name (e.g. chalk or chalk@5.3.0)')
    .option('-v, --version <version>', 'Target package release version', process.env['WANNABE_PACKAGE_VERSION'])
    .option('-r, --repo <url>', 'Git source repository URL', process.env['WANNABE_REPO_URL'])
    .option('-t, --tag <tag>', 'Git release tag', process.env['WANNABE_GIT_TAG'])
    .option('-f, --format <format>', 'Report output format: table, json, or sarif', 'table')
    .option('-o, --output <path>', 'Save scan report to destination file path instead of stdout')
    .option(
      '--fail-on <level>',
      'Exit with non-zero status code if findings meet or exceed severity threshold (never, warning, critical)',
      'critical'
    )
    .option(
      '--ollama-host <url>',
      'Local or remote Ollama endpoint for Gemma inference',
      process.env['OLLAMA_HOST'] ?? 'http://localhost:11434'
    )
    .option('--offline', 'Force deterministic rule-based analysis without invoking Ollama', false)
    .option('--verbose', 'Enable debug diagnostic logging to stderr', false)
    .action(
      async (
        pkgArg: string,
        options: {
          version?: string;
          repo?: string;
          tag?: string;
          format?: string;
          output?: string;
          failOn?: 'never' | 'warning' | 'critical';
          ollamaHost?: string;
          offline?: boolean;
          verbose?: boolean;
        }
      ) => {
        let packageName = pkgArg;
        let packageVersion = options.version;

        // Support shorthand <pkg>@<ver>
        if (!packageVersion && pkgArg.includes('@')) {
          const lastAt = pkgArg.lastIndexOf('@');
          if (lastAt > 0) {
            packageName = pkgArg.slice(0, lastAt);
            packageVersion = pkgArg.slice(lastAt + 1);
          }
        }

        if (!packageVersion) {
          process.stderr.write(
            "error: missing required package version. Provide -v, --version <ver> or pass '<package>@<version>'\n"
          );
          process.exit(1);
        }

        try {
          const result = await runScanCli({
            packageName,
            version: packageVersion,
            repoUrl: options.repo,
            gitTag: options.tag,
            format: (options.format as 'table' | 'json' | 'sarif') ?? 'table',
            outputPath: options.output,
            failOn: options.failOn ?? 'critical',
            ollamaHost: options.ollamaHost,
            offline: options.offline,
            verbose: options.verbose
          });

          let outputText: string;
          const fmt = (options.format ?? 'table').toLowerCase();
          if (fmt === 'json') {
            outputText = formatJson(result.report);
          } else if (fmt === 'sarif') {
            outputText = formatSarif(result.report);
          } else {
            outputText = formatTable(result.report);
          }

          if (options.output) {
            await fsp.writeFile(options.output, outputText, 'utf8');
            if (options.verbose) {
              process.stderr.write(`Scan report written to: ${options.output}\n`);
            }
          } else {
            process.stdout.write(outputText + '\n');
          }

          process.exit(result.exitCode);
        } catch (err: unknown) {
          if (err instanceof CLIExecutionError) {
            process.stderr.write(`[wannabe:error] ${err.message}\n`);
            process.exit(err.exitCode);
          }
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(`[wannabe:error] Unexpected execution error: ${msg}\n`);
          process.exit(1);
        }
      }
    );

  // 2. version command
  program
    .command('version')
    .description('Display CLI version, engine version, and system information.')
    .action(() => {
      console.log('WANNABE CLI:         0.1.0');
      console.log('WANNABE Engine:      0.1.0');
      console.log(`Node.js Runtime:     ${process.version}`);
      console.log(`Platform / Arch:     ${process.platform} / ${process.arch}`);
    });

  // 3. health command
  program
    .command('health')
    .description('Probe local Ollama and extraction sandbox readiness.')
    .option('--ollama-host <url>', 'Ollama host endpoint', process.env['OLLAMA_HOST'] ?? 'http://localhost:11434')
    .action(async (options: { ollamaHost?: string }) => {
      const health = await runHealthCheck(options.ollamaHost);
      console.log('WANNABE Health & Readiness Probe:');
      console.log(`  Ollama Inference: [${health.ollama.status.toUpperCase()}] ${health.ollama.details} (${health.ollama.url})`);
      console.log(
        `  Sandbox Storage:  [${health.sandbox.status.toUpperCase()}] ${health.sandbox.details} (${health.sandbox.directory})`
      );
      if (!health.healthy) {
        process.exit(1);
      }
    });

  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
