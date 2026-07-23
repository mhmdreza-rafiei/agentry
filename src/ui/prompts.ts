import * as clack from '@clack/prompts';
import * as readline from 'node:readline';
import c from 'picocolors';
import { badge, delay, sky } from './theme.js';
import { isCI } from './detect.js';
import { searchMultiselect, cancelSymbol, type SearchItem, type DetailField } from './search_multiselect.js';
import type { Artifact, AgentConfig } from '../core/types.js';

export type AgentAction = 'install' | 'remove' | 'update';

export function agentsPrompt(action: AgentAction): string {
  if (action === 'remove') return 'Which agents do you want to remove from?';
  if (action === 'update') return 'Which agents do you want to update for?';
  return 'Which agents do you want to install to?';
}

export function actionGerund(action: AgentAction): string {
  if (action === 'remove') return 'removing';
  if (action === 'update') return 'updating';
  return 'installing';
}

export function actionNoun(action: AgentAction): string {
  if (action === 'remove') return 'remove';
  if (action === 'update') return 'update';
  return 'install';
}

export function scopePrompt(action: AgentAction): string {
  if (action === 'remove') return 'Removal scope';
  if (action === 'update') return 'Update scope';
  return 'Installation scope';
}

/**
 * Ask Project vs Global with path hints under each option (skills-style, after agents).
 * Returns null on cancel.
 */
export async function selectInstallScope(
  message: string,
  paths: { projectDir: string; homeDir: string },
): Promise<'project' | 'global' | null> {
  if (isQuiet()) return 'project';

  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve('project');
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin, rl);

    type Choice = 'project' | 'global';
    let value: Choice = 'project';
    let lastH = 0;

    const joinRel = (base: string, rel: string) => {
      const sep = base.includes('\\') ? '\\' : '/';
      const b = base.replace(/[\\/]+$/, '');
      return `${b}${sep}${rel.replace(/\//g, sep)}`;
    };

    const optionBlock = (key: Choice, selected: boolean, done?: Choice | 'cancel') => {
      const active = done ? done === key : selected;
      const bullet = active ? sky(c.bold('●')) : c.dim('○');
      const title = key === 'project' ? 'Project' : 'Global';
      const hint =
        key === 'project'
          ? 'Install in the current directory (committed with your project)'
          : 'Install in your home directory (available across all projects)';
      const path = key === 'project' ? paths.projectDir : paths.homeDir;
      const lock =
        key === 'project'
          ? joinRel(paths.projectDir, '.agentry/lock.json')
          : joinRel(paths.homeDir, '.agentry/lock.json');
      const lines: string[] = [];
      if (done === 'cancel') {
        lines.push(`${c.dim('│')}  ${c.strikethrough(c.dim(title))}`);
      } else {
        lines.push(`${c.dim('│')}  ${bullet} ${active ? c.bold(title) : title}`);
        lines.push(`${c.dim('│')}    ${c.dim(hint)}`);
        lines.push(`${c.dim('│')}    ${sky('→')} ${c.dim(path)}`);
        lines.push(`${c.dim('│')}    ${c.dim(`lock ${lock}`)}`);
      }
      return lines;
    };

    const paint = (done?: Choice | 'cancel') => {
      const lines: string[] = [];
      if (done === 'cancel') {
        lines.push(`${sky('■')} ${c.bold(message)}`);
        lines.push(`${c.dim('│')} ${c.strikethrough(c.dim('Cancelled'))}`);
      } else if (done === 'project' || done === 'global') {
        lines.push(`${sky('◇')} ${c.bold(message)}`);
        lines.push(...optionBlock(done, true, done).slice(0, 2));
        lines.push(`${c.dim('│')}    ${sky('→')} ${c.dim(done === 'project' ? paths.projectDir : paths.homeDir)}`);
      } else {
        lines.push(`${sky('◆')} ${c.bold(message)}`);
        lines.push(`${c.dim('│')}`);
        lines.push(...optionBlock('project', value === 'project'));
        lines.push(`${c.dim('│')}`);
        lines.push(...optionBlock('global', value === 'global'));
        lines.push(`${c.dim('└')} ${c.dim('↑/↓ select · enter confirm')}`);
      }
      if (lastH > 0) {
        for (let i = 0; i < lastH; i++) process.stdout.write('\x1b[1A\x1b[2K');
      }
      process.stdout.write(lines.join('\n') + '\n');
      lastH = lines.length;
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKey);
      process.stdin.setRawMode(false);
      rl.close();
    };

    const onKey = (_s: string, key: readline.Key) => {
      if (!key) return;
      if (key.name === 'up' || key.name === 'down' || key.name === 'tab') {
        value = value === 'project' ? 'global' : 'project';
        paint();
        return;
      }
      if (key.name === 'return') {
        paint(value);
        cleanup();
        blank();
        resolve(value);
        return;
      }
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        paint('cancel');
        cleanup();
        resolve(null);
      }
    };

    process.stdin.on('keypress', onKey);
    blank();
    paint();
  });
}

export function isQuiet(): boolean {
  return isCI() || !process.stdout.isTTY;
}

export function isCancelLike(res: unknown): boolean {
  return res == null || res === cancelSymbol || clack.isCancel(res as any);
}

export function intro(): void {
  if (isQuiet()) return;
  clack.intro(badge());
}

export function outro(message: string): void {
  if (isQuiet()) {
    process.stdout.write(message + '\n');
    return;
  }
  clack.outro(message);
}

export async function confirm(message: string): Promise<boolean> {
  if (isQuiet()) return true;
  // Sky-themed confirm (Clack defaults to green).
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(true);
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin, rl);

    let value = true;
    let lastH = 0;

    const paint = (done?: 'yes' | 'no' | 'cancel') => {
      const lines: string[] = [];
      if (done === 'cancel') {
        lines.push(`${sky('■')} ${c.bold(message)}`);
        lines.push(`${c.dim('│')} ${c.strikethrough(c.dim('Cancelled'))}`);
      } else if (done === 'yes' || done === 'no') {
        lines.push(`${sky('◇')} ${c.bold(message)}`);
        lines.push(`${c.dim('│')} ${c.dim(done === 'yes' ? 'Yes' : 'No')}`);
      } else {
        lines.push(`${sky('◆')} ${c.bold(message)}`);
        lines.push(`${c.dim('│')}`);
        const yes = value ? sky(c.bold('● Yes')) : c.dim('○ Yes');
        const no = !value ? sky(c.bold('● No')) : c.dim('○ No');
        lines.push(`${c.dim('│')}  ${yes}  /  ${no}`);
        lines.push(`${c.dim('└')} ${c.dim('←/→ toggle · enter confirm')}`);
      }
      if (lastH > 0) {
        for (let i = 0; i < lastH; i++) process.stdout.write('\x1b[1A\x1b[2K');
      }
      process.stdout.write(lines.join('\n') + '\n');
      lastH = lines.length;
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKey);
      process.stdin.setRawMode(false);
      rl.close();
    };

    const onKey = (_s: string, key: readline.Key) => {
      if (!key) return;
      if (key.name === 'left' || key.name === 'right' || key.name === 'tab') {
        value = !value;
        paint();
        return;
      }
      if (key.name === 'y') { value = true; paint(); return; }
      if (key.name === 'n') { value = false; paint(); return; }
      if (key.name === 'return') {
        paint(value ? 'yes' : 'no');
        cleanup();
        resolve(value);
        return;
      }
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        paint('cancel');
        cleanup();
        resolve(false);
      }
    };

    process.stdin.on('keypress', onKey);
    paint();
  });
}

export function log(message: string): void {
  process.stdout.write(message + '\n');
}
export function blank(): void {
  process.stdout.write('\n');
}

/**
 * Slow, readable handoff between UI sections so the user sees
 * "that finished → this is next" instead of an abrupt swap.
 */
export async function sectionTransition(doneLabel: string, nextLabel: string): Promise<void> {
  if (isQuiet()) return;
  blank();
  log(`${sky('◇')} ${c.dim('Done:')} ${c.bold(doneLabel)}`);
  await delay(320);

  // Draw a short animated rail so attention moves downward.
  const rail = ['│', '│', '↓'];
  for (const ch of rail) {
    process.stdout.write(`${c.dim(`  ${ch}`)}\n`);
    await delay(140);
  }
  await delay(200);

  log(`${sky('◆')} ${c.bold('Next:')} ${nextLabel}`);
  await delay(420);
  blank();
}
export function step(message: string): void {
  process.stdout.write(`  ${sky('→')} ${message}\n`);
}
export function ok(message: string): void {
  process.stdout.write(`${sky('✓')} ${message}\n`);
}
export function err(message: string): void {
  process.stdout.write(`${c.red('✗')} ${message}\n`);
}
export function warn(message: string): void {
  process.stdout.write(`${c.yellow('⚠')} ${message}\n`);
}
export function info(message: string): void {
  process.stdout.write(`${sky('ℹ')} ${message}\n`);
}

/** Blue spinner (no clack green). */
export async function spinner<T>(
  startMsg: string,
  fn: () => T | Promise<T>,
  stopWith?: (r: T) => string,
  minMs = 480,
): Promise<T> {
  if (isQuiet()) {
    process.stdout.write(c.dim(`• ${startMsg}...`) + '\n');
    const r = await fn();
    if (stopWith) process.stdout.write(`${sky('◇')} ${stopWith(r)}\n`);
    return r;
  }

  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let alive = true;
  process.stdout.write(`${sky(frames[0]!)} ${startMsg}`);
  const tick = setInterval(() => {
    if (!alive) return;
    i = (i + 1) % frames.length;
    process.stdout.write(`\r${sky(frames[i]!)} ${startMsg}   `);
  }, 80);

  const started = Date.now();
  try {
    const result = await fn();
    const wait = Math.max(0, minMs - (Date.now() - started));
    if (wait) await delay(wait);
    alive = false;
    clearInterval(tick);
    const msg = stopWith ? stopWith(result) : startMsg;
    process.stdout.write(`\r\x1b[K${sky('◇')} ${msg}\n`);
    return result;
  } catch (e) {
    alive = false;
    clearInterval(tick);
    process.stdout.write(`\r\x1b[K${c.red('■')} ${startMsg}\n`);
    throw e;
  }
}

function artifactFields(a: Artifact): DetailField[] {
  return [
    { label: 'Name', value: a.name },
    { label: 'Kind', value: a.kind },
    { label: 'Id', value: a.id },
    {
      label: 'About',
      value: a.description ? a.description.replace(/\s+/g, ' ').trim() : 'No description provided.',
    },
    { label: 'Path', value: a.dir },
  ];
}

function agentFields(a: AgentConfig, installed: boolean): DetailField[] {
  return [
    { label: 'Name', value: a.displayName },
    { label: 'Id', value: a.name },
    { label: 'Project', value: a.skillsDir },
    { label: 'Global', value: a.globalSkillsDir || '—' },
    {
      label: 'About',
      value: [
        a.skillsDir === '.agents/skills' ? 'Universal provider (.agents/skills).' : 'Provider-specific install path.',
        installed ? 'Detected on this machine.' : 'Not detected on this machine.',
        a.globalSkillsDir ? `Global skills: ${a.globalSkillsDir}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    },
  ];
}

/**
 * Always show the full skill/artifact list with an All row.
 * Selecting All disables every other row.
 */
export async function selectArtifacts(
  message: string,
  artifacts: Artifact[],
): Promise<Artifact[] | null> {
  if (isQuiet() || artifacts.length <= 1) return artifacts;

  blank();
  const items: SearchItem<string>[] = artifacts.map((a) => ({
    value: a.id,
    label: a.id,
    hint: a.description ? a.description.replace(/\s+/g, ' ').slice(0, 42) : a.kind,
    fields: artifactFields(a),
  }));

  const res = await searchMultiselect({
    message,
    items,
    maxVisible: 8,
    required: true,
    searchable: true,
    showDetail: true,
    detailLines: 8,
    showSelectedSummary: true,
    includeAllOption: true,
    allLabel: `All (${artifacts.length})`,
    allHint: 'every skill below · disables others',
  });
  if (res === cancelSymbol) return null;
  blank();
  const ids = new Set(res as string[]);
  return artifacts.filter((a) => ids.has(a.id));
}

/**
 * Show agent list with All + locked Universal. No opaque All/Detected/Choose radio.
 */
export async function selectAgents(
  message: string,
  universal: AgentConfig[],
  others: AgentConfig[],
  detectedNames: string[] = [],
): Promise<AgentConfig[] | null> {
  const seen = new Set<string>();
  const uniqueOthers = others.filter((o) => {
    if (seen.has(o.name)) return false;
    seen.add(o.name);
    return true;
  });

  const detected = uniqueOthers.filter((o) => detectedNames.includes(o.name));
  if (isQuiet()) return [...universal, ...detected];
  if (!uniqueOthers.length) return universal;

  blank();
  const installedSet = new Set(detectedNames);
  const items: SearchItem<string>[] = uniqueOthers.map((a) => ({
    value: a.name,
    label: a.displayName,
    hint: installedSet.has(a.name) ? `${a.skillsDir} · detected` : a.skillsDir,
    fields: agentFields(a, installedSet.has(a.name)),
  }));

  const locked =
    universal.length > 0
      ? {
          title: 'Universal',
          // All values for selection; UI renders as one compact line.
          items: universal.map((a) => ({
            value: a.name,
            label: a.displayName,
            fields: agentFields(a, true),
          })),
          compact: true,
        }
      : undefined;

  // Keep the frame short so Windows terminals never scroll (scroll + redraw = stacked prompts).
  const res = await searchMultiselect({
    message,
    items,
    maxVisible: 5,
    required: false,
    initialSelected: detected.map((d) => d.name),
    lockedSection: locked,
    searchable: true,
    showDetail: true,
    detailLines: 4,
    showSelectedSummary: true,
    includeAllOption: true,
    allLabel: `All additional (${uniqueOthers.length})`,
    allHint: 'every provider below · disables others',
  });
  if (res === cancelSymbol) return null;
  blank();

  const picked = new Set(res as string[]);
  const byName = new Map([...universal, ...uniqueOthers].map((a) => [a.name, a]));
  const out: AgentConfig[] = [];
  for (const name of picked) {
    const a = byName.get(name);
    if (a) out.push(a);
  }
  for (const u of universal) {
    if (!out.some((a) => a.name === u.name)) out.unshift(u);
  }
  return out;
}

/** Clean install summary panel (title · targets · artifact list). */
export function installSummary(
  artifacts: Artifact[],
  agents: AgentConfig[],
  scopeLabel: string,
): void {
  blank();
  const bar = c.dim('│');
  const corner = c.dim('└');
  log(`${sky('◆')} ${c.bold('Install summary')}`);
  log(bar);
  log(`${bar}  ${sky('Scope')}      ${scopeLabel}`);
  const universalCount = agents.filter((a) => a.skillsDir === '.agents/skills').length;
  const otherCount = agents.length - universalCount;
  log(
    `${bar}  ${sky('Targets')}    ${agents.length} agent${agents.length === 1 ? '' : 's'}` +
      c.dim(` · ${universalCount} universal` + (otherCount ? ` · ${otherCount} additional` : '')),
  );
  // Short name list — wrap-friendly, not one giant line.
  const names = agents.map((a) => a.displayName);
  const chunks: string[] = [];
  let line = '';
  for (const n of names) {
    const next = line ? `${line}, ${n}` : n;
    if (next.length > 56) {
      if (line) chunks.push(line);
      line = n;
    } else line = next;
  }
  if (line) chunks.push(line);
  for (const ch of chunks.slice(0, 3)) log(`${bar}             ${c.dim(ch)}`);
  if (chunks.length > 3) log(`${bar}             ${c.dim(`… +${chunks.length - 3} more lines`)}`);

  log(bar);
  log(`${bar}  ${c.bold('Artifacts')}  ${artifacts.length} selected`);
  log(bar);
  for (const a of artifacts) {
    const desc = (a.description || '').replace(/\s+/g, ' ').trim().slice(0, 52);
    log(`${bar}  ${sky('•')} ${c.bold(`${a.kind}/${a.id}`)}`);
    if (desc) log(`${bar}    ${c.dim(desc)}`);
  }
  log(bar);
  log(`${corner}  ${c.dim('Review before use — artifacts run with full agent permissions.')}`);
  blank();
}

export function preview(artifacts: Artifact[], agents: AgentConfig[]): void {
  installSummary(
    artifacts,
    agents,
    'preview (dry-run)',
  );
}
