'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function isLocalPath(source) {
  return (
    source.startsWith('.') ||
    source.startsWith('/') ||
    source.startsWith('~') ||
    fs.existsSync(source)
  );
}

// Accepts a full git URL or the "author/repo" GitHub shorthand.
function toGitUrl(source) {
  if (/^https?:\/\//.test(source) || source.startsWith('git@')) return source;
  if (/^[\w.-]+\/[\w.-]+$/.test(source)) return `https://github.com/${source}.git`;
  return null;
}

// Resolves a source (local path | author/repo | git URL) to a local root.
// Remote sources are shallow-cloned to a temp dir; call cleanup() when done.
function resolveSource(source) {
  if (isLocalPath(source)) {
    const root = path.resolve(source.replace(/^~/, os.homedir()));
    if (!fs.existsSync(root)) throw new Error(`Path not found: ${source}`);
    return { root, cleanup() {} };
  }
  const url = toGitUrl(source);
  if (!url) throw new Error(`Cannot resolve source "${source}". Use a local path, author/repo, or git URL.`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentry-src-'));
  try {
    execFileSync('git', ['clone', '--depth', '1', '--quiet', url, tmp], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    const detail = e.stderr ? e.stderr.toString().trim() : e.message;
    throw new Error(`git clone failed for ${url}\n${detail}`);
  }
  return {
    root: tmp,
    cleanup() {
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

module.exports = { isLocalPath, toGitUrl, resolveSource };
