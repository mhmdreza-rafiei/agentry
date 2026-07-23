#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import { version, name as pkgName } from '../package.json' with { type: 'json' };
import { ARTIFACT_KINDS, type ArtifactKind } from './core/types.js';
import {
  cmdAdd, cmdAddProfile, cmdRemove, cmdList, cmdUpdateAssets, cmdInit, type CliOpts,
} from './commands.js';
import { animateLogo, theme, printHelp } from './ui/theme.js';
import * as ui from './ui/prompts.js';
import { isExplicitSource } from './core/source_parser.js';

interface ParsedArgs {
  opts: CliOpts;
  positional: string[];
  flags: Record<string, boolean | string>;
}

function takeOptValue(argv: string[], i: number): { value: string | true; next: number } {
  const next = argv[i + 1];
  if (next && !next.startsWith('-')) return { value: next, next: i + 1 };
  return { value: true, next: i };
}

function parseArgs(argv: string[]): ParsedArgs {
  const opts: CliOpts = {
    scope: 'project',
    agents: [],
    copy: false,
    dryRun: false,
    yes: false,
    all: false,
    initKinds: {},
  };
  const positional: string[] = [];
  const flags: Record<string, boolean | string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '-g' || a === '--global') { opts.scope = 'global'; flags.global = true; }
    else if (a === '--project') { opts.scope = 'project'; flags.project = true; }
    else if (a === '-y' || a === '--yes') { opts.yes = true; flags.yes = true; }
    else if (a === '--dir') { opts.dir = argv[++i]; flags.dir = opts.dir!; }
    else if (a === '-a' || a === '--agent') { opts.agents.push(argv[++i]!); flags.agent = true; }
    else if (a === '-l' || a === '--list') { opts.dryRun = true; flags.list = true; }
    else if (a === '--copy') { opts.copy = true; flags.copy = true; }
    else if (a === '--all') { opts.all = true; flags.all = true; }
    else if (a === '--description') { opts.description = argv[++i]; flags.description = opts.description!; }
    else if (a === '--alwaysApply' || a === '--always-apply') { opts.alwaysApply = true; flags.alwaysApply = true; }
    else if (a === '--reference') { opts.reference = true; flags.reference = true; }
    else if (a === '--no-reference') { opts.reference = false; flags.reference = false; }
    else if (a === '--skills') {
      const { value, next } = takeOptValue(argv, i);
      opts.initKinds!.skills = value;
      i = next;
      flags.skills = true;
    }
    else if (a === '--agents') {
      const { value, next } = takeOptValue(argv, i);
      opts.initKinds!.agents = value;
      i = next;
      flags.agents = true;
    }
    else if (a === '--rules') {
      const { value, next } = takeOptValue(argv, i);
      opts.initKinds!.rules = value;
      i = next;
      flags.rules = true;
    }
    else if (a === '--scripts') {
      const { value, next } = takeOptValue(argv, i);
      opts.initKinds!.scripts = value;
      i = next;
      flags.scripts = true;
    }
    else if (a === '-v' || a === '--version') { flags.version = true; }
    else if (a === '-h' || a === '--help') { flags.help = true; }
    else positional.push(a);
  }
  return { opts, positional, flags };
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function runUpdateSelf(): Promise<void> {
  ui.log(theme.info('Checking agentry version...'));
  let latest: string | undefined;
  try {
    const data = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`);
    latest = data?.version;
  } catch {
    ui.warn('Could not reach npm registry; running self-update anyway.');
    runNpmInstall(`${pkgName}@latest`);
    return;
  }
  if (latest && latest === version) { ui.ok(`Already up to date (v${version}).`); return; }
  ui.log(`Current v${version} -> latest ${latest || 'unknown'}`);
  runNpmInstall(`${pkgName}@latest`);
}

function runNpmInstall(spec: string): void {
  ui.spinner(`Updating agentry CLI`, () => {
    try { execFileSync('npm', ['install', '-g', spec], { stdio: 'inherit' }); }
    catch { ui.err('Update failed. Once published, run: npm install -g ' + spec); process.exit(1); }
  });
}

function runUninstall(): void {
  ui.spinner('Uninstalling agentry CLI', () => {
    try { execFileSync('npm', ['uninstall', '-g', pkgName], { stdio: 'inherit' }); }
    catch { ui.err('Uninstall failed. Try: npm uninstall -g ' + pkgName); process.exit(1); }
  });
}

function isKind(s: string): s is ArtifactKind {
  return (ARTIFACT_KINDS as string[]).includes(s);
}

// Accept both singular and plural: skills->skill, agents->agent, rules->rule, profiles->profile.
function normalizeKind(s: string): string {
  return s.endsWith('s') ? s.slice(0, -1) : s;
}

async function main(): Promise<void> {
  const { opts, positional, flags } = parseArgs(process.argv.slice(2));
  if (flags.version) { ui.log(version); return; }
  if (flags.help || positional.length === 0) {
    if (!ui.isQuiet()) await animateLogo();
    printHelp();
    return;
  }
  const [action] = positional;
  if (!ui.isQuiet()) await animateLogo();

  if (action === 'uninstall') { runUninstall(); return; }
  if (action === 'update') {
    if (positional.length === 1) { await runUpdateSelf(); return; }
    const kind = normalizeKind(positional[1]!);
    if (kind !== 'all' && !isKind(kind)) throw new Error(`Unknown kind: ${kind}`);
    await cmdUpdateAssets(kind as ArtifactKind | 'all', positional[2], positional[3], opts);
    return;
  }
  if (action === 'list') {
    // Grammar:
    //   list                         → installed (all)
    //   list <kind>                  → installed filtered by kind
    //   list <source>                → discover in source
    //   list <source> <kind>         → discover kind
    //   list <source> <kind> <sel>   → discover selector
    const a1 = positional[1];
    const a2 = positional[2];
    const a3 = positional[3];
    if (!a1) {
      await cmdList(undefined, undefined, undefined, opts);
      return;
    }
    const k1 = normalizeKind(a1);
    if (isKind(k1) && !isExplicitSource(a1) && !/^[\w.-]+\/[\w.-]+$/.test(a1)) {
      // list skills [selector] — installed filter (bare kind, not owner/repo)
      await cmdList(undefined, k1 as ArtifactKind, a2, opts);
      return;
    }
    // list <source> [kind] [selector]
    const kind = a2 ? normalizeKind(a2) : undefined;
    if (kind && kind !== 'all' && !isKind(kind)) throw new Error(`Unknown kind: ${kind}`);
    await cmdList(a1, kind && isKind(kind) ? (kind as ArtifactKind) : undefined, a3, opts);
    return;
  }
  if (action === 'add') {
    const kind = positional[1] ? normalizeKind(positional[1]) : undefined;
    if (!kind) throw new Error('Missing kind. e.g. agentry add skills author/repo');
    if (kind === 'profile') { await cmdAddProfile(positional[2]!, positional[3], opts); return; }
    if (kind !== 'all' && !isKind(kind)) throw new Error(`Unknown kind: ${kind}`);
    await cmdAdd(kind as ArtifactKind | 'all', positional[2]!, positional[3], opts);
    return;
  }
  if (action === 'remove' || action === 'rm') {
    const kind = positional[1] ? normalizeKind(positional[1]) : undefined;
    if (!kind) throw new Error('Missing kind. e.g. agentry remove skills enhance-prompt');
    if (kind !== 'all' && !isKind(kind)) throw new Error(`Unknown kind: ${kind}`);
    await cmdRemove(kind as ArtifactKind | 'all', positional[2], positional[3], opts);
    return;
  }
  if (action === 'init') {
    const kind = positional[1] ? normalizeKind(positional[1]) : undefined;
    if (!kind || !isKind(kind)) throw new Error('Missing kind. e.g. agentry init skill my-skill [category]');
    // agentry init skills name [category]  OR  init skills category name — name first, category second.
    await cmdInit(kind, positional[2], positional[3], opts);
    return;
  }
  ui.err(`Unknown action: ${action}`); printHelp(); process.exit(1);
}

main().catch((e) => { ui.err(e.message || String(e)); process.exit(1); });
