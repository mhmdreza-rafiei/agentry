import c from 'picocolors';

/** Truecolor sky blue (#38bdf8) — softer than ANSI blue. */
function fgSky(s: string): string {
  return `\x1b[38;2;56;189;248m${s}\x1b[0m`;
}
function bgSky(s: string): string {
  return `\x1b[48;2;14;165;233m${s}\x1b[0m`;
}

export const sky = Object.assign(
  (s: string) => fgSky(s),
  {
    bold: (s: string) => c.bold(fgSky(s)),
    bg: (s: string) => bgSky(s),
  },
);

// ── Color palette (primary = sky blue for selection / interactive) ──
export const PALETTE = {
  primary: sky,
  success: c.green,
  error: c.red,
  warn: c.yellow,
  info: sky,
  dim: c.dim,
  bold: c.bold,
  text: c.white,
};
export const theme = PALETTE;

export const symbol = {
  ok: sky(process.stdout.isTTY ? '\u2713' : 'v'),
  fail: c.red(process.stdout.isTTY ? '\u2717' : 'x'),
  warn: c.yellow(process.stdout.isTTY ? '\u26a0' : '!'),
  info: sky(process.stdout.isTTY ? '\u2139' : 'i'),
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

// Intro badge — capitalized Agentry, sky primary.
export function badge(): string {
  return bgSky(c.white(c.bold(' Agentry ')));
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
  return c.bold(sky(title));
}
function cmd(s: string): string {
  return c.cyan(s);
}
function flag(s: string): string {
  return sky(s);
}
function dim(s: string): string {
  return c.dim(s);
}
function bullet(s: string): string {
  return `  ${sky('•')} ${s}`;
}

/** Styled help — sections, colored commands/flags, readable hierarchy. */
export function printHelp(): void {
  const lines: string[] = [
    '',
    `${badge()}  ${dim('install agents, skills, rules, scripts & profiles')}`,
    '',
    h('Usage'),
    `  ${cmd('agentry')} ${flag('add')}          ${dim('[kind] <source> [selector] [options]')}`,
    `  ${cmd('agentry')} ${flag('add from')}     ${dim('<url> [selector] [options]')}`,
    `  ${cmd('agentry')} ${flag('add')}          ${dim('profile <name> [source] [options]')}`,
    `  ${cmd('agentry')} ${flag('remove')}       ${dim('[kind] [source] [selector] [options]')}`,
    `  ${cmd('agentry')} ${flag('list')}         ${dim('[source] [kind] [selector]')}`,
    `  ${cmd('agentry')} ${flag('update')}       ${dim('[kind] [source] [selector]')}`,
    `  ${cmd('agentry')} ${flag('init')}         ${dim('<kind> [name] [category] [options]')}`,
    `  ${cmd('agentry')} ${flag('uninstall')}`,
    '',
    h('Kinds'),
    bullet(`${c.bold('skill')}  ${c.bold('rule')}  ${c.bold('agent')}  ${c.bold('profile')}  ${c.bold('script')}  ${dim('(or all)')}`),
    dim('  Plurals accepted: skills → skill, agents → agent, … (optional on add/remove)'),
    '',
    h('Sources'),
    bullet(`${cmd('author/repo')}              ${dim('GitHub shorthand')}`),
    bullet(`${cmd('https://github.com/…')}     ${dim('GitHub URL or /tree/<ref>/<dir>')}`),
    bullet(`${cmd('https://awesomeskill.ai/…')} ${dim('Skill directory/hub website')}`),
    bullet(`${cmd('https://gitlab.com/…')}     ${dim('GitLab URL')}`),
    bullet(`${cmd('git@host:owner/repo.git')}  ${dim('any git URL')}`),
    bullet(`${cmd('./path')} ${dim('|')} ${cmd('/path')} ${dim('|')} ${cmd('~/path')}  ${dim('local directory')}`),
    '',
    h('Examples'),
    bullet(`${cmd('agentry add')} mhmdreza-rafiei/agent-tools`),
    bullet(`${cmd('agentry add from')} https://awesomeskill.ai/skill/vercel-labs-agent-skills-web-design-guidelines`),
    bullet(`${cmd('agentry add skills')} mhmdreza-rafiei/agent-tools enhance-prompt ${flag('-a')} cursor`),
    bullet(`${cmd('agentry list')}`),
    bullet(`${cmd('agentry list skills')}`),
    bullet(`${cmd('agentry list')} mhmdreza-rafiei/agent-tools`),
    bullet(`${cmd('agentry remove')} enhance-prompt`),
    bullet(`${cmd('agentry remove skills')} mhmdreza-rafiei/agent-tools`),
    bullet(`${cmd('agentry update skills')} mhmdreza-rafiei/agent-tools`),
    bullet(`${cmd('agentry init skill')} enhance-prompt prompt ${flag('--reference')}`),
    bullet(`${cmd('agentry init profile')} frontend ${flag('--skills')} mhmdreza-rafiei/agent-tools`),
    bullet(`${cmd('agentry init rule')} ask-dont-guess ${flag('--alwaysApply')}`),
    bullet(`${cmd('agentry update')}`),
    '',
    h('Options'),
    `  ${flag('-g, --global')}     ${dim('Install into ~ (all projects)')}`,
    `  ${flag('-p, --project')}    ${dim('Install into the current folder')}`,
    `  ${flag('-d, --dir')} ${dim('<p>')}   ${dim('Install into a specific folder')}`,
    `  ${flag('-a, --agent')} ${dim('<n>')}  ${dim("Target provider(s); repeatable; '*' = all")}`,
    `  ${flag('-l, --list')}       ${dim('Preview only — write nothing')}`,
    `      ${flag('--copy')}       ${dim('Copy files instead of symlinking')}`,
    `      ${flag('--all')}        ${dim('Install everything to all agents, no prompts')}`,
    `  ${flag('-y, --yes')}        ${dim("Don't prompt (scope defaults to project)")}`,
    `      ${flag('--description')} ${dim('<t>')}  ${dim('init: frontmatter description')}`,
    `      ${flag('--alwaysApply')}    ${dim('init rule: alwaysApply: true')}`,
    `      ${flag('--reference')}      ${dim('init skill: include references/TEMPLATE.md')}`,
    `      ${flag('--no-reference')}   ${dim('init skill: omit references/ folder')}`,
    `      ${flag('--skills')} ${dim('[src]')} ${dim('init profile: include skills (optional source)')}`,
    `      ${flag('--agents')} ${dim('[src]')} ${dim('init profile: include agents')}`,
    `      ${flag('--rules')} ${dim('[src]')}  ${dim('init profile: include rules')}`,
    `      ${flag('--scripts')} ${dim('[src]')} ${dim('init profile: include scripts')}`,
    '',
  ];
  process.stdout.write(lines.join('\n') + '\n');
}
