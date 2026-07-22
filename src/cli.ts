#!/usr/bin/env node
import { execSync } from 'node:child_process';
import https from 'node:https';
import { version, name as pkgName } from '../package.json' with { type: 'json' };
import { ARTIFACT_KINDS, type ArtifactKind } from './core/types.js';
import { cmdAdd, cmdAddProfile, cmdRemove, cmdList, cmdListInstalled, cmdUpdateAssets, type CliOpts } from './commands.js';
import { logo, tagline, theme } from './ui/theme.js';
import * as ui from './ui/prompts.js';

const HELP = `agentry — install agents, skills, rules & profiles onto AI coding agents.

Usage:
  agentry add <kind> <source> [category/name | category] [options]
  agentry add profile <name> [source] [options]
  agentry remove <kind> [category/name | category] [options]
  agentry list [source] [kind]
  agentry update [kind] [source] [selector]
  agentry uninstall

Kinds: skill | rule | agent | profile   (or "all")

Sources:
  author/repo            GitHub shorthand
  https://github.com/owner/repo
  https://github.com/owner/repo/tree/<ref>/<dir>
  https://gitlab.com/org/repo
  git@github.com:owner/repo.git
  ./path | /path | ~/path  local directory

Examples:
  agentry add skills Prat011/awesome-llm-skills
  agentry add skills ./my-skills --list
  agentry add skills ./my-skills enhance-prompt -a cursor -a claude-code
  agentry add agents author/repo frontend-developer
  agentry add profile frontend author/repo
  agentry remove skills enhance-prompt
  agentry update
  agentry update skills author/repo enhance-prompt
  agentry uninstall

Options:
  -g, --global     Install into ~ (all projects)
      --project    Install into the current folder (default)
      --dir <p>    Install into a specific folder
  -a, --agent <n>  Target provider(s); repeatable; '*' = all. Default: auto-detect.
  -l, --list       Preview what would be installed; write nothing
      --copy        Copy files instead of symlinking
      --all         Install all artifacts to all agents without prompts
  -y, --yes        Don't prompt
  -v, --version    Print version
  -h, --help       Show this help`;

interface ParsedArgs {
  opts: CliOpts;
  positional: string[];
  flags: Record<string, boolean | string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const opts: CliOpts = { scope: 'project', agents: [], copy: false, dryRun: false, yes: false, all: false };
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
    try { execSync(`npm install -g ${spec}`, { stdio: 'inherit' }); }
    catch { ui.err('Update failed. Once published, run: npm install -g ' + spec); process.exit(1); }
  });
}

function runUninstall(): void {
  ui.spinner('Uninstalling agentry CLI', () => {
    try { execSync(`npm uninstall -g ${pkgName}`, { stdio: 'inherit' }); }
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
    if (!ui.isQuiet()) { process.stdout.write(logo() + '\n'); process.stdout.write(tagline() + '\n\n'); }
    process.stdout.write(HELP + '\n');
    return;
  }
  const [action] = positional;
  if (!ui.isQuiet()) { process.stdout.write(logo() + '\n'); process.stdout.write(tagline() + '\n\n'); }

  if (action === 'uninstall') { runUninstall(); return; }
  if (action === 'update') {
    if (positional.length === 1) { await runUpdateSelf(); return; }
    const kind = normalizeKind(positional[1]!);
    if (kind !== 'all' && !isKind(kind)) throw new Error(`Unknown kind: ${kind}`);
    await cmdUpdateAssets(kind as ArtifactKind | 'all', positional[2], positional[3], opts);
    return;
  }
  if (action === 'list') {
    if (positional.length === 1) { cmdListInstalled(opts); return; }
    const k = positional[2] ? normalizeKind(positional[2]) : undefined;
    cmdList(positional[1]!, k && isKind(k) ? k as ArtifactKind : undefined);
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
    await cmdRemove(kind as ArtifactKind | 'all', positional[2], opts);
    return;
  }
  ui.err(`Unknown action: ${action}`); process.stdout.write(HELP + '\n'); process.exit(1);
}

main().catch((e) => { ui.err(e.message || String(e)); process.exit(1); });
