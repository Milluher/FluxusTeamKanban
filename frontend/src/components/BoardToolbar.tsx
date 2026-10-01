'use client';

export interface BoardFilters {
  search: string;
  type: string;
  project: string;
  epic: string;
  flow: string;
  priority: string;
}

export interface BoardFilterOptions {
  types: string[];
  projects: string[];
  epics: string[];
  flows: string[];
  priorities: string[];
}

interface Props {
  mine: boolean;
  onMineChange: (mine: boolean) => void;
  counts: { mine: number; all: number };
  filters: BoardFilters;
  onFilterChange: (patch: Partial<BoardFilters>) => void;
  options: BoardFilterOptions;
  activeFilterCount: number;
  onClearFilters: () => void;
  onNewTicket: () => void;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  low: { label: 'Low', color: '#6b7280', bg: '#f9fafb', border: '#d1d5db' },
  medium: { label: 'Medium', color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  high: { label: 'High', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  urgent: { label: 'Urgent 🔥', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
};

const selectStyle = (active: boolean) => ({
  border: active ? '1px solid #e8390e' : '1px solid #e5e7eb',
  background: active ? '#fff7f5' : 'white',
  color: active ? '#c73009' : '#6b7280',
});

// The one toolbar both board types use. Kanban boards used to put Mine/All at the
// top left on white while sprint boards put it top right in the navy bar with the
// filters on a separate row below — the same control in two places in two styles.
export default function BoardToolbar({
  mine,
  onMineChange,
  counts,
  filters,
  onFilterChange,
  options,
  activeFilterCount,
  onClearFilters,
  onNewTicket,
}: Props) {
  const select = (
    key: 'type' | 'project' | 'epic' | 'flow',
    label: string,
    values: string[]
  ) =>
    values.length > 0 && (
      <select
        key={key}
        value={filters[key]}
        onChange={(e) => onFilterChange({ [key]: e.target.value })}
        aria-label={label}
        className="text-xs font-medium rounded-lg px-2 py-1 flex-shrink-0 outline-none transition-all duration-150"
        style={selectStyle(Boolean(filters[key]))}
      >
        <option value="">{label}</option>
        {values.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    );

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-2 flex items-center gap-2 sm:gap-3 overflow-x-auto">
      {/* Mine / All — counts make it obvious when a filter is hiding tickets. */}
      <div className="flex rounded-lg overflow-hidden text-xs font-semibold flex-shrink-0 border border-gray-200">
        <button
          onClick={() => onMineChange(true)}
          aria-pressed={mine}
          className="px-3 py-1 transition-all"
          style={{ background: mine ? '#1a1f3c' : 'white', color: mine ? 'white' : '#6b7280' }}
        >
          Mine &middot; {counts.mine}
        </button>
        <button
          onClick={() => onMineChange(false)}
          aria-pressed={!mine}
          className="px-3 py-1 transition-all"
          style={{ background: !mine ? '#1a1f3c' : 'white', color: !mine ? 'white' : '#6b7280' }}
        >
          All &middot; {counts.all}
        </button>
      </div>

      {select('type', 'All Types', options.types)}
      {select('project', 'All Projects', options.projects)}
      {select('epic', 'All Epics', options.epics)}
      {select('flow', 'All Flows', options.flows)}

      {options.priorities.length > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {options.priorities.map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            const active = filters.priority === p;
            return (
              <button
                key={p}
                onClick={() => onFilterChange({ priority: active ? '' : p })}
                aria-pressed={active}
                className="text-xs font-semibold px-2 py-1 rounded-lg transition-all duration-150"
                style={{
                  background: active ? cfg.color : cfg.bg,
                  color: active ? 'white' : cfg.color,
                  border: `1px solid ${active ? cfg.color : cfg.border}`,
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Search — matches the title and the text of the description, so a
          checklist's items are searchable even though cards show only a tally. */}
      <div className="relative flex-shrink-0">
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
        >
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="Search tickets"
          aria-label="Search tickets"
          className="text-xs rounded-lg pl-7 pr-2 py-1 w-32 sm:w-44 outline-none transition-all duration-150 text-gray-700 placeholder-gray-500"
          style={selectStyle(Boolean(filters.search))}
        />
      </div>

      {activeFilterCount > 0 && (
        <button
          onClick={onClearFilters}
          className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all duration-150"
          style={{ color: '#c73009', background: '#fff7f5', border: '1px solid #fbd5c8' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Clear {activeFilterCount > 1 ? `(${activeFilterCount})` : ''}
        </button>
      )}

      <button
        onClick={onNewTicket}
        className="ml-auto flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-white px-3 py-1.5 min-h-[32px] rounded-lg transition-all duration-150"
        style={{ background: '#c73009' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#a82607'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#c73009'; }}
      >
        <span className="text-sm leading-none font-bold">+</span>
        New ticket
      </button>
    </div>
  );
}
