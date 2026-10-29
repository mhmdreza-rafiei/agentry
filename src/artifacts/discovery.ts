import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import type { Artifact, ArtifactKind } from '../core/types.js';
import { createIgnoreMatcher } from './ignore.js';

// Asset layouts in a source repo:
//   skill   — folder per skill:   skills/<name>/SKILL.md  |  skills/<category>/<name>/SKILL.md
//   agent   — single .mdc file:   agents/<name>.mdc       |  agents/<category>/<name>.mdc
//   rule    — single .mdc file:   rules/<name>.mdc        |  rules/<category>/<name>.mdc
//   profile — single .yaml/.yml:  profiles/<name>.yaml    |  profiles/<category>/<name>.yaml
//   script  — folder per usecase: scripts/<name>/         |  scripts/<category>/<name>/
//
// Dual-mode discovery (unioned), so generic repos and root-only repos work too:
//   1) Under an explicit <kind>/ folder (conventions above).
//   2) At the repo root by marker:
//      - root SKILL.md = single-skill repo
//      - root folders with SKILL.md = skills
//      - root .mdc files or AGENT.md / RULE.md / .cursorrules = agents / rules
//      - root profile/ folder or profile.yaml / *.profile.yaml = profiles
//      - root script entrypoints = scripts
const SKILL_MARKER = 'SKILL.md';
const AGENT_MARKER = 'AGENT.md';
const RULE_MARKER = 'RULE.md';
const CURSORRULES_MARKER = '.cursorrules';
const FILE_EXT = '.mdc';
const PROFILE_EXTS = ['.yaml', '.yml'];
const KIND_DIRS: Record<ArtifactKind, string> = {
  skill: 'skills',
  rule: 'rules',
  agent: 'agents',
  profile: 'profiles',
  script: 'scripts',
};
const ROOT_SKIP = new Set(['.', 'node_modules', 'skills', 'rules', 'agents', 'profiles', 'scripts']);

type Matcher = (relPath: string, isDirectory?: boolean) => boolean;

function entries(dir: string) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

function firstHeading(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1]!.trim() : '';
}

export function frontmatterName(md: string): string {
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return '';
  const m = fm[1]!.match(/^name:\s*(.+)$/m);
  return m ? m[1]!.trim().replace(/^['"]|['"]$/g, '') : '';
}

function frontmatterDescription(md: string): string {
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return '';
  const lines = fm[1]!.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const dm = lines[i]!.match(/^description:\s*(.*)$/);
    if (!dm) continue;
    let val = dm[1]!.trim();
    if (val === '' || val === '>' || val === '|' || val === '>-' || val === '|-') {
      const collected: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\s+\S/.test(lines[j]!)) collected.push(lines[j]!.trim()); else break;
      }
      val = collected.join(' ');
    }
    return val.trim();
  }
  return '';
}

function readDescription(filePath: string): string {
  try {
    const md = readFileSync(filePath, 'utf8');
    return frontmatterDescription(md) || firstHeading(md);
  } catch { return ''; }
}

function folderDescription(dir: string): string {
  for (const f of [SKILL_MARKER, 'README.md']) {
    const p = join(dir, f);
    if (existsSync(p)) { const d = readDescription(p); if (d) return d; }
  }
  return '';
}

function makeArtifact(kind: ArtifactKind, category: string | null, name: string, srcPath: string, isFile: boolean): Artifact {
  const id = category ? `${category}/${name}` : name;
  const description = isFile ? readDescription(srcPath) : folderDescription(srcPath);
  return { kind, category, name, id, dir: srcPath, isFile, description };
}

function rel(root: string, fullPath: string): string {
  return relative(root, fullPath).replace(/\\/g, '/');
}

// skills: folder per skill with SKILL.md
function collectSkills(root: string, base: string, out: Artifact[], matcher: Matcher) {
  for (const child of entries(base)) {
    if (!child.isDirectory()) continue;
    const childDir = join(base, child.name);
    if (matcher(rel(root, childDir), true)) continue;

    if (existsSync(join(childDir, SKILL_MARKER))) {
      out.push(makeArtifact('skill', null, child.name, childDir, false));
    } else {
      for (const item of entries(childDir)) {
        if (!item.isDirectory()) continue;
        const itemDir = join(childDir, item.name);
        if (matcher(rel(root, itemDir), true)) continue;
        if (existsSync(join(itemDir, SKILL_MARKER))) {
          out.push(makeArtifact('skill', child.name, item.name, itemDir, false));
        }
      }
    }
  }
}

// agents/rules: single .mdc files (flat or one category deep)
function collectMdc(root: string, kind: ArtifactKind, base: string, out: Artifact[], matcher: Matcher) {
  for (const child of entries(base)) {
    const childPath = join(base, child.name);
    if (child.isFile() && child.name.endsWith(FILE_EXT)) {
      if (matcher(rel(root, childPath), false)) continue;
      out.push(makeArtifact(kind, null, child.name.slice(0, -FILE_EXT.length), childPath, true));
    } else if (child.isDirectory()) {
      if (matcher(rel(root, childPath), true)) continue;
      for (const item of entries(childPath)) {
        const itemPath = join(childPath, item.name);
        if (item.isFile() && item.name.endsWith(FILE_EXT)) {
          if (matcher(rel(root, itemPath), false)) continue;
          out.push(makeArtifact(kind, child.name, item.name.slice(0, -FILE_EXT.length), itemPath, true));
        }
      }
    }
  }
}

// profiles: single .yaml/.yml files (flat or one category deep)
function collectProfiles(root: string, base: string, out: Artifact[], matcher: Matcher) {
  for (const child of entries(base)) {
    const childPath = join(base, child.name);
    if (child.isFile() && PROFILE_EXTS.some((e) => child.name.endsWith(e))) {
      if (matcher(rel(root, childPath), false)) continue;
      const stem = child.name.replace(/\.(yaml|yml)$/, '');
      out.push(makeArtifact('profile', null, stem, childPath, true));
    } else if (child.isDirectory()) {
      if (matcher(rel(root, childPath), true)) continue;
      for (const item of entries(childPath)) {
        const itemPath = join(childPath, item.name);
        if (item.isFile() && PROFILE_EXTS.some((e) => item.name.endsWith(e))) {
          if (matcher(rel(root, itemPath), false)) continue;
          const stem = item.name.replace(/\.(yaml|yml)$/, '');
          out.push(makeArtifact('profile', child.name, stem, itemPath, true));
        }
      }
    }
  }
}

// scripts: folder per usecase (flat or one category deep)
function collectScripts(root: string, base: string, out: Artifact[], matcher: Matcher) {
  for (const child of entries(base)) {
    if (!child.isDirectory()) continue;
    const childDir = join(base, child.name);
    if (matcher(rel(root, childDir), true)) continue;
    const hasFiles = entries(childDir).some((e) => e.isFile());
    if (hasFiles) {
      out.push(makeArtifact('script', null, child.name, childDir, false));
    } else {
      for (const item of entries(childDir)) {
        const itemDir = join(childDir, item.name);
        if (!item.isDirectory() || matcher(rel(root, itemDir), true)) continue;
        if (entries(itemDir).some((e) => e.isFile())) {
          out.push(makeArtifact('script', child.name, item.name, join(childDir, item.name), false));
        }
      }
    }
  }
}

// root marker mode: skills
function collectRootSkills(root: string, out: Artifact[], matcher: Matcher) {
  // 1. Direct root SKILL.md (the repository itself is a single skill)
  const rootSkillFile = join(root, SKILL_MARKER);
  if (existsSync(rootSkillFile) && !matcher(SKILL_MARKER, false)) {
    let name = '';
    try {
      const content = readFileSync(rootSkillFile, 'utf8');
      name = frontmatterName(content);
    } catch {}
    if (!name) name = basename(root) || 'skill';
    out.push(makeArtifact('skill', null, name, root, false));
  }

  // 2. Subdirectories in root that contain SKILL.md
  for (const child of entries(root)) {
    if (!child.isDirectory() || child.name.startsWith('.') || ROOT_SKIP.has(child.name)) continue;
    const childDir = join(root, child.name);
    if (matcher(child.name, true)) continue;

    if (existsSync(join(childDir, SKILL_MARKER))) {
      out.push(makeArtifact('skill', null, child.name, childDir, false));
    } else {
      for (const item of entries(childDir)) {
        if (!item.isDirectory()) continue;
        const itemDir = join(childDir, item.name);
        if (matcher(rel(root, itemDir), true)) continue;
        if (existsSync(join(itemDir, SKILL_MARKER))) {
          out.push(makeArtifact('skill', child.name, item.name, itemDir, false));
        }
      }
    }
  }
}

// root marker mode: agents and rules
function collectRootMdc(kind: ArtifactKind, root: string, out: Artifact[], matcher: Matcher) {
  // Check standalone root marker files
  if (kind === 'agent') {
    const rootAgent = join(root, AGENT_MARKER);
    if (existsSync(rootAgent) && !matcher(AGENT_MARKER, false)) {
      let name = '';
      try { name = frontmatterName(readFileSync(rootAgent, 'utf8')); } catch {}
      out.push(makeArtifact('agent', null, name || 'agent', rootAgent, true));
    }
  }

  if (kind === 'rule') {
    const rootRule = join(root, RULE_MARKER);
    if (existsSync(rootRule) && !matcher(RULE_MARKER, false)) {
      let name = '';
      try { name = frontmatterName(readFileSync(rootRule, 'utf8')); } catch {}
      out.push(makeArtifact('rule', null, name || 'rule', rootRule, true));
    }
    const cursorRules = join(root, CURSORRULES_MARKER);
    if (existsSync(cursorRules) && !matcher(CURSORRULES_MARKER, false)) {
      out.push(makeArtifact('rule', null, 'cursorrules', cursorRules, true));
    }
  }

  // Check root .mdc files and subdirectories
  for (const child of entries(root)) {
    const childPath = join(root, child.name);
    if (child.isFile() && child.name.endsWith(FILE_EXT) && !child.name.startsWith('.')) {
      if (matcher(child.name, false)) continue;
      out.push(makeArtifact(kind, null, child.name.slice(0, -FILE_EXT.length), childPath, true));
    } else if (child.isDirectory() && !child.name.startsWith('.') && !ROOT_SKIP.has(child.name)) {
      if (matcher(child.name, true)) continue;
      for (const item of entries(childPath)) {
        const itemPath = join(childPath, item.name);
        if (item.isFile() && item.name.endsWith(FILE_EXT)) {
          if (matcher(rel(root, itemPath), false)) continue;
          out.push(makeArtifact(kind, child.name, item.name.slice(0, -FILE_EXT.length), itemPath, true));
        }
      }
    }
  }
}

// root marker mode: profiles
function collectRootProfiles(root: string, out: Artifact[], matcher: Matcher) {
  // Local profile layout: root/profile/
  const localProfileDir = join(root, 'profile');
  if (existsSync(localProfileDir) && !matcher('profile', true)) {
    collectProfiles(root, localProfileDir, out, matcher);
  }

  // Root profile files: profile.yaml, profile.yml, *.profile.yaml, *.profile.yml
  for (const child of entries(root)) {
    if (!child.isFile()) continue;
    if (matcher(child.name, false)) continue;
    const lower = child.name.toLowerCase();
    const isProfileYaml = lower === 'profile.yaml' || lower === 'profile.yml' ||
      lower.endsWith('.profile.yaml') || lower.endsWith('.profile.yml');
    if (isProfileYaml) {
      const stem = child.name.replace(/\.(profile\.)?(yaml|yml)$/i, '');
      out.push(makeArtifact('profile', null, stem, join(root, child.name), true));
    }
  }
}

// root marker mode: scripts
function collectRootScripts(root: string, out: Artifact[], matcher: Matcher) {
  // Local script layout: root/script/
  const localScriptDir = join(root, 'script');
  if (existsSync(localScriptDir) && !matcher('script', true)) {
    collectScripts(root, localScriptDir, out, matcher);
  }

  // Standalone script entrypoints if no SKILL.md is present at root
  if (!existsSync(join(root, SKILL_MARKER))) {
    const scriptFiles = ['run.sh', 'script.sh', 'run.js', 'main.py'];
    for (const sf of scriptFiles) {
      const p = join(root, sf);
      if (existsSync(p) && !matcher(sf, false)) {
        const name = basename(root) || 'script';
        out.push(makeArtifact('script', null, name, root, false));
        break;
      }
    }
  }
}

export function listKind(root: string, kind: ArtifactKind): Artifact[] {
  const out: Artifact[] = [];
  const matcher = createIgnoreMatcher(root);
  const base = join(root, KIND_DIRS[kind]);

  if (existsSync(base) && !matcher(KIND_DIRS[kind], true)) {
    if (kind === 'skill') collectSkills(root, base, out, matcher);
    else if (kind === 'profile') collectProfiles(root, base, out, matcher);
    else if (kind === 'script') collectScripts(root, base, out, matcher);
    else collectMdc(root, kind, base, out, matcher);
  }

  if (kind === 'skill') collectRootSkills(root, out, matcher);
  else if (kind === 'agent' || kind === 'rule') collectRootMdc(kind, root, out, matcher);
  else if (kind === 'profile') collectRootProfiles(root, out, matcher);
  else if (kind === 'script') collectRootScripts(root, out, matcher);

  const seen = new Set<string>();
  return out.filter((a) => (seen.has(a.id) ? false : seen.add(a.id))).sort((a, b) => a.id.localeCompare(b.id));
}

export function listAll(root: string): Artifact[] {
  return (['skill', 'rule', 'agent', 'profile', 'script'] as ArtifactKind[]).flatMap((k) => listKind(root, k));
}

export function select(root: string, kind: ArtifactKind, selector?: string): Artifact[] {
  const items = listKind(root, kind);
  if (!selector) return items;
  if (selector.includes('/')) return items.filter((a) => a.id === selector);
  const byCategory = items.filter((a) => a.category === selector);
  if (byCategory.length) return byCategory;
  return items.filter((a) => a.name === selector);
}

export function selectAll(root: string, selector?: string): Artifact[] {
  const items = listAll(root);
  if (!selector) return items;
  if (selector.includes('/')) return items.filter((a) => a.id === selector);
  const byCategory = items.filter((a) => a.category === selector);
  if (byCategory.length) return byCategory;
  return items.filter((a) => a.name === selector);
}
