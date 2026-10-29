import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_IGNORES = [
  '.git',
  '.github',
  'node_modules',
  '.agents',
  '.agentry',
  '.cursor',
  '.claude',
  '.vscode',
  'dist',
  'build',
  '.DS_Store',
];

export interface IgnoreRule {
  raw: string;
  isDirOnly: boolean;
  regex: RegExp;
}

export function parseIgnorePattern(pattern: string): IgnoreRule | null {
  const trimmed = pattern.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const isDirOnly = trimmed.endsWith('/');
  let p = isDirOnly ? trimmed.slice(0, -1) : trimmed;
  const isRootAnchored = p.startsWith('/');
  if (isRootAnchored) p = p.slice(1);

  let regexStr = '';
  for (let i = 0; i < p.length; i++) {
    const char = p[i];
    if (char === '*') {
      if (p[i + 1] === '*') {
        regexStr += '.*';
        i++;
        if (p[i + 1] === '/') i++;
      } else {
        regexStr += '[^/]*';
      }
    } else if (char === '?') {
      regexStr += '[^/]';
    } else if (['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'].includes(char!)) {
      regexStr += '\\' + char;
    } else {
      regexStr += char;
    }
  }

  let regex: RegExp;
  if (isRootAnchored) {
    regex = new RegExp(`^${regexStr}(/.*)?$`, 'i');
  } else if (p.includes('/')) {
    regex = new RegExp(`(^|/)${regexStr}(/.*)?$`, 'i');
  } else {
    regex = new RegExp(`(^|/)${regexStr}($|/)`, 'i');
  }

  return { raw: trimmed, isDirOnly, regex };
}

export function parseIgnoreFile(content: string): IgnoreRule[] {
  return content
    .split(/\r?\n/)
    .map((line) => parseIgnorePattern(line))
    .filter((r): r is IgnoreRule => r !== null);
}

export function loadIgnoreRules(root: string): IgnoreRule[] {
  const candidates = ['.agentryignore', '.agentry.ignore'];
  const rules: IgnoreRule[] = [];
  for (const name of candidates) {
    const file = join(root, name);
    if (existsSync(file)) {
      try {
        const text = readFileSync(file, 'utf8');
        rules.push(...parseIgnoreFile(text));
      } catch {
        // ignore read errors
      }
    }
  }
  return rules;
}

export function isDefaultIgnored(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const segments = normalized.split('/');
  return segments.some((s) => DEFAULT_IGNORES.includes(s));
}

export function createIgnoreMatcher(root: string): (relPath: string, isDirectory?: boolean) => boolean {
  const fileRules = loadIgnoreRules(root);

  return (relPath: string, isDirectory = false): boolean => {
    if (!relPath || relPath === '.' || relPath === './') return false;
    const normalized = relPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!normalized) return false;

    if (isDefaultIgnored(normalized)) return true;

    for (const rule of fileRules) {
      if (rule.isDirOnly && !isDirectory) {
        // A directory rule also matches any files inside that directory
        if (rule.regex.test(normalized + '/')) return true;
        continue;
      }
      if (rule.regex.test(normalized)) return true;
    }

    return false;
  };
}
