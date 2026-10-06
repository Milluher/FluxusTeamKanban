/**
 * The colour a column is drawn in, by name.
 *
 * Shared between a board's own columns and the "My tickets" board, so a column
 * called "In Progress" looks the same wherever it is rendered.
 */
export interface ColumnStyle {
  dot: string;
  badgeBg: string;
  badgeText: string;
}

const COLUMN_STYLES: Record<string, ColumnStyle> = {
  'Backlog':     { dot: '#94a3b8', badgeBg: '#f1f5f9', badgeText: '#475569' },
  'To Do':       { dot: '#60a5fa', badgeBg: '#eff6ff', badgeText: '#2563eb' },
  'In Progress': { dot: '#e8390e', badgeBg: '#fff7f5', badgeText: '#c73009' },
  'Review':      { dot: '#a78bfa', badgeBg: '#f5f3ff', badgeText: '#7c3aed' },
  'Done':        { dot: '#34d399', badgeBg: '#ecfdf5', badgeText: '#047857' },
};

const DEFAULT_STYLE: ColumnStyle = { dot: '#94a3b8', badgeBg: '#f1f5f9', badgeText: '#475569' };

export function columnStyle(name: string): ColumnStyle {
  return COLUMN_STYLES[name] || DEFAULT_STYLE;
}
