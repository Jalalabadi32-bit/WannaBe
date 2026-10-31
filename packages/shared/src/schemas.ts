import { z } from 'zod';

export const UserRoleSchema = z.enum(['viewer', 'analyst', 'admin']);

export const AuthUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  role: UserRoleSchema,
  avatarUrl: z.string().url().optional()
});

export const ScanTargetSchema = z.object({
  packageName: z.string().min(1, 'Package name is required'),
  version: z.string().min(1, 'Package version is required'),
  repoUrl: z.string().url().optional(),
  gitTag: z.string().optional()
});

export const FileDiffStatusSchema = z.enum([
  'identical',
  'modified',
  'added_in_package',
  'missing_in_package',
  'expected_build_artifact'
]);

export const SecuritySeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);

export const SecurityFlagCategorySchema = z.enum([
  'lifecycle_hook',
  'eval_execution',
  'entropy_obfuscation',
  'network_exfil',
  'filesystem_access',
  'manifest_drift',
  'unmapped_binary'
]);

export const SecurityFlagSchema = z.object({
  ruleId: z.string().min(1),
  severity: SecuritySeveritySchema,
  category: SecurityFlagCategorySchema,
  message: z.string().min(1),
  filePath: z.string().min(1),
  lineRange: z.tuple([z.number(), z.number()]).optional(),
  snippet: z.string().optional()
});

export const FileDiffSchema = z.object({
  path: z.string().min(1),
  status: FileDiffStatusSchema,
  sourceSha256: z.string().optional(),
  packageSha256: z.string().optional(),
  sizeDiffBytes: z.number(),
  entropy: z.number().optional(),
  flags: z.array(SecurityFlagSchema)
});

export const ScanSummarySchema = z.object({
  totalFilesSource: z.number().int().nonnegative(),
  totalFilesPackage: z.number().int().nonnegative(),
  matchedFiles: z.number().int().nonnegative(),
  modifiedFiles: z.number().int().nonnegative(),
  addedFiles: z.number().int().nonnegative(),
  missingFiles: z.number().int().nonnegative(),
  expectedArtifacts: z.number().int().nonnegative(),
  criticalFlags: z.number().int().nonnegative(),
  highFlags: z.number().int().nonnegative(),
  mediumFlags: z.number().int().nonnegative(),
  lowFlags: z.number().int().nonnegative(),
  infoFlags: z.number().int().nonnegative()
});

export const RiskLevelSchema = z.enum(['clean', 'suspicious', 'critical']);

export const AIVerdictSchema = z.object({
  riskScore: z.number().min(0).max(100),
  riskLevel: RiskLevelSchema,
  summary: z.string().min(1),
  technicalAnalysis: z.string().min(1),
  recommendations: z.array(z.string()),
  modelAttribution: z.string().min(1)
});

export const ScanStatusSchema = z.enum([
  'queued',
  'fetching',
  'extracting',
  'analyzing',
  'evaluating_ai',
  'completed',
  'failed'
]);

export const ScanReportSchema = z.object({
  id: z.string().uuid(),
  target: ScanTargetSchema,
  status: ScanStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  summary: ScanSummarySchema.optional(),
  fileDiffs: z.array(FileDiffSchema),
  flags: z.array(SecurityFlagSchema),
  aiVerdict: AIVerdictSchema.optional(),
  error: z.string().optional()
});

export const CreateScanRequestSchema = ScanTargetSchema;

export const ScanResponseSchema = z.object({
  scanId: z.string().uuid(),
  status: ScanStatusSchema,
  message: z.string()
});
