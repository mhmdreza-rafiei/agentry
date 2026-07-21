'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Assets install under `<root>/.cursor/<type>/<name>`.
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
  const dest = path.join(root, asset.type, asset.name);
  fs.rmSync(dest, { recursive: true, force: true }); // idempotent re-install
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(asset.dir, dest, { recursive: true });
  const lock = readLock(root);
  lock.items[`${asset.type}/${asset.name}`] = { installedAt: new Date().toISOString() };
  writeLock(root, lock);
  return dest;
}

function removeOne(type, name, opts) {
  const root = targetRoot(opts);
  const dest = path.join(root, type, name);
  const existed = fs.existsSync(dest);
  fs.rmSync(dest, { recursive: true, force: true });
  const lock = readLock(root);
  delete lock.items[`${type}/${name}`];
  writeLock(root, lock);
  return existed;
}

module.exports = { targetRoot, lockPath, readLock, installOne, removeOne };
