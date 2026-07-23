import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync, symlinkSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import type { LockFile, LockEntry, InstallOpts, Artifact, AgentConfig } from './types.js';
import { getAgent } from '../registry/agents.js';
import { sourcesEqual } from './source_parser.js';

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
  // Empty lock → drop the whole `.agentry` folder instead of leaving lock.json with {}.
  if (!Object.keys(lock.items).length) {
    const dir = join(lockBase(opts), '.agentry');
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    removeLegacyLockIfPresent(opts);
    return;
  }
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(lock, null, 2) + '\n');
  removeLegacyLockIfPresent(opts);
}

/**
 * True when a directory has no meaningful files.
 * Empty nested folders count as empty. An empty lock.json (items: {}) is ignored.
 */
export function isDirTreeEmpty(dir: string): boolean {
  if (!existsSync(dir)) return true;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return true;
  }
  for (const name of entries) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!isDirTreeEmpty(p)) return false;
      continue;
    }
    if (st.isFile()) {
      if (name === 'lock.json') {
        try {
          const data = JSON.parse(readFileSync(p, 'utf8')) as LockFile;
          if (data && typeof data === 'object' && Object.keys(data.items || {}).length === 0) continue;
        } catch {
          return false;
        }
        return false; // lock with items
      }
      return false;
    }
  }
  return true;
}

/**
 * If `dir` is an empty tree, delete it and walk parents up to (but not including) `stopAt`.
 */
export function pruneEmptyAncestors(dir: string, stopAt: string, removedPaths: string[] = []): string[] {
  const stop = resolve(stopAt);
  let cur = resolve(dir);
  while (cur.length > stop.length) {
    const prefix = stop.endsWith(sep) ? stop : stop + sep;
    if (!cur.toLowerCase().startsWith(prefix.toLowerCase()) && cur.toLowerCase() !== stop.toLowerCase()) break;
    if (!existsSync(cur)) {
      cur = dirname(cur);
      continue;
    }
    if (!isDirTreeEmpty(cur)) break;
    rmSync(cur, { recursive: true, force: true });
    removedPaths.push(cur);
    cur = dirname(cur);
  }
  return removedPaths;
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
    // Skills install once under .agents/skills, then non-universal agents link or copy.
    // Always copy into canonical — the source tree may be a temp clone.
    const canonical = join(base, '.agents', 'skills', artifact.id);
    rmSync(canonical, { recursive: true, force: true });
    mkdirSync(join(canonical, '..'), { recursive: true });
    // dereference: untrusted source trees may plant symlinks that escape the clone.
    cpSync(artifact.dir, canonical, { recursive: true, dereference: true });
    for (const a of list) {
      if (a.skillsDir === '.agents/skills') {
        dests.push({ agent: a.name, dir: canonical });
      } else {
        const dir = join(base, a.skillsDir, artifact.id);
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(join(dir, '..'), { recursive: true });
        if (opts.copy) {
          cpSync(canonical, dir, { recursive: true, dereference: true });
          dests.push({ agent: a.name, dir });
        } else {
          try { symlinkSync(canonical, dir, 'junction' as any); dests.push({ agent: a.name, dir, symlinked: true }); }
          catch { cpSync(canonical, dir, { recursive: true, dereference: true }); dests.push({ agent: a.name, dir }); }
        }
      }
    }
  } else {
    // agents/rules/profiles/scripts: per-agent install (always copy — source may be temp).
    for (const a of list) {
      const dir = agentDir(artifact, a, base);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(join(dir, '..'), { recursive: true });
      cpSync(artifact.dir, dir, { recursive: true, dereference: true });
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
// Optional `sourceFilter` limits removal to lock entries matching that install source (GitHub or local).
// Skills always delete the canonical `.agents/skills/<id>` plus any non-universal copies/symlinks.
export function removeSelection(
  kind: string,
  selector: string | undefined,
  opts: InstallOpts,
  agentList: AgentConfig[],
  sourceFilter?: string,
): { existed: boolean; removedKeys: string[]; removedPaths: string[] } {
  const base = lockBase(opts);
  const list = agentList.length ? agentList : [getAgent('cursor')!];
  const rel = [kind, selector].filter(Boolean).join('/');
  const removedKeys: string[] = [];
  const removedPaths: string[] = [];
  const lock = readLock(opts);

  const matchingKeys = Object.keys(lock.items).filter((key) => {
    const entry = lock.items[key]!;
    if (sourceFilter && !sourcesEqual(entry.source, sourceFilter)) return false;
    if (kind === 'all') return true;
    if (key === rel || key.startsWith(rel + '/')) return true;
    if (!selector && key.startsWith(kind + '/')) return true;
    return false;
  });

  const rmPath = (p: string) => {
    if (!p || !existsSync(p)) return;
    const parent = dirname(p);
    rmSync(p, { recursive: true, force: true });
    removedPaths.push(p);
    // Drop empty category/kind/.agents parents (e.g. skills/ → .agents/).
    pruneEmptyAncestors(parent, base, removedPaths);
  };

  const agentsFor = (entry: LockEntry): AgentConfig[] => {
    const fromEntry = entry.agents
      .map((n) => getAgent(n))
      .filter(Boolean) as AgentConfig[];
    const byName = new Map<string, AgentConfig>();
    for (const a of [...fromEntry, ...list]) byName.set(a.name, a);
    return [...byName.values()];
  };

  const removeFilesForKey = (key: string, entry: LockEntry) => {
    const parts = key.split('/');
    const k = parts[0]!;
    const sel = parts.slice(1).join('/') || undefined;
    if (!sel && k === 'skill') return; // never wipe entire .agents/skills

    const agents = agentsFor(entry);

    if (k === 'skill' && sel) {
      // Canonical install lives here for every universal provider.
      rmPath(join(base, '.agents', 'skills', sel));
      for (const a of agents) {
        if (a.skillsDir === '.agents/skills') continue;
        rmPath(join(base, a.skillsDir, sel));
      }
      return;
    }

    for (const a of agents) {
      if (k === 'agent' || k === 'rule' || k === 'profile') {
        const ext = k === 'profile' ? '.yaml' : '.mdc';
        if (!sel) {
          rmPath(join(base, a.configDir || a.skillsDir, pluralKind(k)));
        } else if (sel.includes('/')) {
          const [cat, name] = sel.split('/');
          rmPath(join(base, a.configDir || a.skillsDir, pluralKind(k), cat!, name + ext));
        } else {
          rmPath(join(base, a.configDir || a.skillsDir, pluralKind(k), sel + ext));
        }
      } else if (sel) {
        rmPath(join(base, a.configDir || a.skillsDir, pluralKind(k), sel));
      }
    }
  };

  for (const key of matchingKeys) {
    const entry = lock.items[key]!;
    removeFilesForKey(key, entry);
    delete lock.items[key];
    removedKeys.push(key);
  }

  // Fallback: no lock matches and no source filter — remove by filesystem path (legacy).
  if (!removedKeys.length && !sourceFilter) {
    if (kind === 'skill') {
      rmPath(join(base, '.agents', 'skills', selector || ''));
    }
    for (const a of list) {
      let dir: string;
      if (kind === 'skill') {
        if (a.skillsDir === '.agents/skills') continue;
        dir = join(base, a.skillsDir, selector || '');
      } else if (kind === 'agent' || kind === 'rule' || kind === 'profile') {
        const ext = kind === 'profile' ? '.yaml' : '.mdc';
        if (!selector) dir = join(base, a.configDir || a.skillsDir, pluralKind(kind));
        else if (selector.includes('/')) {
          const [cat, name] = selector.split('/');
          dir = join(base, a.configDir || a.skillsDir, pluralKind(kind), cat!, name + ext);
        } else {
          dir = join(base, a.configDir || a.skillsDir, pluralKind(kind), selector + ext);
        }
      } else {
        dir = join(base, a.configDir || a.skillsDir, pluralKind(kind), selector || '');
      }
      if (existsSync(dir)) {
        rmPath(dir);
        if (!removedKeys.includes(rel)) removedKeys.push(rel);
      }
    }
    for (const key of Object.keys(lock.items)) {
      if (key === rel || key.startsWith(rel + '/')) {
        delete lock.items[key];
        if (!removedKeys.includes(key)) removedKeys.push(key);
      }
    }
  }

  writeLock(opts, lock);

  // Drop empty install roots left behind after deletes.
  const sweepRoots = new Set<string>([
    join(base, '.agents', 'skills'),
    join(base, '.agents'),
    join(base, '.agentry'),
  ]);
  for (const a of list) {
    sweepRoots.add(join(base, a.skillsDir));
    if (a.configDir) {
      sweepRoots.add(join(base, a.configDir));
      for (const pk of ['skills', 'agents', 'rules', 'profiles', 'scripts']) {
        sweepRoots.add(join(base, a.configDir, pk));
      }
    }
  }
  for (const root of sweepRoots) {
    if (existsSync(root) && isDirTreeEmpty(root)) {
      pruneEmptyAncestors(root, base, removedPaths);
    }
  }

  return { existed: removedKeys.length > 0 || removedPaths.length > 0, removedKeys, removedPaths };
}
