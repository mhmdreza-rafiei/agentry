import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { LockFile, LockEntry, InstallOpts, Artifact, AgentConfig } from './types.js';
import { getAgent } from '../registry/agents.js';

const home = homedir();

export function lockBase(opts: Pick<InstallOpts, 'scope' | 'dir'>): string {
  return opts.scope === 'global' ? home : (opts.dir || process.cwd());
}

// Lockfile stays at <base>/.cursor/agentry.lock.json for backward compat with existing installs.
export function lockPath(opts: Pick<InstallOpts, 'scope' | 'dir'>): string {
  return join(lockBase(opts), '.cursor', 'agentry.lock.json');
}

export function readLock(opts: Pick<InstallOpts, 'scope' | 'dir'>): LockFile {
  try {
    return JSON.parse(readFileSync(lockPath(opts), 'utf8')) as LockFile;
  } catch {
    return { version: 1, items: {} };
  }
}

export function writeLock(opts: Pick<InstallOpts, 'scope' | 'dir'>, lock: LockFile): void {
  const dir = join(lockPath(opts), '..');
  mkdirSync(dir, { recursive: true });
  writeFileSync(lockPath(opts), JSON.stringify(lock, null, 2) + '\n');
}

export function listInstalled(opts: Pick<InstallOpts, 'scope' | 'dir'>): (LockEntry & { id: string })[] {
  return Object.entries(readLock(opts).items).map(([id, v]) => ({ id, ...v }));
}

// Resolve install roots for one artifact across all target agents.
// Returns [{ agent, dir }] — absolute paths to write to.
export function installRootsFor(artifact: Artifact, agentList: AgentConfig[], opts: Pick<InstallOpts, 'scope' | 'dir'>): { agent: AgentConfig; dir: string }[] {
  const list = agentList.length ? agentList : [getAgent('cursor')!];
  const base = lockBase(opts);
  const out: { agent: AgentConfig; dir: string }[] = [];
  for (const a of list) {
    let dir: string;
    if (artifact.kind === 'skill') {
      dir = join(base, a.skillsDir, artifact.id);
    } else if (artifact.isFile) {
      // agents/rules/profiles: <configDir>/<kind>/<name>.<ext>
      const ext = artifact.kind === 'profile' ? '.yaml' : '.mdc';
      dir = join(base, a.configDir || a.skillsDir, pluralKind(artifact.kind), artifact.name + ext);
    } else {
      dir = join(base, a.configDir || a.skillsDir, pluralKind(artifact.kind), artifact.id);
    }
    out.push({ agent: a, dir });
  }
  return out;
}

function pluralKind(kind: string): string {
  return kind === 'skill' ? 'skills' : kind === 'rule' ? 'rules' : kind === 'agent' ? 'agents' : 'profiles';
}
export function installOne(
  artifact: Artifact,
  opts: InstallOpts,
  agentList: AgentConfig[],
  source: string,
): { agent: string; dir: string }[] {
  const roots = installRootsFor(artifact, agentList, opts);
  const dests: { agent: string; dir: string }[] = [];
  if (opts.dryRun) {
    return roots.map((r) => ({ agent: r.agent.name, dir: r.dir }));
  }
  for (const r of roots) {
    rmSync(r.dir, { recursive: true, force: true });
    mkdirSync(join(r.dir, '..'), { recursive: true });
    if (opts.copy) {
      cpSync(artifact.dir, r.dir, { recursive: true });
    } else {
      // symlink (default, like vercel-labs/skills). Fall back to copy on error.
      try { symlinkSync(artifact.dir, r.dir, 'junction' as any); } catch { cpSync(artifact.dir, r.dir, { recursive: true }); }
    }
    dests.push({ agent: r.agent.name, dir: r.dir });
  }
  const lock = readLock(opts);
  lock.items[`${artifact.kind}/${artifact.id}`] = {
    source: source || null,
    installedAt: new Date().toISOString(),
    agents: roots.map((r) => r.agent.name),
    kind: artifact.kind,
  };
  writeLock(opts, lock);
  return dests;
}

// Remove a kind, category, or single artifact. Works from lockfile/filesystem; no source needed.
export function removeSelection(
  kind: string,
  selector: string | undefined,
  opts: InstallOpts,
  agentList: AgentConfig[],
): { existed: boolean; removedKeys: string[] } {
  const base = lockBase(opts);
  const list = agentList.length ? agentList : [getAgent('cursor')!];
  const rel = [kind, selector].filter(Boolean).join('/');
  const removedKeys: string[] = [];
  const lock = readLock(opts);
  const pkind = pluralKind(kind);

  for (const a of list) {
    let dir: string;
    if (kind === 'skill') {
      dir = join(base, a.skillsDir, selector || '');
    } else if (kind === 'agent' || kind === 'rule' || kind === 'profile') {
      const ext = kind === 'profile' ? '.yaml' : '.mdc';
      if (!selector) dir = join(base, a.configDir || a.skillsDir, pkind);
      else if (selector.includes('/')) {
        const [cat, name] = selector.split('/');
        dir = join(base, a.configDir || a.skillsDir, pkind, cat!, name + ext);
      } else {
        dir = join(base, a.configDir || a.skillsDir, pkind, selector + ext);
      }
    } else {
      dir = join(base, a.configDir || a.skillsDir, pkind, selector || '');
    }
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }

  for (const key of Object.keys(lock.items)) {
    if (key === rel || key.startsWith(rel + '/')) {
      delete lock.items[key];
      removedKeys.push(key);
    }
  }
  writeLock(opts, lock);
  return { existed: removedKeys.length > 0, removedKeys };
}
