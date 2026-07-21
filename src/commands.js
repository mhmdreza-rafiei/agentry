'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Assets install under `<root>/.cursor/<type>/<category>/<name>`.
// ponytail: single target dir (.cursor) for now; per-agent targets (.claude, .codex)
// can be added later via a `target` field in each asset's agentry.json.
function targetRoot({ global: isGlobal, dir } = {}) {
  const base = isGlobal ? os.homedir() : dir || process.cwd();
  return path.join(base, '.cursor');
}

function lockPath(root) {
  return path.join(root, 'agentry.lock.json');
}

function readLock(root) {
  try {
    return JSON.parse(fs.readFileSync(lockPath(root), 'utf8'));
  } catch {
    return { version: 1, items: {} };
  }
}

function writeLock(root, lock) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(lockPath(root), JSON.stringify(lock, null, 2) + '\n');
}

function installOne(asset, opts) {
  const root = targetRoot(opts);
  const dest = path.join(root, asset.type, asset.id);
  fs.rmSync(dest, { recursive: true, force: true }); // idempotent re-install
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(asset.dir, dest, { recursive: true });
  const lock = readLock(root);
  lock.items[`${asset.type}/${asset.id}`] = { installedAt: new Date().toISOString() };
  writeLock(root, lock);
  return dest;
}

// Removes a type, a category, or a single asset from the install target.
// selector: undefined -> whole type; "category" -> category; "category/name" -> one asset.
function removeSelection(type, selector, opts) {
  const root = targetRoot(opts);
  const rel = [type, selector].filter(Boolean).join('/');
  const dest = path.join(root, rel);
  const existed = fs.existsSync(dest);
  fs.rmSync(dest, { recursive: true, force: true });
  const lock = readLock(root);
  const removedKeys = [];
  for (const key of Object.keys(lock.items)) {
    if (key === rel || key.startsWith(rel + '/')) {
      delete lock.items[key];
      removedKeys.push(key);
    }
  }
  writeLock(root, lock);
  return { existed, removedKeys };
}

module.exports = { targetRoot, lockPath, readLock, installOne, removeSelection };
