'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const reg = require('../src/registry');
const cmd = require('../src/commands');

test('registry discovers the migrated enhance-prompt skill', () => {
  const asset = reg.getAsset('skills', 'enhance-prompt');
  assert.ok(asset, 'enhance-prompt asset resolves');
  assert.ok(fs.existsSync(path.join(asset.dir, 'SKILL.md')), 'SKILL.md present');
  assert.ok(asset.description, 'description resolved from frontmatter');
});

test('add then remove an asset into a temp project', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentry-'));
  const asset = reg.getAsset('skills', 'enhance-prompt');
  const dest = cmd.installOne(asset, { global: false, dir });
  assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')), 'SKILL.md copied to target');

  const lock = JSON.parse(fs.readFileSync(path.join(dir, '.cursor', 'agentry.lock.json'), 'utf8'));
  assert.ok(lock.items['skills/enhance-prompt'], 'lock records the install');

  const existed = cmd.removeOne('skills', 'enhance-prompt', { global: false, dir });
  assert.ok(existed, 'remove reports the asset existed');
  assert.ok(!fs.existsSync(dest), 'asset removed from target');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('profiles resolve to concrete assets', () => {
  const frontend = reg.resolveProfile('frontend');
  assert.ok(Array.isArray(frontend) && frontend.length > 0, 'frontend profile resolves');
  assert.ok(frontend.some((a) => a.type === 'agents' && a.name === 'frontend-developer'), 'includes frontend-developer');

  const all = reg.resolveProfile('all');
  assert.ok(all.length >= frontend.length, 'all profile is the superset');
});
