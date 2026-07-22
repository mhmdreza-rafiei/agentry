import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

// Profile schema (draft — see context/plan.md; not yet locked).
// A profile bundles artifact selectors + target agents + scope into one config.
export const ProfileArtifactRefSchema = z.object({
  source: z.string().optional(), // override the CLI source
  id: z.string(), // category/name or name
});

export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  scope: z.enum(['global', 'project']).default('project'),
  targets: z.object({
    agents: z.array(z.string()).default([]), // target agent names; '*' = all
  }).default({ agents: [] }),
  artifacts: z.object({
    skills: z.array(ProfileArtifactRefSchema).default([]),
    rules: z.array(ProfileArtifactRefSchema).default([]),
    agents: z.array(ProfileArtifactRefSchema).default([]),
  }).default({}),
});

export type Profile = z.infer<typeof ProfileSchema>;

export function loadProfileFile(file: string): Profile {
  let raw: string;
  try { raw = readFileSync(file, 'utf8'); } catch { throw new Error(`Profile not found: ${file}`); }
  let data: unknown;
  try {
    data = parse(raw);
  } catch (e) {
    throw new Error(`Invalid YAML in ${file}: ${(e as Error).message}`);
  }
  const result = ProfileSchema.safeParse(data);
  if (!result.success) throw new Error(`Invalid profile ${file}: ${result.error.message}`);
  return result.data;
}

export function loadProfile(name: string, baseDir?: string): { file: string; profile: Profile } {
  const file = join(baseDir || process.cwd(), 'profile', `${name}.yaml`);
  return { file, profile: loadProfileFile(file) };
}
