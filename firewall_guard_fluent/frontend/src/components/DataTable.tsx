import React, { useMemo, useState } from 'react';
import { Button, Spinner, Text, tokens } from '@fluentui/react-components';
import { ArrowSort16Regular, ArrowSortDown16Regular, ArrowSortUp16Regular } from '@fluentui/react-icons';
import { wildcardMatch } from './ui';

type SortDirection = 'ascending' | 'descending';

export type ColumnFilter = 'text' | 'number' | 'select' | 'none';

export type DataTableColumn<T> = {
  columnId: string;
  title: string;
  compare?: (a: T, b: T) => number;
  cell: (item: T) => React.ReactNode;
  /** Plain text used by the column filter and shown as the cell tooltip when set. */
  filterValue?: (item: T) => string | number | null | undefined;
  filter?: ColumnFilter;
  defaultSort?: SortDirection;
  minWidth?: number;
};

type Props<T> = {
  items: T[];
  columns: DataTableColumn<T>[];
  getRowId: (item: T) => string;
  ariaLabel: string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  loadingLabel?: string;
  emptyText?: string;
};

const textOf = <T,>(col: DataTableColumn<T>, item: T) => String(col.filterValue?.(item) ?? '').trim();

function passesFilter(raw: string, query: string, kind: ColumnFilter): boolean {
  const q = query.trim();
  if (!q || q === '*') return true;
  if (kind === 'select') return raw.toLowerCase() === q.toLowerCase();
  if (kind === 'number') {
    const op = q.match(/^(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/);
    if (op) {
      const n = Number(raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN);
      const t = Number(op[2]);
      if (!Number.isFinite(n)) return false;
      if (op[1] === '>') return n > t;
      if (op[1] === '<') return n < t;
      if (op[1] === '>=') return n >= t;
      if (op[1] === '<=') return n <= t;
      return n === t;
    }
  }
  if (q.includes('*') || q.includes('?')) {
    const pattern = q.startsWith('*') || q.endsWith('*') || q.includes('?') ? q : `*${q}*`;
    return wildcardMatch(raw, pattern);
  }
  return raw.toLowerCase().includes(q.toLowerCase());
}

export function DataTable<T>(props: Props<T>) {
  const { items, columns, getRowId, ariaLabel, selectable, selectedIds = [], onSelectionChange, onRowClick, loading, loadingLabel, emptyText } = props;
  const defaultCol = columns.find(c => c.defaultSort && c.compare) ?? columns.find(c => c.compare);
  const [sort, setSort] = useState<{ columnId: string; direction: SortDirection }>({
    columnId: defaultCol?.columnId ?? '',
    direction: defaultCol?.defaultSort === 'descending' ? 'descending' : 'ascending',
  });
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filterable = columns.filter(c => (c.filter ?? 'text') !== 'none');
  const activeFilters = filterable.filter(c => (filters[c.columnId] || '').trim());

  const optionsFor = (col: DataTableColumn<T>) => {
    const values = new Set<string>();
    for (const item of items) {
      const v = textOf(col, item);
      if (v) values.add(v);
      if (values.size > 40) return null;
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  };

  const kindOf = (col: DataTableColumn<T>): ColumnFilter => {
    const kind = col.filter ?? 'text';
    if (kind !== 'select') return kind;
    return optionsFor(col) ? 'select' : 'text';
  };

  const filtered = useMemo(() => items.filter(item =>
    filterable.every(col => passesFilter(textOf(col, item), filters[col.columnId] || '', kindOf(col))),
  ), [items, filters, columns]);

  const sorted = useMemo(() => {
    const col = columns.find(c => c.columnId === sort.columnId);
    if (!col?.compare) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => (sort.direction === 'descending' ? -col.compare!(a, b) : col.compare!(a, b)));
    return copy;
  }, [filtered, columns, sort]);

  const visibleIds = sorted.map(getRowId);
  const selectedVisible = visibleIds.filter(id => selectedIds.includes(id));
  const allVisible = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const toggleSort = (col: DataTableColumn<T>) => {
    if (!col.compare) return;
    setSort(prev => prev.columnId === col.columnId
      ? { columnId: col.columnId, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' }
      : { columnId: col.columnId, direction: col.defaultSort === 'descending' ? 'descending' : 'ascending' });
  };

  const setFilter = (id: string, value: string) => setFilters(prev => ({ ...prev, [id]: value }));

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allVisible) onSelectionChange(selectedIds.filter(id => !visibleIds.includes(id)));
    else onSelectionChange(Array.from(new Set([...selectedIds, ...visibleIds])));
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><Spinner label={loadingLabel || 'Loading…'} /></div>;

  const tableMin = columns.reduce((n, c) => n + (c.minWidth ?? 120), selectable ? 44 : 0);

  return (
    <div className="fg-grid-wrap">
      <div className="fg-grid-meta">
        <Text size={200}>
          {sorted.length === items.length ? `${items.length} items` : `${sorted.length} of ${items.length} items`}
          {sort.columnId ? `. Sorted by ${columns.find(c => c.columnId === sort.columnId)?.title ?? sort.columnId}` : ''}
          {onRowClick ? '. Select a row to open details.' : ''}
        </Text>
        {activeFilters.length > 0 && (
          <Button appearance="subtle" size="small" onClick={() => setFilters({})}>Clear {activeFilters.length} column filter{activeFilters.length === 1 ? '' : 's'}</Button>
        )}
      </div>
      <div className="fg-grid-scroll">
        <table className="fg-grid" aria-label={ariaLabel} style={{ minWidth: tableMin }}>
          <colgroup>
            {selectable && <col style={{ width: 44 }} />}
            {columns.map(c => <col key={c.columnId} style={{ width: c.minWidth ?? 140 }} />)}
          </colgroup>
          <thead>
            <tr>
              {selectable && (
                <th className="fg-check">
                  <input type="checkbox" aria-label="Select all visible rows" checked={allVisible} onChange={toggleAll} />
                </th>
              )}
              {columns.map(col => {
                const active = sort.columnId === col.columnId && !!col.compare;
                const Icon = !col.compare ? null : !active ? ArrowSort16Regular : sort.direction === 'ascending' ? ArrowSortUp16Regular : ArrowSortDown16Regular;
                return (
                  <th key={col.columnId} aria-sort={active ? sort.direction : 'none'}>
                    {col.compare ? (
                      <button type="button" className="fg-sort" onClick={() => toggleSort(col)} aria-label={`Sort by ${col.title}`}>
                        <span className="label">{col.title}</span>
                        {Icon && <Icon className={active ? 'mark on' : 'mark'} />}
                      </button>
                    ) : (
                      <span className="fg-sort static"><span className="label">{col.title}</span></span>
                    )}
                  </th>
                );
              })}
            </tr>
            <tr className="fg-filters">
              {selectable && <th className="fg-check" />}
              {columns.map(col => {
                const kind = col.filter ?? 'text';
                if (kind === 'none') return <th key={col.columnId} />;
                const selectOptions = kind === 'select' ? optionsFor(col) : null;
                const useSelect = kind === 'select' && selectOptions;
                return (
                  <th key={col.columnId}>
                    {useSelect ? (
                      <select
                        className="fg-filter"
                        aria-label={`Filter ${col.title}`}
                        value={filters[col.columnId] || ''}
                        onChange={e => setFilter(col.columnId, e.target.value)}
                      >
                        <option value="">All</option>
                        {selectOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input
                        className="fg-filter"
                        aria-label={`Filter ${col.title}`}
                        placeholder={kind === 'number' ? '> 0' : 'Filter'}
                        value={filters[col.columnId] || ''}
                        onChange={e => setFilter(col.columnId, e.target.value)}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map(item => {
              const id = getRowId(item);
              const selected = selectedIds.includes(id);
              return (
                <tr
                  key={id}
                  className={onRowClick ? 'clickable' : undefined}
                  data-selected={selected || undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onRowClick(item);
                  } : undefined}
                  onClick={onRowClick ? (event) => {
                    const target = event.target as HTMLElement | null;
                    if (target?.closest('button, a, input, select, textarea, label')) return;
                    onRowClick(item);
                  } : undefined}
                >
                  {selectable && (
                    <td className="fg-check" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${id}`} checked={selected} onChange={() => toggleRow(id)} />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.columnId}>
                      <div className="fg-cell" title={textOf(col, item) || undefined}>{col.cell(item)}</div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!sorted.length && (
        <div className="fg-grid-empty" style={{ color: tokens.colorNeutralForeground3 }}>
          {items.length ? 'No rows match the column filters.' : (emptyText || 'No matching records.')}
        </div>
      )}
    </div>
  );
}
