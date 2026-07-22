import { resolve } from 'node:path';
import { ARTIFACT_KINDS, type ArtifactKind, type InstallOpts } from './core/types.js';
import { resolveSource } from './core/git.js';
import { listKind, listAll, select } from './artifacts/discovery.js';
import { installOne, removeSelection, listInstalled } from './core/lock.js';
import { getAgent, listAgents, detectInstalledAgents, resolveAgents } from './registry/agents.js';
import { loadProfile } from './artifacts/profiles.js';
import * as ui from './ui/prompts.js';
import { theme } from './ui/theme.js';

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
  const agentList = resolveAgentList(opts);
  const { root, cleanup } = resolveSource(source);
  try {
    const artifacts = kind === 'all' ? listAll(root) : select(root, kind, selector);
    if (!artifacts.length) throw new Error(`Nothing found for "${kind}${selector ? ' ' + selector : ''}" in ${source}.`);
    if (opts.dryRun) { ui.preview(artifacts, agentList); return; }
    let chosen = artifacts;
    if (!selector && kind !== 'all' && artifacts.length > 1 && !opts.all && !ui.isQuiet() && !opts.yes) {
      const picks = await ui.multiselect('Install which?', artifacts.map((a) => ({ value: a.id, label: `${a.kind}/${a.id}${a.description ? ' - ' + a.description.slice(0, 50) : ''}` })));
      if (picks.length) chosen = artifacts.filter((a) => picks.includes(a.id));
    }
    installAll(chosen, opts, agentList, source);
  } finally { cleanup(); }
}

export async function cmdAddProfile(name: string, source: string | undefined, opts: CliOpts): Promise<void> {
  const { file, profile } = loadProfile(name);
  const repo = source || (profile.artifacts.skills[0]?.source ?? profile.artifacts.rules[0]?.source);
  if (!repo) throw new Error(`No source given and ${file} lists none. Try: agentry add profile ${name} author/repo`);
  const agentList = resolveAgentList(opts);
  const { root, cleanup } = resolveSource(repo);
  try {
    const artifacts = [];
    const plural = (k: ArtifactKind): 'skills' | 'rules' | 'agents' => (k === 'skill' ? 'skills' : k === 'rule' ? 'rules' : 'agents');
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

function resolveAgentList(opts: CliOpts) {
  if (opts.all) return listAgents();
  if (opts.agents.length) {
    const { agents, unknown } = resolveAgents(opts.agents);
    if (unknown.length) throw new Error(`Unknown agent(s): ${unknown.join(', ')}. See --help for supported agents.`);
    return agents;
  }
  const detected = detectInstalledAgents();
  return detected.length ? detected : [getAgent('cursor')!];
}

function installAll(artifacts: any[], opts: CliOpts, agentList: any[], source: string): void {
  if (!artifacts.length) { ui.warn('Nothing matched - nothing installed.'); return; }
  const where = opts.scope === 'global' ? '~ (global)' : (opts.dir || process.cwd()) + ' (project)';
  ui.log(`Installing ${artifacts.length} item(s) ${where} -> ${agentList.map((a) => a.name).join(', ')}:`);
  for (const a of artifacts) {
    const dests = installOne(a, toInstallOpts(opts), agentList, source);
    for (const d of dests) ui.step(`${a.kind}/${a.id} -> ${d.agent}: ${d.dir}`);
  }
  ui.warn('Review artifacts before use; they run with full agent permissions.');
}

function toInstallOpts(opts: CliOpts): InstallOpts {
  return { scope: opts.scope, dir: opts.dir, agents: opts.agents, copy: opts.copy, dryRun: opts.dryRun };
}

export async function cmdRemove(kind: ArtifactKind | 'all', selector: string | undefined, opts: CliOpts): Promise<void> {
  const agentList = resolveAgentList(opts);
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
  const agentList = resolveAgentList(opts);
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
