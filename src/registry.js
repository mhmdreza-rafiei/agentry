'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Discovers assets inside a *source root* (a fetched repo or local path).
// Two discovery modes, unioned:
//   1) Under <type>/ :   <type>/<name>/  or  <type>/<category>/<name>/
//   2) At the repo root (like `npx skills add`), classified by a marker file:
//        <name>/SKILL.md            -> skills/<name>
//        <group>/<name>/SKILL.md    -> skills/<group>/<name>
//      (AGENT.md -> agents, RULE.md -> rules). Scripts have no root marker.
const TYPES = ['agents', 'skills', 'rules', 'scripts'];
const MARKERS = { skills: 'SKILL.md', agents: 'AGENT.md', rules: 'RULE.md', scripts: null };

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function entries(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function hasFile(dir) {
  return entries(dir).some((e) => e.isFile());
}

function firstHeading(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

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

function hasMarker(dir, marker) {
  return !!marker && fs.existsSync(path.join(dir, marker));
}

function makeAsset(type, category, name, dir) {
  const id = category ? `${category}/${name}` : name;
  return { type, category, name, id, dir, description: assetDescription(dir) };
}

// Assets living under an explicit <type>/ folder (this repo's own convention).
function collectFromTypeDir(base, type, out) {
  for (const child of entries(base)) {
    if (!child.isDirectory()) continue;
    const childDir = path.join(base, child.name);
    if (hasFile(childDir)) {
      out.push(makeAsset(type, null, child.name, childDir));
    } else {
      for (const item of entries(childDir)) {
        if (!item.isDirectory()) continue;
        out.push(makeAsset(type, child.name, item.name, path.join(childDir, item.name)));
      }
    }
  }
}

// Assets at the repo root, identified by marker file (e.g. SKILL.md).
function collectFromRoot(root, type, marker, out) {
  if (!marker) return;
  for (const child of entries(root)) {
    if (!child.isDirectory()) continue;
    if (child.name.startsWith('.') || child.name === 'node_modules' || TYPES.includes(child.name)) continue;
    const childDir = path.join(root, child.name);
    if (hasMarker(childDir, marker)) {
      out.push(makeAsset(type, null, child.name, childDir));
    } else {
      for (const item of entries(childDir)) {
        if (item.isDirectory() && hasMarker(path.join(childDir, item.name), marker)) {
          out.push(makeAsset(type, child.name, item.name, path.join(childDir, item.name)));
        }
      }
    }
  }
}

function listType(root, type) {
  const out = [];
  const base = path.join(root, type);
  if (fs.existsSync(base)) collectFromTypeDir(base, type, out);
  collectFromRoot(root, type, MARKERS[type], out);
  const seen = new Set();
  return out
    .filter((a) => (seen.has(a.id) ? false : seen.add(a.id)))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function allAssets(root) {
  return TYPES.flatMap((t) => listType(root, t));
}

// selector: undefined -> whole type; "category/name" -> one asset;
// "category" -> whole category; bare name -> fallback exact-name match.
function select(root, type, selector) {
  const items = listType(root, type);
  if (!selector) return items;
  if (selector.includes('/')) return items.filter((a) => a.id === selector);
  const byCategory = items.filter((a) => a.category === selector);
  if (byCategory.length) return byCategory;
  return items.filter((a) => a.name === selector);
}

module.exports = { TYPES, listType, allAssets, select };
