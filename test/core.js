'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const reg = require('../src/registry');
const source = require('../src/source');
const prof = require('../src/profile');
const cmd = require('../src/commands');

// Build a throwaway "source repo" with both categorized and single layouts.
function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentry-fix-'));
  const w = (rel, content) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  };
  w('skills/prompt/enhance-prompt/SKILL.md', '---\nname: enhance-prompt\ndescription: rewrite prompts\n---\n# enhance-prompt\n');
  w('skills/quick/SKILL.md', '---\nname: quick\ndescription: single skill, no category\n---\n# quick\n');
  w('agents/frontend/frontend-developer/AGENT.md', '---\nname: frontend-developer\ndescription: fe agent\n---\n# fe\n');
  w('rules/workflow/ask-dont-guess/RULE.md', '---\nname: ask-dont-guess\ndescription: ask first\n---\n# ask\n');
  w('profile/frontend.json', JSON.stringify({ agents: ['frontend'], skills: ['prompt/enhance-prompt'] }));
  return root;
}

test('discovers both categorized and single-layout assets', () => {
  const root = makeFixture();
  const ids = reg.listType(root, 'skills').map((a) => a.id);
  assert.deepEqual(ids, ['prompt/enhance-prompt', 'quick'], 'category + no-category ids');
  fs.rmSync(root, { recursive: true, force: true });
});

test('select handles category/name, bare name, and category', () => {
  const root = makeFixture();
  assert.equal(reg.select(root, 'skills', 'prompt/enhance-prompt').length, 1, 'category/name');
  assert.equal(reg.select(root, 'skills', 'quick').length, 1, 'bare name');
  assert.equal(reg.select(root, 'agents', 'frontend').length, 1, 'category');
  fs.rmSync(root, { recursive: true, force: true });
});

test('source resolves local paths and GitHub shorthand', () => {
  const root = makeFixture();
  const resolved = source.resolveSource(root);
  assert.equal(resolved.root, path.resolve(root), 'local path used as-is');
  assert.equal(source.toGitUrl('Prat011/awesome-llm-skills'), 'https://github.com/Prat011/awesome-llm-skills.git');
  assert.equal(source.toGitUrl('https://example.com/x.git'), 'https://example.com/x.git');
  fs.rmSync(root, { recursive: true, force: true });
});

test('install then remove into a temp target', () => {
  const root = makeFixture();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'agentry-tgt-'));
  const asset = reg.select(root, 'skills', 'prompt/enhance-prompt')[0];
  const dest = cmd.installOne(asset, { global: false, dir: target });
  assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')), 'copied under .cursor/skills/prompt/enhance-prompt');

  const lock = JSON.parse(fs.readFileSync(path.join(target, '.cursor', 'agentry.lock.json'), 'utf8'));
  assert.ok(lock.items['skills/prompt/enhance-prompt'], 'lock records install');

  const r = cmd.removeSelection('skills', 'prompt/enhance-prompt', { global: false, dir: target });
  assert.ok(r.existed && !fs.existsSync(dest), 'removed');
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(target, { recursive: true, force: true });
});

test('profile config loads and resolves selectors against a source', () => {
  const root = makeFixture();
  const { cfg } = prof.loadProfile('frontend', root);
  const assets = [];
  for (const type of reg.TYPES) for (const sel of cfg[type] || []) assets.push(...reg.select(root, type, sel));
  assert.ok(assets.some((a) => a.id === 'frontend/frontend-developer'), 'includes the agent');
  assert.ok(assets.some((a) => a.id === 'prompt/enhance-prompt'), 'includes the skill');
  fs.rmSync(root, { recursive: true, force: true });
});
