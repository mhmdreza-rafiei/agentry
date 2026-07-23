import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { xdgCache } from 'xdg-basedir';
import { parseSource, sourceIdentity, type ParsedSource } from './source_parser.js';

export interface ResolvedSource {
  root: string;
  cleanup: () => void;
  fromCache?: boolean;
}

export interface ResolveSourceOpts {
  /** Ask before using cache after a failed clone. Default: false (throw). */
  confirmCache?: (info: { url: string; cacheDir: string; error: string }) => boolean | Promise<boolean>;
}

function cacheRoot(): string {
  return join(xdgCache ?? join(homedir(), '.cache'), 'agentry', 'repos');
}

function cacheKey(parsed: ParsedSource): string {
  const id = sourceIdentity(parsed.raw);
  return createHash('sha256').update(id).digest('hex').slice(0, 20);
}

export function cacheDirFor(parsed: ParsedSource): string {
  return join(cacheRoot(), cacheKey(parsed));
}

export function hasCachedSource(source: string | ParsedSource): boolean {
  const parsed = typeof source === 'string' ? parseSource(source) : source;
  if (parsed.kind === 'local') return false;
  const dir = cacheDirFor(parsed);
  return existsSync(dir) && existsSync(join(dir, '.git'));
}

function saveToCache(parsed: ParsedSource, clonedRoot: string): void {
  const dest = cacheDirFor(parsed);
  try {
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(join(dest, '..'), { recursive: true });
    cpSync(clonedRoot, dest, { recursive: true });
  } catch {
    // Cache is best-effort — never fail the install because of it.
  }
}

function cloneTo(url: string, dest: string, ref?: string): void {
  const refArgs = ref ? ['--branch', ref, '--depth', '1'] : ['--depth', '1'];
  execFileSync('git', ['clone', '--quiet', ...refArgs, url, dest], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}

function withSubpath(root: string, subpath: string, cleanupRoot: string): ResolvedSource {
  if (!subpath) {
    return { root, cleanup: () => rmSync(cleanupRoot, { recursive: true, force: true }) };
  }
  const sub = join(root, subpath);
  if (!existsSync(sub)) {
    rmSync(cleanupRoot, { recursive: true, force: true });
    throw new Error(`Subpath "${subpath}" not found.`);
  }
  return { root: sub, cleanup: () => rmSync(cleanupRoot, { recursive: true, force: true }) };
}

/**
 * Resolve a source to a local directory.
 * Remote: shallow git clone to temp (also saved to ~/.cache/agentry/repos).
 * If clone fails and a prior cache exists, asks via confirmCache (or uses cache when confirmCache says yes).
 */
export async function resolveSource(
  source: string | ParsedSource,
  opts: ResolveSourceOpts = {},
): Promise<ResolvedSource> {
  const parsed = typeof source === 'string' ? parseSource(source) : source;

  if (parsed.kind === 'local' && parsed.local) {
    if (!existsSync(parsed.local)) throw new Error(`Path not found: ${parsed.raw}`);
    return { root: parsed.local, cleanup: () => {} };
  }

  const url = parsed.url;
  if (!url) throw new Error(`Cannot resolve source "${parsed.raw}".`);

  const tmp = mkdtempSync(join(tmpdir(), 'agentry-src-'));
  try {
    cloneTo(url, tmp, parsed.ref);
  } catch (e: any) {
    rmSync(tmp, { recursive: true, force: true });
    const detail = e.stderr ? e.stderr.toString().trim() : e.message;
    const cached = cacheDirFor(parsed);
    const cacheOk = existsSync(cached) && existsSync(join(cached, '.git'));

    if (cacheOk && opts.confirmCache) {
      const ok = await opts.confirmCache({ url, cacheDir: cached, error: detail });
      if (ok) {
        const work = mkdtempSync(join(tmpdir(), 'agentry-src-'));
        cpSync(cached, work, { recursive: true });
        const resolved = withSubpath(work, parsed.subpath, work);
        return { ...resolved, fromCache: true };
      }
    }

    const hint = cacheOk
      ? '\n(A local cache exists — re-run interactively to load it, or pass -y to auto-use cache.)'
      : '';
    throw new Error(`git clone failed for ${url}\n${detail}${hint}`);
  }

  saveToCache(parsed, tmp);
  return withSubpath(tmp, parsed.subpath, tmp);
}
