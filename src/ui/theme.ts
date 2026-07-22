import c from 'picocolors';

// skills-aligned palette: mid-gray 256-color gradient (~250 -> 238), dim secondary, one accent.
export const theme = {
  primary: c.gray,
  dim: c.dim,
  bold: c.bold,
  accent: c.cyan,
  success: c.green,
  error: c.red,
  warn: c.yellow,
  info: c.cyan,
  muted: c.dim,
};

export const symbol = {
  ok: c.green(process.stdout.isTTY ? '\u2713' : 'v'),
  fail: c.red(process.stdout.isTTY ? '\u2717' : 'x'),
  warn: c.yellow(process.stdout.isTTY ? '\u26a0' : '!'),
  info: c.cyan(process.stdout.isTTY ? '\u2139' : 'i'),
  arrow: process.stdout.isTTY ? '\u2192' : '->',
  bullet: process.stdout.isTTY ? '\u2022' : '*',
};

// ASCII wordmark rendered with a gray 256-color gradient (skills palette).
const LOGO = [
  '',
  '    ___                    _',
  '   / _ \\___  __ _ _ __ _ __| |_   _ _ __ ___',
  '  / /_)/ _ \\/ _` | \'__| \'__| | | | \'_ ` _ \\',
  ' /___/\\___/\\__,_|_|  |_|  |_|\\_,_| .__/\\__/',
  '                                |_|        ',
  '',
];

export function logo(): string {
  // 256-color gray gradient across the lines.
  const grad = [250, 246, 242, 238];
  return LOGO.map((line, i) => `\x1b[38;5;${grad[i % grad.length]}m${line}\x1b[0m`).join('\n');
}

export function tagline(): string {
  return theme.dim('  Install agents, skills, rules & profiles');
}
