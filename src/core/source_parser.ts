import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export interface ParsedSource {
  kind: 'local' | 'github-shorthand' | 'github-url' | 'gitlab-url' | 'git-url';
  raw: string;
  url: string | null; // cloneable git URL (null for local)
  subpath: string; // optional path within the repo
  ref?: string; // optional git ref (from GitHub tree URL)
  local: string | null; // resolved absolute path (local only)
}

export function isLocalPath(source: string): boolean {
  if (!source) return false;
  if (source === '.' || source === '..') return true;
  if (source.startsWith('./') || source.startsWith('../') || source.startsWith('/') || source.startsWith('~')) return true;
  try { return existsSync(source) && statSync(source).isDirectory(); } catch { return false; }
}

function parseGithubTreeUrl(url: string) {
  const m = url.match(/^https?:\/\/github\.com\/([\w.-]+\/[\w.-]+?)\/tree\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { ownerRepo: m[1]!, ref: m[2]!, subpath: m[3]!.replace(/\/+$/, '') };
}

export function parseSource(source: string): ParsedSource {
  if (!source || typeof source !== 'string') throw new Error('Empty source.');
  const raw = source;

  if (isLocalPath(source)) {
    return { kind: 'local', raw, url: null, subpath: '', local: resolve(source.replace(/^~/, homedir())) };
  }

  const tree = parseGithubTreeUrl(source);
  if (tree) {
    return { kind: 'github-url', raw, url: `https://github.com/${tree.ownerRepo}.git`, subpath: tree.subpath, ref: tree.ref, local: null };
  }

  let m = source.match(/^https?:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/);
  if (m) return { kind: 'github-url', raw, url: `https://github.com/${m[1]}.git`, subpath: '', local: null };

  m = source.match(/^https?:\/\/gitlab\.com\/([\w./-]+?)(?:\.git)?\/?$/);
  if (m) return { kind: 'gitlab-url', raw, url: `https://gitlab.com/${m[1]}.git`, subpath: '', local: null };

  if (source.startsWith('git@') || /^https?:\/\/.*\.git$/.test(source)) {
    return { kind: 'git-url', raw, url: source, subpath: '', local: null };
  }

  if (/^[\w.-]+\/[\w.-]+$/.test(source)) {
    return { kind: 'github-shorthand', raw, url: `https://github.com/${source}.git`, subpath: '', local: null };
  }

  throw new Error(`Cannot parse source "${source}". Use author/repo, a GitHub/GitLab URL, a git URL, or a local path.`);
}

/** Normalize a source string for lockfile matching (URL/path identity). */
export function sourceIdentity(source: string): string {
  try {
    const p = parseSource(source);
    if (p.kind === 'local' && p.local) return `local:${resolve(p.local).replace(/\\/g, '/').toLowerCase()}`;
    const url = (p.url || '').replace(/\.git$/i, '').replace(/\/+$/, '').toLowerCase();
    const sub = p.subpath ? `/${p.subpath.replace(/^\/+|\/+$/g, '')}` : '';
    const ref = p.ref ? `@${p.ref}` : '';
    return `git:${url}${sub}${ref}`;
  } catch {
    return `raw:${source.trim().toLowerCase()}`;
  }
}

export function sourcesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return sourceIdentity(a) === sourceIdentity(b);
}

/** True for local paths, URLs, git@ — not ambiguous author/repo vs category/name. */
export function isExplicitSource(arg: string): boolean {
  if (!arg) return false;
  if (isLocalPath(arg)) return true;
  if (/^https?:\/\//i.test(arg)) return true;
  if (arg.startsWith('git@')) return true;
  if (/^https?:\/\/.*\.git$/i.test(arg)) return true;
  return false;
}

/** True if arg looks like GitHub owner/repo (same shape as category/name). */
export function isOwnerRepoShape(arg: string): boolean {
  return /^[\w.-]+\/[\w.-]+$/.test(arg);
}
