#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { execSync } = require('node:child_process');
const reg = require('../src/registry');
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

const HELP = `agentry — install agents, skills, rules, and scripts into any project or globally.

Usage:
  agentry <action> <target> [name] [options]

Actions:
  add       Install asset(s) into a project or globally
  remove    Uninstall previously added asset(s)
  list      Show available assets (optionally by type)
  update    Update the agentry CLI itself

Targets:
  agents | skills | rules | scripts   A single asset type
  all                                  Every asset
  <profile>                            A named profile (e.g. frontend, backend)

Examples:
  agentry add skills                   Add all skills (asks project vs global)
  agentry add skills enhance-prompt
  agentry add agents frontend-developer
  agentry add rules ask-dont-guess
  agentry add frontend                 Add the "frontend" profile
  agentry remove skills enhance-prompt
  agentry list
  agentry update

Options:
  -g, --global     Install into your home (~/.cursor) for all projects
      --project    Install into the current folder (default)
      --dir <p>    Install into a specific folder
  -y, --yes        Don't prompt; use defaults (project)
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

async function resolveTarget(flags) {
  if (flags.global) return { global: true };
  if (flags.project || flags.dir) return { global: false, dir: flags.dir };
  if (process.stdin.isTTY && !flags.yes) {
    const ans = await ask('Install location — [P]roject (this folder) or [g]lobal (home)? ');
    if (/^g/i.test(ans)) return { global: true };
  }
  return { global: false };
}

function resolveAssets(target, name) {
  if (target === 'all') return reg.allAssets();
  if (target === 'profile') return reg.resolveProfile(name);
  if (reg.TYPES.includes(target)) {
    if (name) {
      const a = reg.getAsset(target, name);
      return a ? [a] : null;
    }
    return reg.listType(target);
  }
  if (reg.profileNames().includes(target)) return reg.resolveProfile(target);
  return null;
}

function locationLabel(opts) {
  return opts.global ? 'globally (~/.cursor)' : `project (${cmd.targetRoot(opts)})`;
}

function printList(type) {
  const groups = type ? { [type]: reg.listType(type) } : Object.fromEntries(reg.TYPES.map((t) => [t, reg.listType(t)]));
  for (const [t, items] of Object.entries(groups)) {
    console.log(`\n${t}:`);
    if (!items.length) {
      console.log('  (none)');
      continue;
    }
    for (const it of items) {
      const desc = (it.description || '').replace(/\s+/g, ' ').slice(0, 90);
      console.log(`  ${it.name}${desc ? ' — ' + desc : ''}`);
    }
  }
  const profiles = reg.profileNames();
  if (profiles.length) console.log(`\nprofiles:\n  ${profiles.join(', ')}`);
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

  const [action, target, name] = positional;

  if (action === 'list') return printList(target);
  if (action === 'update') return runUpdate();

  if (action !== 'add' && action !== 'remove') {
    console.error(`Unknown action: ${action}\n\n${HELP}`);
    process.exit(1);
  }
  if (!target) {
    console.error(`Missing target for "${action}". Try: agentry ${action} skills\n\n${HELP}`);
    process.exit(1);
  }

  const opts = await resolveTarget(flags);

  if (action === 'remove') {
    const assets = resolveAssets(target, name);
    if (assets === null && !reg.TYPES.includes(target)) {
      console.error(`Unknown target: ${target}`);
      process.exit(1);
    }
    const toRemove = assets && assets.length ? assets : name ? [{ type: target, name }] : reg.listType(target);
    let count = 0;
    for (const a of toRemove) {
      if (cmd.removeOne(a.type, a.name, opts)) {
        count++;
        console.log(`removed ${a.type}/${a.name}`);
      }
    }
    console.log(`\nRemoved ${count} item(s) from ${locationLabel(opts)}.`);
    return;
  }

  const assets = resolveAssets(target, name);
  if (!assets) {
    console.error(`Nothing found for "${target}${name ? ' ' + name : ''}". Try: agentry list`);
    process.exit(1);
  }
  if (!assets.length) {
    console.log(`No assets to add for "${target}".`);
    return;
  }
  console.log(`Installing ${assets.length} item(s) ${locationLabel(opts)}:`);
  for (const a of assets) {
    const dest = cmd.installOne(a, opts);
    console.log(`  + ${a.type}/${a.name} -> ${dest}`);
  }
  console.log('\nDone. Review assets before use; they run with full agent permissions.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
