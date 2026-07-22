import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { LockFile, LockEntry, InstallOpts, Artifact, AgentConfig } from './types.js';
import { getAgent } from '../registry/agents.js';

const home = homedir();

export function lockBase(opts: Pick<InstallOpts, 'scope' | 'dir'>): string {
  return opts.scope === 'global' ? home : (opts.dir || process.cwd());
}

/** Canonical lockfile (provider-neutral). */
export function lockPath(opts: Pick<InstallOpts, 'scope' | 'dir'>): string {
  return join(lockBase(opts), '.agentry', 'lock.json');
}

/** Legacy path (Cursor-era); read-only fallback, removed after migrate. */
export function legacyLockPath(opts: Pick<InstallOpts, 'scope' | 'dir'>): string {
  return join(lockBase(opts), '.cursor', 'agentry.lock.json');
}

function tryReadLockFile(file: string): LockFile | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as LockFile;
  } catch {
    return null;
  }
}

export function readLock(opts: Pick<InstallOpts, 'scope' | 'dir'>): LockFile {
  const current = lockPath(opts);
  const fromCurrent = tryReadLockFile(current);
  if (fromCurrent) return fromCurrent;
  const legacy = legacyLockPath(opts);
  const fromLegacy = tryReadLockFile(legacy);
  if (fromLegacy) return fromLegacy;
  return { version: 1, items: {} };
}

/** Drop legacy lock after writing to `.agentry/lock.json`. */
function removeLegacyLockIfPresent(opts: Pick<InstallOpts, 'scope' | 'dir'>): void {
  const legacy = legacyLockPath(opts);
  if (existsSync(legacy)) rmSync(legacy, { force: true });
}

export function writeLock(opts: Pick<InstallOpts, 'scope' | 'dir'>, lock: LockFile): void {
  const file = lockPath(opts);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(lock, null, 2) + '\n');
  removeLegacyLockIfPresent(opts);
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
  return kind === 'skill' ? 'skills' : kind === 'rule' ? 'rules' : kind === 'agent' ? 'agents' : kind === 'script' ? 'scripts' : 'profiles';
}
export function installOne(
  artifact: Artifact,
  opts: InstallOpts,
  agentList: AgentConfig[],
  source: string,
): { agent: string; dir: string; symlinked?: boolean }[] {
  const list = agentList.length ? agentList : [getAgent('cursor')!];
  const base = lockBase(opts);
  const dests: { agent: string; dir: string; symlinked?: boolean }[] = [];

  if (opts.dryRun) {
    // Report the canonical + per-agent targets without writing.
    for (const a of list) dests.push({ agent: a.name, dir: agentDir(artifact, a, base) });
    return dests;
  }

  if (artifact.kind === 'skill') {
    // Universal + symlink system (mirrors vercel-labs/skills):
    // install ONCE to the canonical .agents/skills/<id>, then symlink
    // non-universal agent dirs to it. Universal agents share the canonical.
    const canonical = join(base, '.agents', 'skills', artifact.id);
    rmSync(canonical, { recursive: true, force: true });
    mkdirSync(join(canonical, '..'), { recursive: true });
    if (opts.copy) {
      cpSync(artifact.dir, canonical, { recursive: true });
    } else {
      try { symlinkSync(artifact.dir, canonical, 'junction' as any); } catch { cpSync(artifact.dir, canonical, { recursive: true }); }
    }
    for (const a of list) {
      if (a.skillsDir === '.agents/skills') {
        // universal agent: shares the canonical dir directly
        dests.push({ agent: a.name, dir: canonical });
      } else {
        // non-universal agent: symlink its skillsDir/<id> -> canonical (or copy if --copy).
        const dir = join(base, a.skillsDir, artifact.id);
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(join(dir, '..'), { recursive: true });
        if (opts.copy) {
          cpSync(canonical, dir, { recursive: true });
          dests.push({ agent: a.name, dir });
        } else {
          try { symlinkSync(canonical, dir, 'junction' as any); dests.push({ agent: a.name, dir, symlinked: true }); }
          catch { cpSync(canonical, dir, { recursive: true }); dests.push({ agent: a.name, dir }); }
        }
      }
    }
  } else {
    // agents/rules/profiles/scripts: per-agent install (no universal dir for these).
    for (const a of list) {
      const dir = agentDir(artifact, a, base);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(join(dir, '..'), { recursive: true });
      if (opts.copy) {
        cpSync(artifact.dir, dir, { recursive: true });
      } else {
        try { symlinkSync(artifact.dir, dir, 'junction' as any); } catch { cpSync(artifact.dir, dir, { recursive: true }); }
      }
      dests.push({ agent: a.name, dir });
    }
  }

  const lock = readLock(opts);
  lock.items[`${artifact.kind}/${artifact.id}`] = {
    source: source || null,
    installedAt: new Date().toISOString(),
    agents: list.map((a) => a.name),
    kind: artifact.kind,
  };
  writeLock(opts, lock);
  return dests;
}

// Resolve one agent's install dir for an artifact.
function agentDir(artifact: Artifact, a: AgentConfig, base: string): string {
  if (artifact.kind === 'skill') return join(base, a.skillsDir, artifact.id);
  if (artifact.isFile) {
    const ext = artifact.kind === 'profile' ? '.yaml' : '.mdc';
    return join(base, a.configDir || a.skillsDir, pluralKind(artifact.kind), artifact.name + ext);
  }
  return join(base, a.configDir || a.skillsDir, pluralKind(artifact.kind), artifact.id);
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
