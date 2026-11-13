import React, { useState } from 'react';
import {
  DataGrid, DataGridBody, DataGridCell, DataGridHeader, DataGridHeaderCell, DataGridRow,
  makeStyles, mergeClasses, Spinner, tokens,
} from '@fluentui/react-components';
import { Empty } from './ui';

type SortDirection = 'ascending' | 'descending';
type SortDef = { sortColumn: string; sortDirection: SortDirection };

export type DataTableColumn<T> = {
  columnId: string;
  title: string;
  compare?: (a: T, b: T) => number;
  cell: (item: T) => React.ReactNode;
  defaultSort?: 'ascending' | 'descending';
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

const useStyles = makeStyles({
  wrap: { overflow: 'auto', borderRadius: tokens.borderRadiusMedium, border: `1px solid ${tokens.colorNeutralStroke2}`, background: tokens.colorNeutralBackground1, maxHeight: '70vh' },
  grid: { minWidth: '820px', width: '100%' },
  headSticky: { '&&& th': { position: 'sticky', top: 0, zIndex: 2, background: tokens.colorNeutralBackground2, boxShadow: `0 1px 0 ${tokens.colorNeutralStroke1}` } },
  headCell: { fontSize: tokens.fontSizeBase100, fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground2, whiteSpace: 'nowrap' as const },
  cellBase: { fontSize: tokens.fontSizeBase200 },
  clickableRow: { cursor: 'pointer' },
});

const normalizeSelection = (data: unknown): string[] => {
  const inner = (data as { selectedItems?: string[] | Set<string> })?.selectedItems ?? data;
  if (inner instanceof Set) return Array.from(inner);
  if (Array.isArray(inner)) return inner;
  return [];
};

export function DataTable<T>(props: Props<T>) {
  const { items, columns, getRowId, ariaLabel, selectable, selectedIds, onSelectionChange, onRowClick, loading, loadingLabel, emptyText } = props;
  const s = useStyles();
  const defaultCol = columns.find(c => c.defaultSort) ?? columns.find(c => c.compare);
  const [sort, setSort] = useState<SortDef>({
    sortColumn: defaultCol?.columnId ?? '',
    sortDirection: defaultCol?.defaultSort === 'descending' ? 'descending' : 'ascending',
  });

  if (loading) return <div style={{ padding: '32px', textAlign: 'center' }}><Spinner label={loadingLabel || 'Loading…'} /></div>;

  /* Sorting applied client-side with the column compare helper. */
  const sorted = (() => {
    const col = columns.find(c => c.columnId === sort.sortColumn);
    if (!col?.compare) return items;
    const copy = [...items];
    copy.sort((a, b) => sort.sortDirection === 'descending' ? -col.compare!(a, b) : col.compare!(a, b));
    return copy;
  })();

  const defs = columns.map(c => ({
    columnId: c.columnId,
    title: c.title,
    compare: c.compare ?? (() => 0),
    renderHeaderCell: () => c.title,
    renderCell: (item: T) => c.cell(item),
    minWidth: c.minWidth,
  }));

  type RowInfo = { item: T; rowId: string | number };
  const bodyRender = (({ item, rowId }: RowInfo) => (
    <DataGridRow
      key={String(rowId)}
      selectionCell={selectable ? { 'aria-label': `Select row ${rowId}` } : undefined}
      className={onRowClick ? s.clickableRow : undefined}
      onClick={onRowClick ? () => onRowClick(item) : undefined}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {col => (
        <DataGridCell key={col.columnId} style={{ minWidth: (col as any).minWidth ?? undefined, whiteSpace: 'normal' }}>
          {(col as any).renderCell ? (col as any).renderCell(item) : null}
        </DataGridCell>
      )}
    </DataGridRow>
  ));

  return (
    <div className={s.wrap}>
      <DataGrid
        className={`${s.grid} ${s.headSticky}`}
        items={sorted}
        columns={defs}
        getRowId={getRowId}
        aria-label={ariaLabel}
        focusMode="composite"
        subtleSelection
        selectionMode={selectable ? 'multiselect' : undefined}
        selectedItems={selectable ? selectedIds : undefined}
        onSelectionChange={selectable && onSelectionChange ? (_e, data) => onSelectionChange(normalizeSelection(data)) : undefined}
        sortState={sort}
        onSortChange={(_e, data) => setSort({ sortColumn: String(data.sortColumn), sortDirection: data.sortDirection === 'descending' ? 'descending' : 'ascending' })}
      >
        <DataGridHeader>
          <DataGridRow selectionCell={selectable ? { 'aria-hidden': true } : undefined}>
            {col => (
              <DataGridHeaderCell key={col.columnId} className={s.headCell}>
                {col.renderHeaderCell()}
              </DataGridHeaderCell>
            )}
          </DataGridRow>
        </DataGridHeader>
        <DataGridBody>{bodyRender}</DataGridBody>
      </DataGrid>
      {!items.length && <Empty>{emptyText || 'No matching records.'}</Empty>}
    </div>
  );
}

export { mergeClasses };
