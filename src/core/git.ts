import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSource, type ParsedSource } from './source_parser.js';

export interface ResolvedSource {
  root: string;
  cleanup: () => void;
}

export function resolveSource(source: string | ParsedSource): ResolvedSource {
  const parsed = typeof source === 'string' ? parseSource(source) : source;

  if (parsed.kind === 'local' && parsed.local) {
    if (!existsSync(parsed.local)) throw new Error(`Path not found: ${parsed.raw}`);
    return { root: parsed.local, cleanup: () => {} };
  }

  const url = parsed.url;
  if (!url) throw new Error(`Cannot resolve source "${parsed.raw}".`);

  const tmp = mkdtempSync(join(tmpdir(), 'agentry-src-'));
  try {
    const refArgs = parsed.ref ? ['--branch', parsed.ref, '--depth', '1'] : ['--depth', '1'];
    execFileSync('git', ['clone', '--quiet', ...refArgs, url, tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e: any) {
    rmSync(tmp, { recursive: true, force: true });
    const detail = e.stderr ? e.stderr.toString().trim() : e.message;
    throw new Error(`git clone failed for ${url}\n${detail}`);
  }

  if (parsed.subpath) {
    const sub = join(tmp, parsed.subpath);
    if (!existsSync(sub)) {
      rmSync(tmp, { recursive: true, force: true });
      throw new Error(`Subpath "${parsed.subpath}" not found in ${url}.`);
    }
    return { root: sub, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
  }

  return { root: tmp, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}
