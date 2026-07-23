import { ARTIFACT_KINDS, type ArtifactKind, type InstallOpts, type AgentConfig, type Artifact } from './core/types.js';
import { resolveSource } from './core/git.js';
import { listKind, listAll, select } from './artifacts/discovery.js';
import { installOne, removeSelection, listInstalled, readLock } from './core/lock.js';
import {
  getAgent, listAgents, detectInstalledAgents, resolveAgents,
  getUniversalAgents, getVisibleUniversalAgents, getNonUniversalAgents,
} from './registry/agents.js';
import { loadProfile } from './artifacts/profiles.js';
import {
  scaffoldSkill, scaffoldMdc, scaffoldScript, scaffoldProfile,
} from './artifacts/scaffold.js';
import {
  isExplicitSource, isOwnerRepoShape, sourcesEqual, parseSource,
} from './core/source_parser.js';
import * as ui from './ui/prompts.js';
import { theme, sky } from './ui/theme.js';
import c from 'picocolors';
import * as clack from '@clack/prompts';

export interface CliOpts {
  scope: 'global' | 'project';
  dir?: string;
  agents: string[];
  copy: boolean;
  dryRun: boolean;
  yes: boolean;
  all: boolean;
  description?: string;
  alwaysApply?: boolean;
  reference?: boolean;
  /** Profile init: include kinds + optional source per kind. */
  initKinds?: Partial<Record<'skills' | 'agents' | 'rules' | 'scripts', string | true>>;
}

/** Resolve source; on clone failure offer (or auto-use with -y) the local git cache. */
async function resolveSourceWithUi(source: string, opts: CliOpts) {
  const resolved = await resolveSource(source, {
    confirmCache: async ({ url, error }) => {
      ui.warn(`git clone failed for ${url}`);
      if (error) ui.step(c.dim(error.split('\n')[0] || error));
      if (opts.yes || ui.isQuiet()) {
        ui.info('Using cached copy.');
        return true;
      }
      return ui.confirm('Load from cache instead?');
    },
  });
  if (resolved.fromCache) ui.info('Loaded source from cache.');
  return resolved;
}

export async function cmdAdd(kind: ArtifactKind | 'all', source: string, selector: string | undefined, opts: CliOpts): Promise<void> {
  if (!source) throw new Error(`Missing source. e.g. agentry add ${kind} author/repo`);
  ui.intro();
  await delayQuiet(180);
  await ui.spinner('Parsing source\u2026', () => parseSourceForUi(source), (p) => {
    const where = p.url || p.local || source;
    return `${theme.primary('Source:')} ${where}${p.ref ? c.dim(` @ ${p.ref}`) : ''}${p.subpath ? c.dim(` (${p.subpath})`) : ''}`;
  }, 520);
  await delayQuiet(280);
  const { root, cleanup } = await resolveSourceWithUi(source, opts);
  try {
    const artifacts = await ui.spinner('Discovering\u2026', () => (kind === 'all' ? listAll(root) : select(root, kind, selector)), (a) => {
      const noun = kind === 'all' ? 'artifact' : kind;
      return `Found ${a.length} ${noun}${a.length === 1 ? '' : 's'}`;
    }, 620);
    if (!artifacts.length) { ui.outro(c.red(`Nothing found for "${kind}${selector ? ' ' + selector : ''}" in ${source}.`)); return; }
    await delayQuiet(320);
    ui.blank();
    if (opts.dryRun) { const agents = await resolveAgentList(opts, 'install'); ui.preview(artifacts, agents); return; }

    let chosen = artifacts;
    if (!selector && kind !== 'all' && artifacts.length > 1 && !opts.all && !opts.yes && !ui.isQuiet()) {
      await ui.sectionTransition('source discovery', `select ${kind}s to install`);
      const picked = await ui.selectArtifacts(`Select ${kind}s to install`, artifacts);
      if (ui.isCancelLike(picked)) { ui.outro('Cancelled.'); return; }
      chosen = picked as Artifact[];
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

    const agentList = await resolveAgentList(opts, 'install');
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

function parseSourceForUi(source: string) {
  return parseSource(source);
}

export async function cmdAddProfile(name: string, source: string | undefined, opts: CliOpts): Promise<void> {
  const { file, profile } = loadProfile(name);
  const repo = source || (profile.artifacts.skills[0]?.source ?? profile.artifacts.rules[0]?.source);
  if (!repo) throw new Error(`No source given and ${file} lists none. Try: agentry add profile ${name} author/repo`);
  const agentList = await resolveAgentList(opts, 'install');
  const { root, cleanup } = await resolveSourceWithUi(repo, opts);
  try {
    const artifacts = [];
    const plural = (k: ArtifactKind): 'skills' | 'rules' | 'agents' | 'scripts' => (k === 'skill' ? 'skills' : k === 'rule' ? 'rules' : k === 'script' ? 'scripts' : 'agents');
    for (const k of ARTIFACT_KINDS) {
      if (k === 'profile') continue;
      const refs = profile.artifacts[plural(k)] ?? [];
      for (const ref of refs) {
        const src = ref.source ? await resolveSourceWithUi(ref.source, opts) : { root, cleanup: () => {} };
        artifacts.push(...select(src.root, k, ref.id));
        if (ref.source) src.cleanup();
      }
    }
    if (opts.dryRun) { ui.preview(artifacts, agentList); return; }
    installAll(artifacts, opts, agentList, repo);
  } finally { cleanup(); }
}

async function resolveAgentList(opts: CliOpts, action: ui.AgentAction = 'install'): Promise<AgentConfig[]> {
  if (opts.all) return listAgents();
  if (opts.agents.length) {
    const { agents, unknown } = resolveAgents(opts.agents);
    if (unknown.length) throw new Error(`Unknown agent(s): ${unknown.join(', ')}. See --help for supported agents.`);
    return agents;
  }
  const detected = detectInstalledAgents().map((a) => a.name);
  const universal = getUniversalAgents();
  const visibleUniversal = getVisibleUniversalAgents();
  const others = getNonUniversalAgents();
  const detectedOthers = detected.filter((n) => others.some((o) => o.name === n));
  if (ui.isQuiet() || opts.yes) {
    const picked = detectedOthers.length ? detectedOthers : ['cursor'];
    return [...universal, ...others.filter((o) => picked.includes(o.name))];
  }
  const selected = await ui.selectAgents(
    ui.agentsPrompt(action),
    visibleUniversal,
    others,
    detectedOthers,
  );
  if (ui.isCancelLike(selected)) throw new Error('Cancelled.');
  return selected as AgentConfig[];
}

function installAll(artifacts: Artifact[], opts: CliOpts, agentList: AgentConfig[], source: string): void {
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

/** Resolve remove/update arg: source vs selector (author/repo is ambiguous). */
function resolveSourceOrSelector(
  arg1: string | undefined,
  arg2: string | undefined,
  opts: CliOpts,
): { source?: string; selector?: string } {
  if (arg1 && arg2) return { source: arg1, selector: arg2 };
  if (!arg1) return {};
  if (isExplicitSource(arg1)) return { source: arg1 };
  if (isOwnerRepoShape(arg1)) {
    const lock = readLock(toInstallOpts(opts));
    const hit = Object.values(lock.items).some((e) => e.source && sourcesEqual(e.source, arg1));
    if (hit) return { source: arg1 };
  }
  return { selector: arg1 };
}

export async function cmdRemove(
  kind: ArtifactKind | 'all',
  arg1: string | undefined,
  arg2: string | undefined,
  opts: CliOpts,
): Promise<void> {
  ui.intro();
  const { source, selector } = resolveSourceOrSelector(arg1, arg2, opts);
  if (source) {
    await ui.spinner('Resolving source\u2026', () => parseSource(source), (p) => {
      const where = p.url || p.local || source;
      return `${theme.primary('Source:')} ${where}${p.ref ? c.dim(` @ ${p.ref}`) : ''}`;
    }, 420);
  }
  if (!ui.isQuiet() && !opts.agents.length && !opts.all && !opts.yes) {
    await ui.sectionTransition('prepare remove', 'choose agents to remove from');
  }
  const agentList = await resolveAgentList(opts, 'remove');
  const installOpts = toInstallOpts(opts);
  const scope = [kind, source, selector].filter(Boolean).join(' / ');

  if (kind === 'all') {
    let count = 0;
    let paths = 0;
    for (const t of ARTIFACT_KINDS) {
      const r = removeSelection(t, undefined, installOpts, agentList, source);
      count += r.removedKeys.length;
      paths += r.removedPaths.length;
    }
    ui.ok(`Removed ${count} item(s)${paths ? c.dim(` · ${paths} path(s)`) : ''}${source ? c.dim(` from ${source}`) : ''}.`);
    return;
  }
  const r = removeSelection(kind, selector, installOpts, agentList, source);
  if (!r.existed) {
    ui.warn(`Nothing installed matching "${scope}".`);
    return;
  }
  for (const k of r.removedKeys) ui.step(`removed ${k}`);
  for (const p of r.removedPaths.slice(0, 12)) ui.step(c.dim(`deleted ${p}`));
  if (r.removedPaths.length > 12) ui.step(c.dim(`…and ${r.removedPaths.length - 12} more paths`));
  ui.ok(`Removed ${r.removedKeys.length} item(s)${r.removedPaths.length ? c.dim(` · ${r.removedPaths.length} path(s)`) : ''}${source ? c.dim(` from ${source}`) : ''}.`);
}

export async function cmdList(
  source: string | undefined,
  kind: ArtifactKind | undefined,
  selector: string | undefined,
  opts: CliOpts,
): Promise<void> {
  // No source → installed inventory (optional kind/selector filters).
  if (!source) {
    cmdListInstalled(opts, kind, selector);
    return;
  }
  ui.intro();
  await ui.spinner('Parsing source\u2026', () => parseSource(source), (p) => {
    const where = p.url || p.local || source;
    return `${theme.primary('Source:')} ${where}${p.ref ? c.dim(` @ ${p.ref}`) : ''}${p.subpath ? c.dim(` (${p.subpath})`) : ''}`;
  }, 420);
  const { root, cleanup } = await resolveSourceWithUi(source, opts);
  try {
    const artifacts = await ui.spinner(
      'Discovering\u2026',
      () => {
        if (kind) return select(root, kind, selector);
        return listAll(root);
      },
      (a) => `Found ${a.length} artifact${a.length === 1 ? '' : 's'}`,
      520,
    );
    printArtifactList(artifacts, {
      title: 'Available in source',
      subtitle: source,
    });
  } finally {
    cleanup();
  }
}

export function cmdListInstalled(
  opts: CliOpts,
  kind?: ArtifactKind,
  selector?: string,
): void {
  ui.intro();
  let installed = listInstalled(toInstallOpts(opts));
  if (kind) {
    installed = installed.filter((it) => it.kind === kind || it.id.startsWith(kind + '/'));
  }
  if (selector && kind) {
    const rel = `${kind}/${selector}`;
    installed = installed.filter(
      (it) => it.id === rel || it.id.startsWith(rel + '/') || it.id.endsWith('/' + selector) || it.id === `${kind}/${selector}`,
    );
  } else if (selector) {
    installed = installed.filter((it) => it.id.includes(selector));
  }
  if (!installed.length) {
    ui.info(kind || selector ? `Nothing installed matching that filter.` : 'Nothing installed.');
    ui.step(c.dim('Try: agentry add skills mhmdreza-rafiei/agent-tools'));
    return;
  }

  const bar = c.dim('│');
  const corner = c.dim('└');
  ui.blank();
  ui.log(`${sky('◆')} ${c.bold('Installed')}`);
  ui.log(bar);
  ui.log(
    `${bar}  ${sky('Scope')}   ${opts.scope === 'global' ? 'global (~)' : `project (${opts.dir || process.cwd()})`}`,
  );
  ui.log(`${bar}  ${sky('Total')}   ${installed.length} artifact${installed.length === 1 ? '' : 's'}`);
  ui.log(bar);

  const byKind = new Map<string, typeof installed>();
  for (const it of installed) {
    const k = it.kind || it.id.split('/')[0]!;
    const arr = byKind.get(k) || [];
    arr.push(it);
    byKind.set(k, arr);
  }
  for (const k of ARTIFACT_KINDS) {
    const items = byKind.get(k);
    if (!items?.length) continue;
    ui.log(`${bar}  ${c.bold(k + 's')}  ${c.dim(`(${items.length})`)}`);
    for (const it of items) {
      const id = it.id.includes('/') ? it.id.slice(it.id.indexOf('/') + 1) : it.id;
      ui.log(`${bar}  ${sky('•')} ${c.bold(id)}`);
      const agents = it.agents?.length ? it.agents.join(', ') : '—';
      ui.log(`${bar}    ${c.dim(`agents: ${agents}`)}`);
      if (it.source) ui.log(`${bar}    ${c.dim(`source: ${it.source}`)}`);
    }
    ui.log(bar);
  }
  ui.log(`${corner}  ${c.dim('agentry remove <kind> [source] [selector]  ·  agentry update <kind> [source]')}`);
  ui.blank();
}

function printArtifactList(
  artifacts: Artifact[],
  meta: { title: string; subtitle?: string },
): void {
  const bar = c.dim('│');
  const corner = c.dim('└');
  ui.blank();
  ui.log(`${sky('◆')} ${c.bold(meta.title)}`);
  ui.log(bar);
  if (meta.subtitle) ui.log(`${bar}  ${sky('From')}    ${meta.subtitle}`);
  ui.log(`${bar}  ${sky('Total')}   ${artifacts.length}`);
  ui.log(bar);
  if (!artifacts.length) {
    ui.log(`${bar}  ${c.dim('(none)')}`);
    ui.log(bar);
    ui.log(`${corner}`);
    ui.blank();
    return;
  }
  const byKind = new Map<string, Artifact[]>();
  for (const a of artifacts) {
    const arr = byKind.get(a.kind) || [];
    arr.push(a);
    byKind.set(a.kind, arr);
  }
  for (const k of ARTIFACT_KINDS) {
    const items = byKind.get(k);
    if (!items?.length) continue;
    ui.log(`${bar}  ${c.bold(k + 's')}  ${c.dim(`(${items.length})`)}`);
    for (const it of items) {
      const desc = (it.description || '').replace(/\s+/g, ' ').trim().slice(0, 56);
      ui.log(`${bar}  ${sky('•')} ${c.bold(it.id)}`);
      if (desc) ui.log(`${bar}    ${c.dim(desc)}`);
    }
    ui.log(bar);
  }
  ui.log(`${corner}  ${c.dim('agentry add <kind> <source> [selector]')}`);
  ui.blank();
}

export async function cmdUpdateAssets(
  kind: ArtifactKind | 'all',
  arg1: string | undefined,
  arg2: string | undefined,
  opts: CliOpts,
): Promise<void> {
  ui.intro();
  const { source, selector } = resolveSourceOrSelector(arg1, arg2, opts);
  const installOpts = toInstallOpts(opts);

  if (source) {
    // Same order as add: parse → discover → pick artifacts → pick agents → install.
    await ui.spinner('Parsing source\u2026', () => parseSource(source), (p) => {
      const where = p.url || p.local || source;
      return `${theme.primary('Source:')} ${where}${p.ref ? c.dim(` @ ${p.ref}`) : ''}`;
    }, 520);
    const { root, cleanup } = await resolveSourceWithUi(source, opts);
    try {
      const artifacts = await ui.spinner(
        'Discovering\u2026',
        () => (kind === 'all' ? listAll(root) : select(root, kind, selector)),
        (a) => `Found ${a.length} to update`,
        620,
      );
      if (!artifacts.length) { ui.warn(`Nothing found in ${source}.`); return; }

      let chosen = artifacts;
      if (!selector && kind !== 'all' && artifacts.length > 1 && !opts.all && !opts.yes && !ui.isQuiet()) {
        await ui.sectionTransition('source discovery', `select ${kind}s to update`);
        const picked = await ui.selectArtifacts(`Select ${kind}s to update`, artifacts);
        if (ui.isCancelLike(picked)) { ui.outro('Cancelled.'); return; }
        chosen = picked as Artifact[];
        await ui.sectionTransition(
          `${chosen.length} ${kind}${chosen.length === 1 ? '' : 's'} selected`,
          'choose target agents',
        );
      } else if (!ui.isQuiet() && !opts.agents.length && !opts.all && !opts.yes) {
        await ui.sectionTransition(
          `${chosen.length} ${kind}${chosen.length === 1 ? '' : 's'} ready`,
          'choose target agents',
        );
      }

      const agentList = await resolveAgentList(opts, 'update');
      if (!ui.isQuiet() && !opts.agents.length && !opts.all && !opts.yes) {
        await ui.sectionTransition(
          `${agentList.length} agent${agentList.length === 1 ? '' : 's'} selected`,
          'update summary',
        );
      }
      installAll(chosen, opts, agentList, source);
    } finally { cleanup(); }
    return;
  }

  // No source: re-install from lockfile sources (optional selector filter).
  let installed = listInstalled(installOpts).filter((it) => kind === 'all' || it.id.startsWith(kind + '/'));
  if (selector) {
    const rel = `${kind}/${selector}`;
    installed = installed.filter((it) => it.id === rel || it.id.startsWith(rel + '/') || it.id.endsWith('/' + selector));
  }
  if (!installed.length) { ui.warn(`No installed ${kind} recorded in lockfile. Provide a source.`); return; }

  if (!ui.isQuiet() && !opts.agents.length && !opts.all && !opts.yes) {
    await ui.sectionTransition('lockfile sources', 'choose agents to update for');
  }
  const agentList = await resolveAgentList(opts, 'update');

  const bySource = new Map<string, string[]>();
  for (const it of installed) {
    if (it.source) {
      const arr = bySource.get(it.source) || [];
      arr.push(it.id);
      bySource.set(it.source, arr);
    }
  }
  if (!bySource.size) { ui.warn(`Installed ${kind} artifacts have no recorded source. Provide a source.`); return; }
  for (const [s, ids] of bySource) {
    ui.info(`Updating from ${s}…`);
    const { root, cleanup } = await resolveSourceWithUi(s, opts);
    try {
      const artifacts = ids
        .map((id) => {
          const [k, ...rest] = id.split('/');
          return select(root, k as ArtifactKind, rest.join('/') || undefined);
        })
        .flat();
      installAll(artifacts, opts, agentList, s);
    } finally { cleanup(); }
  }
}

async function promptText(message: string, initial?: string): Promise<string | null> {
  if (ui.isQuiet()) return initial || null;
  const res = await clack.text({ message, initialValue: initial || '', placeholder: initial });
  if (clack.isCancel(res)) return null;
  return String(res).trim() || null;
}

async function pickFromSource(
  kind: ArtifactKind,
  source: string,
  message: string,
  opts: CliOpts,
): Promise<{ id: string; source: string }[]> {
  const { root, cleanup } = await resolveSourceWithUi(source, opts);
  try {
    const artifacts = listKind(root, kind);
    if (!artifacts.length) {
      ui.warn(`No ${kind}s in ${source}.`);
      return [];
    }
    if (ui.isQuiet() || artifacts.length === 1) {
      return artifacts.map((a) => ({ id: a.id, source }));
    }
    const picked = await ui.selectArtifacts(message, artifacts);
    if (ui.isCancelLike(picked) || !picked) return [];
    return (picked as Artifact[]).map((a) => ({ id: a.id, source }));
  } finally {
    cleanup();
  }
}

export async function cmdInit(
  kind: ArtifactKind,
  nameArg: string | undefined,
  categoryArg: string | undefined,
  opts: CliOpts,
): Promise<void> {
  ui.intro();
  const baseDir = opts.dir || process.cwd();

  let name = nameArg;
  let category = categoryArg || null;
  if (!name && !ui.isQuiet()) {
    name = (await promptText(`Name for the new ${kind}`)) || undefined;
  }
  if (!name) throw new Error(`Missing name. e.g. agentry init ${kind} my-${kind}`);

  let description = opts.description;
  if (!description && !opts.yes && !ui.isQuiet()) {
    description = (await promptText('Description (optional)', `${name} ${kind}`)) || `${name} ${kind}`;
  }
  description = description || `${name} ${kind}`;

  if (kind === 'skill') {
    const reference = opts.reference !== false;
    if (opts.dryRun) {
      ui.info(`Would create skills/${category ? category + '/' : ''}${name}/SKILL.md${reference ? ' + references/TEMPLATE.md' : ''}`);
      return;
    }
    const r = scaffoldSkill({ name, category, description, reference, baseDir });
    for (const p of r.paths) ui.step(p);
    ui.ok(`Initialized skill ${r.id}`);
    return;
  }

  if (kind === 'agent' || kind === 'rule') {
    if (opts.dryRun) {
      ui.info(`Would create ${kind}s/${category ? category + '/' : ''}${name}.mdc`);
      return;
    }
    const r = scaffoldMdc({
      kind,
      name,
      category,
      description,
      alwaysApply: opts.alwaysApply,
      baseDir,
    });
    for (const p of r.paths) ui.step(p);
    ui.ok(`Initialized ${kind} ${r.id}`);
    return;
  }

  if (kind === 'script') {
    if (opts.dryRun) {
      ui.info(`Would create scripts/${category ? category + '/' : ''}${name}/`);
      return;
    }
    const r = scaffoldScript({ name, category, description, baseDir });
    for (const p of r.paths) ui.step(p);
    ui.ok(`Initialized script ${r.id}`);
    return;
  }

  if (kind === 'profile') {
    await initProfile(name, description, opts, baseDir);
    return;
  }

  throw new Error(`Cannot init kind: ${kind}`);
}

async function initProfile(name: string, description: string, opts: CliOpts, baseDir: string): Promise<void> {
  const initKinds = opts.initKinds || {};
  const wantAll = opts.all;
  let wantSkills = wantAll || initKinds.skills !== undefined;
  let wantAgents = wantAll || initKinds.agents !== undefined;
  let wantRules = wantAll || initKinds.rules !== undefined;
  let wantScripts = wantAll || initKinds.scripts !== undefined;

  // Interactive: ask which sections if none specified.
  if (!wantSkills && !wantAgents && !wantRules && !wantScripts && !opts.yes && !ui.isQuiet()) {
    const res = await clack.multiselect({
      message: 'What should this profile include?',
      options: [
        { value: 'skills', label: 'Skills' },
        { value: 'agents', label: 'Agents' },
        { value: 'rules', label: 'Rules' },
        { value: 'scripts', label: 'Scripts' },
      ],
      required: false,
    });
    if (clack.isCancel(res)) { ui.outro('Cancelled.'); return; }
    const set = new Set(res as string[]);
    wantSkills = set.has('skills');
    wantAgents = set.has('agents');
    wantRules = set.has('rules');
    wantScripts = set.has('scripts');
  }

  const agentList = opts.agents.length
    ? (await resolveAgentList(opts, 'install')).map((a) => a.name)
    : ['cursor'];

  const skills: { id: string; source?: string }[] = [];
  const rules: { id: string; source?: string }[] = [];
  const agentsArtifacts: { id: string; source?: string }[] = [];
  const scripts: { id: string; source?: string }[] = [];

  async function fill(
    flag: string | true | undefined,
    enabled: boolean,
    k: ArtifactKind,
    into: { id: string; source?: string }[],
  ): Promise<void> {
    if (!enabled) return;
    const src = typeof flag === 'string' ? flag : undefined;
    if (src) {
      const picked = await pickFromSource(k, src, `Select ${k}s for profile`, opts);
      into.push(...picked);
      return;
    }
    if (ui.isQuiet() || opts.yes) return;
    const ask = await promptText(`Source for ${k}s (author/repo, URL, or local path — empty to skip)`);
    if (!ask) return;
    const picked = await pickFromSource(k, ask, `Select ${k}s for profile`, opts);
    into.push(...picked);
  }

  await fill(initKinds.skills, wantSkills, 'skill', skills);
  await fill(initKinds.agents, wantAgents, 'agent', agentsArtifacts);
  await fill(initKinds.rules, wantRules, 'rule', rules);
  await fill(initKinds.scripts, wantScripts, 'script', scripts);

  if (opts.dryRun) {
    ui.info(`Would write profiles/${name}.yaml with ${skills.length} skills, ${agentsArtifacts.length} agents, ${rules.length} rules, ${scripts.length} scripts`);
    return;
  }

  const r = scaffoldProfile({
    name,
    description,
    agents: agentList,
    skills,
    rules,
    agentsArtifacts,
    scripts,
    baseDir,
  });
  for (const p of r.paths) ui.step(p);
  ui.ok(`Initialized profile ${r.id}`);
}
