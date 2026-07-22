import { resolve } from 'node:path';
import { ARTIFACT_KINDS, type ArtifactKind, type InstallOpts, type AgentConfig } from './core/types.js';
import { resolveSource } from './core/git.js';
import { listKind, listAll, select } from './artifacts/discovery.js';
import { installOne, removeSelection, listInstalled } from './core/lock.js';
import {
  getAgent, listAgents, detectInstalledAgents, resolveAgents,
  getUniversalAgents, getVisibleUniversalAgents, getNonUniversalAgents,
} from './registry/agents.js';
import { loadProfile } from './artifacts/profiles.js';
import * as ui from './ui/prompts.js';
import { theme } from './ui/theme.js';
import c from 'picocolors';

export interface CliOpts {
  scope: 'global' | 'project';
  dir?: string;
  agents: string[];
  copy: boolean;
  dryRun: boolean;
  yes: boolean;
  all: boolean;
}

export async function cmdAdd(kind: ArtifactKind | 'all', source: string, selector: string | undefined, opts: CliOpts): Promise<void> {
  if (!source) throw new Error(`Missing source. e.g. agentry add ${kind} author/repo`);
  ui.intro();
  await delayQuiet(180);
  // Spinner step 1: parse source -> stops with "Source: <url>".
  await ui.spinner('Parsing source\u2026', () => parseSourceForUi(source), (p) => {
    const where = p.url || p.local || source;
    return `${c.blue('Source:')} ${where}${p.ref ? c.dim(` @ ${p.ref}`) : ''}${p.subpath ? c.dim(` (${p.subpath})`) : ''}`;
  }, 520);
  await delayQuiet(280);
  const { root, cleanup } = resolveSource(source);
  try {
    // Spinner step 2: discover -> stops with "Found N <kind>(s)".
    const artifacts = await ui.spinner('Discovering\u2026', () => (kind === 'all' ? listAll(root) : select(root, kind, selector)), (a) => {
      const noun = kind === 'all' ? 'artifact' : kind;
      return `Found ${a.length} ${noun}${a.length === 1 ? '' : 's'}`;
    }, 620);
    if (!artifacts.length) { ui.outro(c.red(`Nothing found for "${kind}${selector ? ' ' + selector : ''}" in ${source}.`)); return; }
    await delayQuiet(320);
    ui.blank();
    if (opts.dryRun) { const agents = await resolveAgentList(opts); ui.preview(artifacts, agents); return; }

    // Step 3: list with All option (visible items; All disables others).
    let chosen = artifacts;
    if (!selector && kind !== 'all' && artifacts.length > 1 && !opts.all && !opts.yes && !ui.isQuiet()) {
      await ui.sectionTransition('source discovery', `select ${kind}s to install`);
      const picked = await ui.selectArtifacts(`Select ${kind}s to install`, artifacts);
      if (ui.isCancelLike(picked)) { ui.outro('Cancelled.'); return; }
      chosen = picked as any;
      await ui.sectionTransition(
        `${chosen.length} ${kind}${chosen.length === 1 ? '' : 's'} selected`,
        'choose target agents',
      );
    } else if (!ui.isQuiet() && !opts.agents.length && !opts.all && !opts.yes) {
      await ui.sectionTransition(
        `${chosen.length} ${kind}${chosen.length === 1 ? '' : 's'} ready`,
        'choose target agents',
      );
    } else {
      await delayQuiet(200);
      ui.blank();
    }

    // Step 4: agent list with All + locked Universal.
    const agentList = await resolveAgentList(opts);
    if (!ui.isQuiet() && !opts.agents.length && !opts.all && !opts.yes) {
      await ui.sectionTransition(
        `${agentList.length} agent${agentList.length === 1 ? '' : 's'} selected`,
        'install summary',
      );
    }
    installAll(chosen, opts, agentList, source);
  } finally { cleanup(); }
}

async function delayQuiet(ms: number): Promise<void> {
  if (ui.isQuiet()) return;
  const { delay } = await import('./ui/theme.js');
  await delay(ms);
}

// Parse source for UI display (reuses source_parser).
function parseSourceForUi(source: string) {
  return import('./core/source_parser.js').then((m) => m.parseSource(source));
}

export async function cmdAddProfile(name: string, source: string | undefined, opts: CliOpts): Promise<void> {
  const { file, profile } = loadProfile(name);
  const repo = source || (profile.artifacts.skills[0]?.source ?? profile.artifacts.rules[0]?.source);
  if (!repo) throw new Error(`No source given and ${file} lists none. Try: agentry add profile ${name} author/repo`);
  const agentList = await resolveAgentList(opts);
  const { root, cleanup } = resolveSource(repo);
  try {
    const artifacts = [];
    const plural = (k: ArtifactKind): 'skills' | 'rules' | 'agents' | 'scripts' => (k === 'skill' ? 'skills' : k === 'rule' ? 'rules' : k === 'script' ? 'scripts' : 'agents');
    for (const k of ARTIFACT_KINDS) {
      if (k === 'profile') continue; // profiles are not installed as artifacts via this path
      const refs = profile.artifacts[plural(k)] ?? [];
      for (const ref of refs) {
        const src = ref.source ? resolveSource(ref.source) : { root, cleanup: () => {} };
        artifacts.push(...select(src.root, k, ref.id));
        if (ref.source) src.cleanup();
      }
    }
    if (opts.dryRun) { ui.preview(artifacts, agentList); return; }
    installAll(artifacts, opts, agentList, repo);
  } finally { cleanup(); }
}

async function resolveAgentList(opts: CliOpts): Promise<AgentConfig[]> {
  if (opts.all) return listAgents();
  if (opts.agents.length) {
    const { agents, unknown } = resolveAgents(opts.agents);
    if (unknown.length) throw new Error(`Unknown agent(s): ${unknown.join(', ')}. See --help for supported agents.`);
    return agents;
  }
  // No --agent: auto-detect installed agents as the default selection.
  const detected = detectInstalledAgents().map((a) => a.name);
  const universal = getUniversalAgents();
  const visibleUniversal = getVisibleUniversalAgents();
  const others = getNonUniversalAgents();
  const detectedOthers = detected.filter((n) => others.some((o) => o.name === n));
  if (ui.isQuiet() || opts.yes) {
    // Non-interactive: detected agents (or cursor) + universal.
    const picked = detectedOthers.length ? detectedOthers : ['cursor'];
    return [...universal, ...others.filter((o) => picked.includes(o.name))];
  }
  // Interactive: short select (All / Detected / Choose specific).
  const selected = await ui.selectAgents(
    'Which agents do you want to install to?',
    visibleUniversal,
    others,
    detectedOthers,
  );
  if (ui.isCancelLike(selected)) throw new Error('Cancelled.');
  return selected as AgentConfig[];
}

function installAll(artifacts: any[], opts: CliOpts, agentList: any[], source: string): void {
  if (!artifacts.length) { ui.warn('Nothing matched - nothing installed.'); return; }
  const where = opts.scope === 'global' ? 'global (~)' : `project (${opts.dir || process.cwd()})`;
  for (const a of artifacts) {
    installOne(a, toInstallOpts(opts), agentList, source);
  }
  ui.installSummary(artifacts, agentList, where);
}

function toInstallOpts(opts: CliOpts): InstallOpts {
  return { scope: opts.scope, dir: opts.dir, agents: opts.agents, copy: opts.copy, dryRun: opts.dryRun };
}

export async function cmdRemove(kind: ArtifactKind | 'all', selector: string | undefined, opts: CliOpts): Promise<void> {
  const agentList = await resolveAgentList(opts);
  const installOpts = toInstallOpts(opts);
  const scope = [kind, selector].filter(Boolean).join('/');
  if (kind === 'all') {
    let count = 0;
    for (const t of ARTIFACT_KINDS) count += removeSelection(t, undefined, installOpts, agentList).removedKeys.length;
    ui.ok(`Removed ${count} item(s).`);
    return;
  }
  const r = removeSelection(kind, selector, installOpts, agentList);
  if (!r.existed) { ui.warn(`Nothing installed at "${scope}".`); return; }
  for (const k of r.removedKeys) ui.step(`removed ${k}`);
  ui.ok(`Removed ${r.removedKeys.length} item(s).`);
}

export function cmdList(source: string, kind?: ArtifactKind): void {
  if (!source) throw new Error('Missing source. e.g. agentry list author/repo');
  const { root, cleanup } = resolveSource(source);
  try {
    for (const k of kind ? [kind] : ARTIFACT_KINDS) {
      ui.log(theme.info(`${k}s:`));
      const items = listKind(root, k);
      if (!items.length) { ui.step('(none)'); continue; }
      for (const it of items) {
        const desc = (it.description || '').replace(/\s+/g, ' ').slice(0, 80);
        ui.step(`${it.id}${desc ? ' - ' + desc : ''}`);
      }
    }
  } finally { cleanup(); }
}

export function cmdListInstalled(opts: CliOpts): void {
  const installed = listInstalled(toInstallOpts(opts));
  if (!installed.length) { ui.info('Nothing installed.'); return; }
  for (const it of installed) ui.step(`${it.id} -> ${it.agents.join(', ')}`);
}

export async function cmdUpdateAssets(kind: ArtifactKind | 'all', source: string | undefined, selector: string | undefined, opts: CliOpts): Promise<void> {
  const installOpts = toInstallOpts(opts);
  const agentList = await resolveAgentList(opts);
  if (source) {
    const { root, cleanup } = resolveSource(source);
    try {
      const artifacts = kind === 'all' ? listAll(root) : select(root, kind, selector);
      if (!artifacts.length) { ui.warn(`Nothing found in ${source}.`); return; }
      installAll(artifacts, opts, agentList, source);
    } finally { cleanup(); }
    return;
  }
  // No source: re-install from lockfile sources.
  const installed = listInstalled(installOpts).filter((it) => kind === 'all' || it.id.startsWith(kind + '/'));
  if (!installed.length) { ui.warn(`No installed ${kind} recorded in lockfile. Provide a source.`); return; }
  const bySource = new Map<string, string[]>();
  for (const it of installed) { if (it.source) { const arr = bySource.get(it.source) || []; arr.push(it.id); bySource.set(it.source, arr); } }
  if (!bySource.size) { ui.warn(`Installed ${kind} artifacts have no recorded source. Provide a source.`); return; }
  for (const [s, ids] of bySource) {
    const { root, cleanup } = resolveSource(s);
    try {
      const artifacts = ids.map((id) => select(root, id.split('/')[0] as ArtifactKind, id.split('/').slice(1).join('/') || undefined)).flat();
      installAll(artifacts, opts, agentList, s);
    } finally { cleanup(); }
  }
}
