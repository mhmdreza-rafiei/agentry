/**
 * Searchable multiselect with fixed viewport + info box.
 * Adapted from vercel-labs/skills, themed for Agentry (sky primary).
 */
import * as readline from 'node:readline';
import { stripVTControlCharacters } from 'node:util';
import { Writable } from 'node:stream';
import pc from 'picocolors';
import { sky } from './theme.js';

const silentOutput = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

export interface DetailField {
  label: string;
  value: string;
}

export interface SearchItem<T = string> {
  value: T;
  label: string;
  hint?: string;
  /** Plain detail fallback. */
  detail?: string;
  /** Structured fields for the Info box (preferred). */
  fields?: DetailField[];
}

export interface LockedSection<T = string> {
  title: string;
  items: SearchItem<T>[];
  hiddenCount?: number;
  /** When set, render one summary line instead of listing names (avoids tall frames / Windows redraw bugs). */
  compact?: boolean;
}

export interface SearchMultiselectOptions<T = string> {
  message: string;
  items: SearchItem<T>[];
  maxVisible?: number;
  initialSelected?: T[];
  required?: boolean;
  lockedSection?: LockedSection<T>;
  searchable?: boolean;
  showDetail?: boolean;
  /** Fixed Info box body rows (always this many). Default 5. */
  detailLines?: number;
  showSelectedSummary?: boolean;
  /** Prepend an "All" row; selecting it disables every other row. */
  includeAllOption?: boolean;
  allLabel?: string;
  allHint?: string;
}

export const cancelSymbol = Symbol('cancel');
export const ALL_VALUE = '__all__';

const BLUE = sky;
const BLUE_BOLD = (s: string) => pc.bold(sky(s));
const S_STEP_ACTIVE = sky('◆');
const S_STEP_CANCEL = pc.red('■');
const S_STEP_SUBMIT = sky('◇');
const S_RADIO_ACTIVE = sky('●');
const S_RADIO_INACTIVE = pc.dim('○');
const S_RADIO_DISABLED = pc.dim('◌');
const S_BULLET = sky('•');
const S_BAR = pc.dim('│');
const S_BAR_H = pc.dim('─');
const S_CORNER = pc.dim('└');
const S_BOX_TL = pc.dim('┌');
const S_BOX_TR = pc.dim('┐');
const S_BOX_BL = pc.dim('└');
const S_BOX_BR = pc.dim('┘');
const S_BOX_H = pc.dim('─');
const S_BOX_V = pc.dim('│');

export function approxStringWidth(plain: string): number {
  let width = 0;
  for (const ch of plain) {
    const code = ch.codePointAt(0)!;
    if (code === 0) continue;
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0x1f000 && code <= 0x1f9ff);
    width += wide ? 2 : 1;
  }
  return width;
}

export function visualRowsForLine(line: string, columns: number): number {
  const plain = stripVTControlCharacters(line);
  const cols = Math.max(1, columns);
  return Math.max(1, Math.ceil(approxStringWidth(plain) / cols));
}

export function countVisualRowsForLines(lines: string[], columns: number | undefined): number {
  const cols =
    columns !== undefined && columns > 0
      ? columns
      : process.stdout.columns && process.stdout.columns > 0
        ? process.stdout.columns
        : 80;
  return lines.reduce((sum, line) => sum + visualRowsForLine(line, cols), 0);
}

function truncateToWidth(text: string, width: number): string {
  let truncated = '';
  for (const char of text) {
    if (approxStringWidth(truncated + char) > width) break;
    truncated += char;
  }
  return truncated;
}

function padPlain(text: string, width: number): string {
  const w = approxStringWidth(text);
  if (w >= width) return truncateToWidth(text, width);
  return text + ' '.repeat(width - w);
}

/** Wrap plain text into up to maxLines of width. */
function wrapPlain(text: string, width: number, maxLines: number): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];
  const lines: string[] = [];
  let remaining = normalized;
  while (remaining && lines.length < maxLines) {
    if (approxStringWidth(remaining) <= width) {
      lines.push(remaining);
      remaining = '';
      break;
    }
    const candidate = truncateToWidth(remaining, width);
    const breakAt = candidate.lastIndexOf(' ');
    if (breakAt > 0) {
      lines.push(candidate.slice(0, breakAt).trimEnd());
      remaining = remaining.slice(breakAt).trimStart();
    } else {
      lines.push(candidate);
      remaining = remaining.slice(candidate.length).trimStart();
    }
  }
  if (remaining && lines.length > 0) {
    const last = lines.length - 1;
    lines[last] = `${truncateToWidth(lines[last]!, Math.max(0, width - 1)).trimEnd()}…`;
  }
  return lines.length ? lines : [''];
}

/**
 * Fixed-height Info box. Long fields (About / Description) wrap across multiple rows.
 * Short meta fields stay one line. Total body height is always `rows`.
 */
function renderInfoBox(fields: DetailField[], innerWidth: number, rows: number): string[] {
  const title = ' Info ';
  const topPad = Math.max(0, innerWidth - approxStringWidth(title));
  const top = `${S_BOX_TL}${S_BOX_H}${title}${S_BOX_H.repeat(topPad)}${S_BOX_TR}`;
  const bottom = `${S_BOX_BL}${S_BOX_H.repeat(innerWidth + 1)}${S_BOX_BR}`;

  const contentWidth = Math.max(12, innerWidth - 1);
  const labelW = 10;
  const valueW = Math.max(8, contentWidth - labelW - 1);
  const longLabels = new Set(['about', 'description', 'desc', 'note', 'action']);

  // Expand fields into display rows (label + value lines).
  type Row = { label: string; value: string; cont?: boolean };
  const expanded: Row[] = [];
  for (const f of fields) {
    if (!f.label && !f.value) continue;
    const isLong = longLabels.has(f.label.toLowerCase());
    if (isLong) {
      // Reserve remaining budget later — first pass: wrap to up to 4 lines.
      const wrapped = wrapPlain(f.value || '—', valueW, 4);
      wrapped.forEach((line, idx) => {
        expanded.push({ label: idx === 0 ? f.label : '', value: line, cont: idx > 0 });
      });
    } else {
      expanded.push({
        label: f.label,
        value: truncateToWidth((f.value || '—').replace(/\s+/g, ' ').trim(), valueW),
      });
    }
  }

  // Fit into fixed `rows` (trim from end of long wraps if needed).
  while (expanded.length > rows) expanded.pop();
  while (expanded.length < rows) expanded.push({ label: '', value: '' });

  const body = expanded.map((r) => {
    if (!r.label && !r.value) {
      return `${S_BOX_V} ${' '.repeat(contentWidth)} ${S_BOX_V}`;
    }
    const labelPart = r.label
      ? `${sky(padPlain(r.label, labelW))} `
      : `${' '.repeat(labelW)} `;
    const valuePart = r.cont ? pc.dim(r.value) : pc.bold(r.value);
    const content = `${labelPart}${valuePart}`;
    const plainW = approxStringWidth(stripVTControlCharacters(content));
    const pad = Math.max(0, contentWidth - plainW);
    return `${S_BOX_V} ${content}${' '.repeat(pad)} ${S_BOX_V}`;
  });

  return [`${S_BAR} ${top}`, ...body.map((b) => `${S_BAR} ${b}`), `${S_BAR} ${bottom}`];
}

function fieldsForItem<T>(item: SearchItem<T> | undefined, allSelected: boolean, total: number): DetailField[] {
  if (!item) {
    return [
      { label: 'Name', value: '—' },
      { label: 'About', value: 'No item highlighted' },
    ];
  }
  if (String(item.value) === ALL_VALUE) {
    return [
      { label: 'Name', value: item.label },
      {
        label: 'About',
        value: allSelected
          ? `All ${total} items selected. Individual rows are locked until you turn All off.`
          : `Select every item in the list (${total}). Space toggles All; Enter confirms.`,
      },
      { label: 'Count', value: String(total) },
    ];
  }
  if (item.fields && item.fields.length) return item.fields;
  const desc = (item.detail || item.hint || '').replace(/\s+/g, ' ').trim();
  return [
    { label: 'Name', value: item.label },
    { label: 'Id', value: String(item.value) },
    { label: 'About', value: desc || '—' },
  ];
}

/**
 * Interactive search multiselect: fixed viewport, blue selection, rectangle info box.
 * Optional All row — when selected, other rows are disabled.
 */
export async function searchMultiselect<T = string>(
  options: SearchMultiselectOptions<T>,
): Promise<T[] | symbol> {
  const {
    message,
    items,
    maxVisible = 8,
    initialSelected = [],
    required = false,
    lockedSection,
    searchable = true,
    showDetail = true,
    detailLines = 8,
    showSelectedSummary = true,
    includeAllOption = false,
    allLabel,
    allHint = 'select every item · disables others',
  } = options;

  const seen = new Set<string>();
  const uniqueItems = items.filter((item) => {
    const key = String(item.value);
    if (seen.has(key) || key === ALL_VALUE) return false;
    seen.add(key);
    return true;
  });

  const allItem: SearchItem<T> | null = includeAllOption
    ? {
        value: ALL_VALUE as T,
        label: allLabel || `All (${uniqueItems.length})`,
        hint: allHint,
        fields: [
          { label: 'Name', value: allLabel || `All (${uniqueItems.length})` },
          { label: 'Action', value: 'Install every listed item' },
          { label: 'Count', value: String(uniqueItems.length) },
          { label: 'Note', value: 'When All is on, other rows are disabled' },
          { label: '', value: '' },
        ],
      }
    : null;

  const listItems = allItem ? [allItem, ...uniqueItems] : uniqueItems;

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: silentOutput,
      terminal: false,
    });

    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin, rl);
    if (process.stdout.isTTY) process.stdout.write('\x1b[?25l'); // hide cursor while redrawing

    let query = '';
    let cursor = 0;
    const selected = new Set<T>(
      initialSelected.filter((v) => String(v) !== ALL_VALUE),
    );
    let lastRenderHeight = 0;
    let requiredFlash = false;

    const lockedValues = lockedSection ? lockedSection.items.map((i) => i.value) : [];
    const isAllOn = () => selected.has(ALL_VALUE as T);

    const getFiltered = (): SearchItem<T>[] => {
      // Keep All pinned at top when present and query empty / matches.
      const rest = uniqueItems;
      if (!query) return allItem ? [allItem, ...rest] : rest;
      const lowerQ = query.toLowerCase();
      const matched = rest.filter(
        (item) =>
          item.label.toLowerCase().includes(lowerQ) ||
          String(item.value).toLowerCase().includes(lowerQ) ||
          (item.hint && item.hint.toLowerCase().includes(lowerQ)),
      );
      const allMatches =
        allItem &&
        (allItem.label.toLowerCase().includes(lowerQ) || 'all'.includes(lowerQ));
      return allMatches && allItem ? [allItem, ...matched] : matched;
    };

    const lockedTotal = lockedSection
      ? lockedSection.items.length + (lockedSection.hiddenCount ?? 0)
      : 0;

    const selectedSummaryLine = (allOn: boolean): string => {
      if (allOn) {
        const extra = lockedTotal
          ? `Universal (${lockedTotal}) + All additional (${uniqueItems.length})`
          : `All ${uniqueItems.length}`;
        return `${S_BAR} ${BLUE('Selected:')} ${pc.bold(extra)}`;
      }
      const labels = uniqueItems
        .filter((item) => selected.has(item.value))
        .map((item) => item.label);
      if (labels.length === 0) {
        if (requiredFlash) {
          return `${S_BAR} ${pc.red('Selected: pick at least one')}`;
        }
        if (lockedTotal > 0) {
          return `${S_BAR} ${BLUE('Selected:')} ${pc.bold(`Universal (${lockedTotal})`)}`;
        }
        return `${S_BAR} ${pc.dim('Selected: (none)')}`;
      }
      const prefix = lockedTotal > 0 ? `Universal (${lockedTotal}) + ` : '';
      const summary =
        labels.length <= 3
          ? labels.join(', ')
          : `${labels.slice(0, 3).join(', ')} +${labels.length - 3} more`;
      return `${S_BAR} ${BLUE('Selected:')} ${prefix}${summary}`;
    };

    const submitSummary = (allOn: boolean): string => {
      if (allOn) {
        return lockedTotal
          ? `Universal (${lockedTotal}) + All additional (${uniqueItems.length})`
          : `All (${uniqueItems.length})`;
      }
      const labels = uniqueItems
        .filter((item) => selected.has(item.value))
        .map((item) => item.label);
      if (labels.length === 0) {
        return lockedTotal > 0 ? `Universal (${lockedTotal})` : 'none';
      }
      const prefix = lockedTotal > 0 ? `Universal (${lockedTotal}) + ` : '';
      return prefix + (labels.length <= 5 ? labels.join(', ') : `${labels.slice(0, 5).join(', ')} +${labels.length - 5}`);
    };

    const clearPrevious = (rows: number): void => {
      if (rows <= 0) return;
      // Line-by-line clear — reliable on Windows when the frame is tall / scrolled.
      for (let i = 0; i < rows; i++) {
        process.stdout.write('\x1b[1A\x1b[2K');
      }
    };

    const render = (state: 'active' | 'submit' | 'cancel' = 'active'): void => {
      const lines: string[] = [];
      const filtered = getFiltered();
      const allOn = isAllOn();
      const icon =
        state === 'active' ? S_STEP_ACTIVE : state === 'cancel' ? S_STEP_CANCEL : S_STEP_SUBMIT;
      lines.push(`${icon} ${pc.bold(message)}`);
      lines.push(`${S_BAR}`);

      if (state === 'active') {
        if (lockedSection && lockedTotal > 0) {
          // One line only — listing names made the frame taller than the viewport and
          // broke Windows cursor-up clears (stacked duplicate prompts).
          lines.push(
            `${S_BAR} ${S_BULLET} ${pc.bold(lockedSection.title)} ${pc.dim(`· ${lockedTotal} always included`)}`,
          );
          lines.push(`${S_BAR} ${pc.bold('Additional')}`);
          lines.push(`${S_BAR}`);
        }

        if (searchable) {
          lines.push(`${S_BAR} ${pc.dim('Search:')} ${query}${pc.inverse(' ')}`);
          lines.push(`${S_BAR} ${pc.dim('↑↓ move · space select · enter confirm')}`);
          lines.push(`${S_BAR}`);
        }

        const visibleStart = Math.max(
          0,
          Math.min(cursor - Math.floor(maxVisible / 2), Math.max(0, filtered.length - maxVisible)),
        );
        const visibleEnd = Math.min(filtered.length, visibleStart + maxVisible);
        const visible = filtered.slice(visibleStart, visibleEnd);

        if (filtered.length === 0) {
          lines.push(`${S_BAR} ${pc.dim('No matches found')}`);
        } else {
          for (let i = 0; i < visible.length; i++) {
            const item = visible[i]!;
            const actualIndex = visibleStart + i;
            const isCursor = actualIndex === cursor;
            const isAllRow = String(item.value) === ALL_VALUE;
            const disabled = allOn && !isAllRow;
            const isSelected = isAllRow ? allOn : allOn ? true : selected.has(item.value);

            let radio: string;
            if (disabled) radio = S_RADIO_DISABLED;
            else if (isSelected) radio = S_RADIO_ACTIVE;
            else radio = S_RADIO_INACTIVE;

            let label: string;
            if (disabled) label = pc.dim(item.label);
            else if (isCursor) label = pc.underline(BLUE_BOLD(item.label));
            else if (isAllRow) label = pc.bold(item.label);
            else label = item.label;

            const hint =
              disabled || !item.hint
                ? ''
                : pc.dim(` · ${item.hint.slice(0, 36)}`);
            const prefix = isCursor ? BLUE('❯') : ' ';
            lines.push(`${S_BAR} ${prefix} ${radio} ${label}${hint}`);
          }
          const hiddenBefore = visibleStart;
          const hiddenAfter = filtered.length - visibleEnd;
          if (hiddenBefore > 0 || hiddenAfter > 0) {
            const parts: string[] = [];
            if (hiddenBefore > 0) parts.push(`↑ ${hiddenBefore} more`);
            if (hiddenAfter > 0) parts.push(`↓ ${hiddenAfter} more`);
            lines.push(`${S_BAR} ${pc.dim(parts.join('  '))}`);
          }
        }

        if (showDetail) {
          const columns =
            process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 80;
          const boxInner = Math.min(72, Math.max(48, columns - 6));
          const fields = fieldsForItem(filtered[cursor], allOn, uniqueItems.length);
          lines.push(`${S_BAR}`);
          lines.push(...renderInfoBox(fields, boxInner, detailLines));
        }

        if (showSelectedSummary) {
          lines.push(`${S_BAR}`);
          lines.push(selectedSummaryLine(allOn));
        }

        lines.push(`${S_CORNER}`);
      } else if (state === 'submit') {
        lines.push(`${S_BAR} ${pc.dim(submitSummary(allOn))}`);
      } else {
        lines.push(`${S_BAR} ${pc.strikethrough(pc.dim('Cancelled'))}`);
      }

      clearPrevious(lastRenderHeight);
      const out = lines.join('\n') + '\n';
      process.stdout.write(out);
      lastRenderHeight = countVisualRowsForLines(lines, process.stdout.columns);
    };

    const cleanup = (): void => {
      process.stdin.removeListener('keypress', keypressHandler);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      if (process.stdout.isTTY) process.stdout.write('\x1b[?25h'); // show cursor
      rl.close();
    };

    const submit = (): void => {
      const allOn = isAllOn();
      if (required && !allOn && selected.size === 0 && lockedValues.length === 0) {
        requiredFlash = true;
        render();
        return;
      }
      render('submit');
      cleanup();
      if (allOn) {
        resolve([...lockedValues, ...uniqueItems.map((i) => i.value)]);
      } else {
        resolve([...lockedValues, ...Array.from(selected).filter((v) => String(v) !== ALL_VALUE)]);
      }
    };

    const cancel = (): void => {
      render('cancel');
      cleanup();
      resolve(cancelSymbol);
    };

    const keypressHandler = (_str: string, key: readline.Key): void => {
      if (!key) return;
      const filtered = getFiltered();

      if (key.name === 'return') {
        submit();
        return;
      }
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cancel();
        return;
      }
      if (key.name === 'up') {
        cursor = Math.max(0, cursor - 1);
        requiredFlash = false;
        render();
        return;
      }
      if (key.name === 'down') {
        cursor = Math.min(Math.max(0, filtered.length - 1), cursor + 1);
        requiredFlash = false;
        render();
        return;
      }
      if (key.name === 'space') {
        const item = filtered[cursor];
        if (!item) return;
        const isAllRow = String(item.value) === ALL_VALUE;
        if (isAllRow) {
          if (isAllOn()) {
            selected.delete(ALL_VALUE as T);
          } else {
            selected.clear();
            selected.add(ALL_VALUE as T);
          }
        } else if (isAllOn()) {
          // Disabled while All is on — ignore.
          requiredFlash = false;
          render();
          return;
        } else if (selected.has(item.value)) {
          selected.delete(item.value);
        } else {
          selected.add(item.value);
        }
        requiredFlash = false;
        render();
        return;
      }
      if (key.name === 'backspace') {
        query = query.slice(0, -1);
        cursor = 0;
        render();
        return;
      }
      if (searchable && key.sequence && !key.ctrl && !key.meta && key.sequence.length === 1) {
        query += key.sequence;
        cursor = 0;
        render();
        return;
      }
    };

    process.stdin.on('keypress', keypressHandler);
    render();
  });
}
