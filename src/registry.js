'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TYPES = ['agents', 'skills', 'rules', 'scripts'];
const repoRoot = path.resolve(__dirname, '..');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function firstHeading(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

// Reads `description:` from YAML frontmatter, supporting folded/literal blocks.
function frontmatterDescription(md) {
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return '';
  const lines = fm[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const dm = lines[i].match(/^description:\s*(.*)$/);
    if (!dm) continue;
    let val = dm[1].trim();
    if (val === '' || val === '>' || val === '|' || val === '>-' || val === '|-') {
      const collected = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\s+\S/.test(lines[j])) collected.push(lines[j].trim());
        else break;
      }
      val = collected.join(' ');
    }
    return val.trim();
  }
  return '';
}

function assetDescription(dir) {
  const cfg = readJson(path.join(dir, 'agentry.json'));
  if (cfg && cfg.description) return cfg.description;
  for (const f of ['SKILL.md', 'AGENT.md', 'RULE.md', 'README.md']) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    const md = fs.readFileSync(p, 'utf8');
    const d = frontmatterDescription(md) || firstHeading(md);
    if (d) return d;
  }
  return '';
}

function listType(type) {
  const base = path.join(repoRoot, type);
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      type,
      name: d.name,
      dir: path.join(base, d.name),
      description: assetDescription(path.join(base, d.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function allAssets() {
  return TYPES.flatMap(listType);
}

function getAsset(type, name) {
  return listType(type).find((a) => a.name === name) || null;
}

function loadProfiles() {
  return readJson(path.join(repoRoot, 'profiles.json')) || {};
}

function profileNames() {
  return Object.keys(loadProfiles());
}

function resolveProfile(name) {
  const profiles = loadProfiles();
  if (!(name in profiles)) return null;
  const spec = profiles[name];
  if (spec === '*' || (Array.isArray(spec) && spec.includes('*'))) return allAssets();
  return spec.map((e) => getAsset(e.type, e.name)).filter(Boolean);
}

module.exports = {
  TYPES,
  repoRoot,
  listType,
  allAssets,
  getAsset,
  loadProfiles,
  profileNames,
  resolveProfile,
};
