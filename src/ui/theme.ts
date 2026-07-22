import c from 'picocolors';

// ── Color palette (primary = blue for selection / interactive) ──
export const PALETTE = {
  primary: c.blue,
  success: c.green,
  error: c.red,
  warn: c.yellow,
  info: c.blue,
  dim: c.dim,
  bold: c.bold,
  text: c.white,
};
export const theme = PALETTE;

export const symbol = {
  ok: c.blue(process.stdout.isTTY ? '\u2713' : 'v'),
  fail: c.red(process.stdout.isTTY ? '\u2717' : 'x'),
  warn: c.yellow(process.stdout.isTTY ? '\u26a0' : '!'),
  info: c.blue(process.stdout.isTTY ? '\u2139' : 'i'),
  arrow: process.stdout.isTTY ? '\u2192' : '->',
  bullet: process.stdout.isTTY ? '\u2022' : '*',
  diamond: process.stdout.isTTY ? '\u25c6' : '*',
};

const RESET = '\x1b[0m';
// 256-color gray gradient (white -> gray), visible on light + dark backgrounds.
const GRAYS = [
  '\x1b[38;5;255m',
  '\x1b[38;5;252m',
  '\x1b[38;5;249m',
  '\x1b[38;5;246m',
  '\x1b[38;5;243m',
  '\x1b[38;5;240m',
];

function gradLine(line: string): string {
  const n = line.length || 1;
  let out = '';
  for (let i = 0; i < line.length; i++) {
    const g = GRAYS[Math.min(GRAYS.length - 1, Math.floor((i / n) * GRAYS.length))];
    out += `${g}${line[i]}${RESET}`;
  }
  return out;
}

// Large block ASCII "AGENTRY" (capitalized) — real wordmark, not tiny text.
const LOGO_LINES = [
  ' █████╗  ██████╗ ███████╗███╗   ██╗████████╗██████╗ ██╗   ██╗',
  '██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██╔══██╗╚██╗ ██╔╝',
  '███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ██████╔╝ ╚████╔╝ ',
  '██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██╔══██╗  ╚██╔╝  ',
  '██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██║  ██║   ██║   ',
  '╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ',
];

export function logo(): string {
  return LOGO_LINES.map((line) => gradLine(line)).join('\n');
}

export function tagline(): string {
  return c.dim('  Install agents, skills, rules & profiles');
}

// Intro badge — capitalized Agentry, blue (primary).
export function badge(): string {
  return c.bgBlue(c.white(c.bold(' Agentry ')));
}

/** Brief pause so steps feel animated (skipped when not a TTY / quiet). */
export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Print the large logo (static; no caret animation that fights the TUI). */
export async function animateLogo(): Promise<void> {
  process.stdout.write('\n' + logo() + '\n');
  process.stdout.write(tagline() + '\n\n');
  if (process.stdout.isTTY) await delay(280);
}

function h(title: string): string {
  return c.bold(c.blue(title));
}
function cmd(s: string): string {
  return c.cyan(s);
}
function flag(s: string): string {
  return c.blue(s);
}
function dim(s: string): string {
  return c.dim(s);
}
function bullet(s: string): string {
  return `  ${c.blue('•')} ${s}`;
}

/** Styled help — sections, colored commands/flags, readable hierarchy. */
export function printHelp(): void {
  const lines: string[] = [
    '',
    `${badge()}  ${dim('install agents, skills, rules, scripts & profiles')}`,
    '',
    h('Usage'),
    `  ${cmd('agentry')} ${flag('add')}     ${dim('<kind> <source> [selector] [options]')}`,
    `  ${cmd('agentry')} ${flag('add')}     ${dim('profile <name> [source] [options]')}`,
    `  ${cmd('agentry')} ${flag('remove')}  ${dim('<kind> [selector] [options]')}`,
    `  ${cmd('agentry')} ${flag('list')}    ${dim('[source] [kind]')}`,
    `  ${cmd('agentry')} ${flag('update')}  ${dim('[kind] [source] [selector]')}`,
    `  ${cmd('agentry')} ${flag('uninstall')}`,
    '',
    h('Kinds'),
    bullet(`${c.bold('skill')}  ${c.bold('rule')}  ${c.bold('agent')}  ${c.bold('profile')}  ${c.bold('script')}  ${dim('(or all)')}`),
    dim('  Plurals accepted: skills → skill, agents → agent, …'),
    '',
    h('Sources'),
    bullet(`${cmd('author/repo')}              ${dim('GitHub shorthand')}`),
    bullet(`${cmd('https://github.com/…')}     ${dim('GitHub URL or /tree/<ref>/<dir>')}`),
    bullet(`${cmd('https://gitlab.com/…')}     ${dim('GitLab URL')}`),
    bullet(`${cmd('git@host:owner/repo.git')}  ${dim('any git URL')}`),
    bullet(`${cmd('./path')} ${dim('|')} ${cmd('/path')} ${dim('|')} ${cmd('~/path')}  ${dim('local directory')}`),
    '',
    h('Examples'),
    bullet(`${cmd('agentry add skills')} Prat011/awesome-llm-skills`),
    bullet(`${cmd('agentry add skills')} ./my-skills ${flag('--list')}`),
    bullet(`${cmd('agentry add skills')} ./my-skills enhance-prompt ${flag('-a')} cursor ${flag('-a')} claude-code`),
    bullet(`${cmd('agentry add agents')} author/repo frontend-developer`),
    bullet(`${cmd('agentry add profile')} frontend author/repo`),
    bullet(`${cmd('agentry remove skills')} enhance-prompt`),
    bullet(`${cmd('agentry update')}`),
    bullet(`${cmd('agentry update skills')} author/repo enhance-prompt`),
    '',
    h('Options'),
    `  ${flag('-g, --global')}     ${dim('Install into ~ (all projects)')}`,
    `      ${flag('--project')}    ${dim('Install into the current folder (default)')}`,
    `      ${flag('--dir')} ${dim('<p>')}    ${dim('Install into a specific folder')}`,
    `  ${flag('-a, --agent')} ${dim('<n>')}  ${dim("Target provider(s); repeatable; '*' = all")}`,
    `  ${flag('-l, --list')}       ${dim('Preview only — write nothing')}`,
    `      ${flag('--copy')}       ${dim('Copy files instead of symlinking')}`,
    `      ${flag('--all')}        ${dim('Install everything to all agents, no prompts')}`,
    `  ${flag('-y, --yes')}        ${dim("Don't prompt")}`,
    `  ${flag('-v, --version')}    ${dim('Print version')}`,
    `  ${flag('-h, --help')}       ${dim('Show this help')}`,
    '',
    dim('Tip: omit --agent to pick providers interactively (universal locked + searchable list).'),
    '',
  ];
  process.stdout.write(lines.join('\n'));
}
