import type { ScanReport } from '@wannabe/shared';

export function formatTable(report: ScanReport): string {
  const lines: string[] = [];

  const hr = '═'.repeat(78);
  const subhr = '─'.repeat(78);

  lines.push(hr);
  lines.push('  WANNABE — Software Supply Chain Verification Report');
  lines.push(hr);
  lines.push(`  Package:     ${report.target.packageName}@${report.target.version}`);
  lines.push(`  Repository:  ${report.target.repoUrl ?? 'N/A'}`);
  lines.push(`  Release Tag: ${report.target.gitTag ?? 'N/A'}`);
  lines.push(`  Scan ID:     ${report.id}`);
  lines.push(`  Status:      ${report.status.toUpperCase()}`);
  lines.push(`  Started:     ${report.startedAt}`);
  if (report.completedAt) {
    lines.push(`  Completed:   ${report.completedAt}`);
  }

  // Summary section
  if (report.summary) {
    const s = report.summary;
    lines.push(subhr);
    lines.push('  FILE COMPARISON MATRIX');
    lines.push(subhr);
    lines.push(`  Source Files:    ${s.totalFilesSource.toString().padEnd(6)} | Matched Files:    ${s.matchedFiles}`);
    lines.push(`  Package Files:   ${s.totalFilesPackage.toString().padEnd(6)} | Modified Files:   ${s.modifiedFiles}`);
    lines.push(`  Added in Pkg:    ${s.addedFiles.toString().padEnd(6)} | Missing in Pkg:   ${s.missingFiles}`);
    lines.push(`  Expected Build:  ${s.expectedArtifacts.toString().padEnd(6)} | Total Flags:      ${report.flags.length}`);
    lines.push(
      `  Flags Breakdown: [Critical: ${s.criticalFlags}] [High: ${s.highFlags}] [Medium: ${s.mediumFlags}] [Low: ${s.lowFlags}] [Info: ${s.infoFlags}]`
    );
  }

  // Flags section
  lines.push(subhr);
  lines.push(`  SECURITY FINDINGS (${report.flags.length})`);
  lines.push(subhr);

  if (report.flags.length === 0) {
    lines.push('  ✓ No suspicious security flags or anomalies detected.');
  } else {
    for (const flag of report.flags) {
      const tag = `[${flag.severity.toUpperCase()}]`;
      lines.push(`  ${tag} ${flag.ruleId} (${flag.category})`);
      const loc = flag.lineRange ? `:${flag.lineRange[0]}-${flag.lineRange[1]}` : '';
      lines.push(`     File:    ${flag.filePath}${loc}`);
      lines.push(`     Message: ${flag.message}`);
      if (flag.snippet) {
        lines.push(`     Snippet: ${flag.snippet.trim()}`);
      }
      lines.push('');
    }
  }

  // AI Verdict section
  if (report.aiVerdict) {
    const v = report.aiVerdict;
    lines.push(subhr);
    lines.push(`  AI VERDICT: [${v.riskLevel.toUpperCase()}]  (Risk Score: ${v.riskScore}/100)`);
    lines.push(`  Attribution: ${v.modelAttribution}`);
    lines.push(subhr);
    lines.push(`  Summary:`);
    lines.push(`    ${v.summary}`);
    lines.push('');
    lines.push(`  Technical Analysis:`);
    for (const paragraph of v.technicalAnalysis.split('\n')) {
      if (paragraph.trim()) {
        lines.push(`    ${paragraph.trim()}`);
      }
    }
    lines.push('');
    lines.push(`  Recommendations:`);
    for (const rec of v.recommendations) {
      lines.push(`    • ${rec}`);
    }
  }

  lines.push(hr);
  return lines.join('\n');
}
