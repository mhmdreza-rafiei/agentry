import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Artifact, ArtifactKind } from '../core/types.js';

// Asset layouts in a source repo:
//   skill   — folder per skill:   skills/<name>/SKILL.md  |  skills/<category>/<name>/SKILL.md
//   agent   — single .mdc file:   agents/<name>.mdc       |  agents/<category>/<name>.mdc
//   rule    — single .mdc file:   rules/<name>.mdc        |  rules/<category>/<name>.mdc
//   profile — single .yaml/.yml:  profiles/<name>.yaml    |  profiles/<category>/<name>.yaml
//
// Dual-mode discovery (unioned), so generic repos work too:
//   1) Under an explicit <kind>/ folder (conventions above).
//   2) At the repo root by marker: a folder with SKILL.md = skill; a .mdc file = agent/rule.
const SKILL_MARKER = 'SKILL.md';
const FILE_EXT = '.mdc';
const PROFILE_EXTS = ['.yaml', '.yml'];
const KIND_DIRS: Record<ArtifactKind, string> = { skill: 'skills', rule: 'rules', agent: 'agents', profile: 'profiles', script: 'scripts' };
const ROOT_SKIP = new Set(['.', 'node_modules', 'skills', 'rules', 'agents', 'profiles', 'scripts']);

function entries(dir: string) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

function firstHeading(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1]!.trim() : '';
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

// skills: folder per skill with SKILL.md
function collectSkills(base: string, out: Artifact[]) {
  for (const child of entries(base)) {
    if (!child.isDirectory()) continue;
    const childDir = join(base, child.name);
    if (existsSync(join(childDir, SKILL_MARKER))) {
      out.push(makeArtifact('skill', null, child.name, childDir, false));
    } else {
      for (const item of entries(childDir)) {
        if (!item.isDirectory()) continue;
        const itemDir = join(childDir, item.name);
        if (existsSync(join(itemDir, SKILL_MARKER))) {
          out.push(makeArtifact('skill', child.name, item.name, itemDir, false));
        }
      }
    }
  }
}

// agents/rules: single .mdc files (flat or one category deep)
function collectMdc(kind: ArtifactKind, base: string, out: Artifact[]) {
  for (const child of entries(base)) {
    if (child.isFile() && child.name.endsWith(FILE_EXT)) {
      out.push(makeArtifact(kind, null, child.name.slice(0, -FILE_EXT.length), join(base, child.name), true));
    } else if (child.isDirectory()) {
      const subDir = join(base, child.name);
      for (const item of entries(subDir)) {
        if (item.isFile() && item.name.endsWith(FILE_EXT)) {
          out.push(makeArtifact(kind, child.name, item.name.slice(0, -FILE_EXT.length), join(subDir, item.name), true));
        }
      }
    }
  }
}

// profiles: single .yaml/.yml files (flat or one category deep)
function collectProfiles(base: string, out: Artifact[]) {
  for (const child of entries(base)) {
    if (child.isFile() && PROFILE_EXTS.some((e) => child.name.endsWith(e))) {
      const stem = child.name.replace(/\.(yaml|yml)$/, '');
      out.push(makeArtifact('profile', null, stem, join(base, child.name), true));
    } else if (child.isDirectory()) {
      const subDir = join(base, child.name);
      for (const item of entries(subDir)) {
        if (item.isFile() && PROFILE_EXTS.some((e) => item.name.endsWith(e))) {
          const stem = item.name.replace(/\.(yaml|yml)$/, '');
          out.push(makeArtifact('profile', child.name, stem, join(subDir, item.name), true));
        }
      }
    }
  }
}

// scripts: folder per usecase (flat or one category deep)
function collectScripts(base: string, out: Artifact[]) {
  for (const child of entries(base)) {
    if (!child.isDirectory()) continue;
    const childDir = join(base, child.name);
    // a usecase folder: has files directly (run.js/README.md/...) -> it's a script
    const hasFiles = entries(childDir).some((e) => e.isFile());
    if (hasFiles) {
      out.push(makeArtifact('script', null, child.name, childDir, false));
    } else {
      for (const item of entries(childDir)) {
        if (item.isDirectory() && entries(join(childDir, item.name)).some((e) => e.isFile())) {
          out.push(makeArtifact('script', child.name, item.name, join(childDir, item.name), false));
        }
      }
    }
  }
}

// root marker mode
function collectRootSkills(root: string, out: Artifact[]) {
  for (const child of entries(root)) {
    if (!child.isDirectory() || child.name.startsWith('.') || ROOT_SKIP.has(child.name)) continue;
    const childDir = join(root, child.name);
    if (existsSync(join(childDir, SKILL_MARKER))) {
      out.push(makeArtifact('skill', null, child.name, childDir, false));
    } else {
      for (const item of entries(childDir)) {
        if (item.isDirectory() && existsSync(join(childDir, item.name, SKILL_MARKER))) {
          out.push(makeArtifact('skill', child.name, item.name, join(childDir, item.name), false));
        }
      }
    }
  }
}

function collectRootMdc(kind: ArtifactKind, root: string, out: Artifact[]) {
  for (const child of entries(root)) {
    if (child.isFile() && child.name.endsWith(FILE_EXT) && !child.name.startsWith('.')) {
      out.push(makeArtifact(kind, null, child.name.slice(0, -FILE_EXT.length), join(root, child.name), true));
    } else if (child.isDirectory() && !child.name.startsWith('.') && !ROOT_SKIP.has(child.name)) {
      const subDir = join(root, child.name);
      for (const item of entries(subDir)) {
        if (item.isFile() && item.name.endsWith(FILE_EXT)) {
          out.push(makeArtifact(kind, child.name, item.name.slice(0, -FILE_EXT.length), join(subDir, item.name), true));
        }
      }
    }
  }
}

export function listKind(root: string, kind: ArtifactKind): Artifact[] {
  const out: Artifact[] = [];
  const base = join(root, KIND_DIRS[kind]);
  if (existsSync(base)) {
    if (kind === 'skill') collectSkills(base, out);
    else if (kind === 'profile') collectProfiles(base, out);
    else if (kind === 'script') collectScripts(base, out);
    else collectMdc(kind, base, out); // agents, rules
  }
  if (kind === 'skill') collectRootSkills(root, out);
  else if (kind === 'agent' || kind === 'rule') collectRootMdc(kind, root, out);
  const seen = new Set<string>();
  return out.filter((a) => (seen.has(a.id) ? false : seen.add(a.id))).sort((a, b) => a.id.localeCompare(b.id));
}

export function listAll(root: string): Artifact[] {
  return (['skill', 'rule', 'agent', 'profile'] as ArtifactKind[]).flatMap((k) => listKind(root, k));
}

export function select(root: string, kind: ArtifactKind, selector?: string): Artifact[] {
  const items = listKind(root, kind);
  if (!selector) return items;
  if (selector.includes('/')) return items.filter((a) => a.id === selector);
  const byCategory = items.filter((a) => a.category === selector);
  if (byCategory.length) return byCategory;
  return items.filter((a) => a.name === selector);
}
