import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import type { ArtifactKind } from '../core/types.js';

export interface ScaffoldSkillOpts {
  name: string;
  category?: string | null;
  description?: string;
  reference?: boolean;
  baseDir?: string;
}

export interface ScaffoldMdcOpts {
  kind: 'agent' | 'rule';
  name: string;
  category?: string | null;
  description?: string;
  alwaysApply?: boolean;
  baseDir?: string;
}

export interface ScaffoldScriptOpts {
  name: string;
  category?: string | null;
  description?: string;
  baseDir?: string;
}

export interface ScaffoldProfileOpts {
  name: string;
  description?: string;
  agents?: string[];
  skills?: { id: string; source?: string }[];
  rules?: { id: string; source?: string }[];
  agentsArtifacts?: { id: string; source?: string }[];
  scripts?: { id: string; source?: string }[];
  baseDir?: string;
  /** Write to profile/ (local install config) instead of profiles/ (source layout). */
  localConfig?: boolean;
}

export interface ScaffoldResult {
  paths: string[];
  id: string;
}

function ensureDir(file: string): void {
  mkdirSync(join(file, '..'), { recursive: true });
}

function writeNew(file: string, content: string, force = false): string {
  if (existsSync(file) && !force) throw new Error(`Already exists: ${file}`);
  ensureDir(file);
  writeFileSync(file, content);
  return file;
}

export function scaffoldSkill(opts: ScaffoldSkillOpts): ScaffoldResult {
  const base = opts.baseDir || process.cwd();
  const rel = opts.category ? join('skills', opts.category, opts.name) : join('skills', opts.name);
  const dir = join(base, rel);
  const id = opts.category ? `${opts.category}/${opts.name}` : opts.name;
  const desc = opts.description || `${opts.name} skill`;
  const skillMd = `---
name: ${opts.name}
description: ${desc}
---

# ${opts.name}

${desc}

## When to use

Describe when this skill should run.

## Instructions

1. …
`;
  const paths = [writeNew(join(dir, 'SKILL.md'), skillMd)];
  if (opts.reference !== false) {
    paths.push(
      writeNew(
        join(dir, 'references', 'TEMPLATE.md'),
        `# ${opts.name} — reference

Fill in details here. Keep SKILL.md lean; put depth in references/.
`,
      ),
    );
  }
  return { paths, id };
}

export function scaffoldMdc(opts: ScaffoldMdcOpts): ScaffoldResult {
  const base = opts.baseDir || process.cwd();
  const folder = opts.kind === 'agent' ? 'agents' : 'rules';
  const rel = opts.category
    ? join(folder, opts.category, `${opts.name}.mdc`)
    : join(folder, `${opts.name}.mdc`);
  const id = opts.category ? `${opts.category}/${opts.name}` : opts.name;
  const desc = opts.description || `${opts.name} ${opts.kind}`;
  const always =
    opts.kind === 'rule' && opts.alwaysApply
      ? 'alwaysApply: true\n'
      : opts.kind === 'rule'
        ? 'alwaysApply: false\n'
        : '';
  const body = `---
name: ${opts.name}
description: ${desc}
${always}---

# ${opts.name}

${desc}
`;
  return { paths: [writeNew(join(base, rel), body)], id };
}

export function scaffoldScript(opts: ScaffoldScriptOpts): ScaffoldResult {
  const base = opts.baseDir || process.cwd();
  const rel = opts.category ? join('scripts', opts.category, opts.name) : join('scripts', opts.name);
  const dir = join(base, rel);
  const id = opts.category ? `${opts.category}/${opts.name}` : opts.name;
  const desc = opts.description || `${opts.name} script`;
  const paths = [
    writeNew(
      join(dir, 'README.md'),
      `# ${opts.name}

${desc}

Place runnable scripts for this use case in this folder.
`,
    ),
  ];
  return { paths, id };
}

export function scaffoldProfile(opts: ScaffoldProfileOpts): ScaffoldResult {
  const base = opts.baseDir || process.cwd();
  const folder = opts.localConfig ? 'profile' : 'profiles';
  const file = join(base, folder, `${opts.name}.yaml`);
  const data = {
    name: opts.name,
    description: opts.description || `${opts.name} profile`,
    scope: 'project',
    targets: { agents: opts.agents?.length ? opts.agents : ['cursor'] },
    artifacts: {
      skills: opts.skills ?? [],
      rules: opts.rules ?? [],
      agents: opts.agentsArtifacts ?? [],
      scripts: opts.scripts ?? [],
    },
  };
  const yaml = stringify(data);
  return { paths: [writeNew(file, yaml)], id: opts.name };
}

export function pluralKind(kind: ArtifactKind): string {
  return kind === 'skill'
    ? 'skills'
    : kind === 'rule'
      ? 'rules'
      : kind === 'agent'
        ? 'agents'
        : kind === 'script'
          ? 'scripts'
          : 'profiles';
}
