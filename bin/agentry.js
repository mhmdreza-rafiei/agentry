#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { execSync } = require('node:child_process');
const reg = require('../src/registry');
const src = require('../src/source');
const prof = require('../src/profile');
const cmd = require('../src/commands');
const pkg = require('../package.json');

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-g' || a === '--global') flags.global = true;
    else if (a === '--project') flags.project = true;
    else if (a === '-y' || a === '--yes') flags.yes = true;
    else if (a === '--dir') flags.dir = argv[++i];
    else if (a === '-v' || a === '--version') flags.version = true;
    else if (a === '-h' || a === '--help') flags.help = true;
    else if (a === '--uninstall') flags.uninstall = true;
    else positional.push(a);
  }
  return { flags, positional };
}

const HELP = `agentry — a raw installer for agents, skills, rules, and scripts from any repo.

Usage:
  agentry add <type> <source> [category/name | category] [options]
  agentry add profile <name> [source] [options]
  agentry remove <type> [category/name | category] [options]
  agentry list <source> [type]
  agentry update

Sources:
  author/repo        GitHub shorthand      e.g. Prat011/awesome-llm-skills
  https://…/repo.git full git URL
  ./path             a local directory

Selectors (after the source):
  category/name   one asset      e.g. video/downloader
  name            one asset      (when the repo has no categories)
  category        a whole category
  (omitted)       list assets and pick interactively

Examples:
  agentry add skills Prat011/awesome-llm-skills                    # pick from all skills
  agentry add skills Prat011/awesome-llm-skills video/downloader   # one skill (categorized)
  agentry add skills Prat011/awesome-llm-skills video-downloader   # one skill (no category)
  agentry add agents author/repo frontend                         # a whole category
  agentry add profile frontend author/repo                        # apply profile/frontend.json
  agentry remove skills video/downloader                          # remove installed asset
  agentry list author/repo

Options:
  -g, --global     Install into ~/.cursor (all projects)
      --project    Install into the current folder (default)
      --dir <p>    Install into a specific folder
  -y, --yes        Don't prompt; install everything matched
  -v, --version    Print version
  -h, --help       Show this help
      --uninstall  Uninstall the agentry CLI`;

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function interactive(flags) {
  return process.stdin.isTTY && !flags.yes;
}

async function resolveTarget(flags) {
  if (flags.global) return { global: true };
  if (flags.project || flags.dir) return { global: false, dir: flags.dir };
  if (interactive(flags)) {
    const ans = await ask('Install location — [P]roject (this folder) or [g]lobal (home)? ');
    if (/^g/i.test(ans)) return { global: true };
  }
  return { global: false };
}

async function pick(assets) {
  console.log('Available:');
  assets.forEach((a, i) => {
    const desc = (a.description || '').replace(/\s+/g, ' ').slice(0, 60);
    console.log(`  [${i + 1}] ${a.type}/${a.id}${desc ? ' — ' + desc : ''}`);
  });
  const ans = await ask('Install which? (numbers comma-separated, or "all"): ');
  if (!ans || /^all$/i.test(ans)) return assets;
  const idx = ans
    .split(/[, ]+/)
    .map((s) => parseInt(s, 10) - 1)
    .filter((n) => n >= 0 && n < assets.length);
  return idx.map((i) => assets[i]);
}

function locationLabel(opts) {
  return opts.global ? 'globally (~/.cursor)' : `project (${cmd.targetRoot(opts)})`;
}

function dedupe(assets) {
  const seen = new Set();
  return assets.filter((a) => {
    const key = `${a.type}/${a.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function installAll(assets, opts) {
  if (!assets.length) {
    console.log('Nothing matched — nothing installed.');
    return;
  }
  console.log(`Installing ${assets.length} item(s) ${locationLabel(opts)}:`);
  for (const a of assets) {
    const dest = cmd.installOne(a, opts);
    console.log(`  + ${a.type}/${a.id} -> ${dest}`);
  }
  console.log('\nDone. Review assets before use; they run with full agent permissions.');
}

async function addType(type, source, selector, flags) {
  if (!source) throw new Error(`Missing source. e.g. agentry add ${type} author/repo`);
  const opts = await resolveTarget(flags);
  const { root, cleanup } = src.resolveSource(source);
  try {
    let assets = type === 'all' ? reg.allAssets(root) : reg.select(root, type, selector);
    if (!assets.length) throw new Error(`Nothing found for "${type}${selector ? ' ' + selector : ''}" in ${source}.`);
    if (!selector && type !== 'all' && assets.length > 1 && interactive(flags)) assets = await pick(assets);
    installAll(assets, opts);
  } finally {
    cleanup();
  }
}

async function addProfile(name, source, flags) {
  const { file, cfg } = prof.loadProfile(name);
  const repo = source || cfg.repo;
  if (!repo) throw new Error(`No source given and ${file} has no "repo". Try: agentry add profile ${name} author/repo`);
  const opts = await resolveTarget(flags);
  const { root, cleanup } = src.resolveSource(repo);
  try {
    const assets = [];
    for (const type of reg.TYPES) {
      for (const selector of cfg[type] || []) assets.push(...reg.select(root, type, selector));
    }
    installAll(dedupe(assets), opts);
  } finally {
    cleanup();
  }
}

function listSource(source, type) {
  if (!source) throw new Error('Missing source. e.g. agentry list author/repo');
  const { root, cleanup } = src.resolveSource(source);
  try {
    for (const t of type ? [type] : reg.TYPES) {
      console.log(`\n${t}:`);
      const items = reg.listType(root, t);
      if (!items.length) {
        console.log('  (none)');
        continue;
      }
      for (const it of items) {
        const desc = (it.description || '').replace(/\s+/g, ' ').slice(0, 80);
        console.log(`  ${it.id}${desc ? ' — ' + desc : ''}`);
      }
    }
  } finally {
    cleanup();
  }
}

async function remove(type, selector, flags) {
  const opts = await resolveTarget(flags);
  const scope = [type, selector].filter(Boolean).join('/');
  if (type === 'all') {
    let count = 0;
    for (const t of reg.TYPES) count += cmd.removeSelection(t, undefined, opts).removedKeys.length;
    console.log(`Removed ${count} item(s) from ${locationLabel(opts)}.`);
    return;
  }
  const r = cmd.removeSelection(type, selector, opts);
  if (!r.existed && r.removedKeys.length === 0) {
    console.log(`Nothing installed at "${scope}" in ${locationLabel(opts)}.`);
    return;
  }
  for (const k of r.removedKeys) console.log(`removed ${k}`);
  console.log(`\nRemoved ${r.removedKeys.length || 1} item(s) from ${locationLabel(opts)}.`);
}

function runUpdate() {
  console.log('Updating agentry CLI...');
  try {
    execSync('npm install -g agentry@latest', { stdio: 'inherit' });
  } catch {
    console.error('Update failed. Once published, run: npm install -g agentry@latest');
    process.exit(1);
  }
}

function runUninstall() {
  console.log('Uninstalling agentry CLI...');
  try {
    execSync('npm uninstall -g agentry', { stdio: 'inherit' });
  } catch {
    console.error('Uninstall failed. Try: npm uninstall -g agentry');
    process.exit(1);
  }
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  if (flags.version) return console.log(pkg.version);
  if (flags.uninstall) return runUninstall();
  if (flags.help || positional.length === 0) return console.log(HELP);

  const [action] = positional;

  if (action === 'update') return runUpdate();
  if (action === 'list') return listSource(positional[1], positional[2]);

  if (action === 'add') {
    const type = positional[1];
    if (!type) throw new Error('Missing type. e.g. agentry add skills author/repo');
    if (type === 'profile') return addProfile(positional[2], positional[3], flags);
    if (type !== 'all' && !reg.TYPES.includes(type)) throw new Error(`Unknown type: ${type}`);
    return addType(type, positional[2], positional[3], flags);
  }

  if (action === 'remove') {
    const type = positional[1];
    if (!type) throw new Error('Missing type. e.g. agentry remove skills video/downloader');
    if (type !== 'all' && !reg.TYPES.includes(type)) throw new Error(`Unknown type: ${type}`);
    return remove(type, positional[2], flags);
  }

  console.error(`Unknown action: ${action}\n\n${HELP}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
