import { useMemo, useRef } from 'react'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { formatDate } from '../lib/format'
import type { RepoColumnKey, RepoColumnVisibility } from '../lib/repoColumns'
import { useLocalStorageState } from '../hooks/useLocalStorageState'
import type { GitHubRepo } from '../types'

type RepoPanelProps = {
  repos: GitHubRepo[]
  totalCount?: number
  columnVisibility: RepoColumnVisibility
  onColumnVisibilityChange: Dispatch<SetStateAction<RepoColumnVisibility>>
}

const RepoPanel = ({
  repos,
  totalCount,
  columnVisibility,
  onColumnVisibilityChange,
}: RepoPanelProps) => {
  const [sorting, setSorting] = useLocalStorageState<SortingState>(
    'repo-table-sorting-v1',
    [{ id: 'name', desc: false }],
  )
  const columns = useMemo<ColumnDef<GitHubRepo>[]>(
    () => [
      {
        id: 'name',
        header: 'Repository',
        accessorFn: (row) => row.full_name,
        cell: ({ row }) => (
          <a href={row.original.html_url} target="_blank" rel="noreferrer">
            {row.original.full_name}
          </a>
        ),
      },
      {
        id: 'visibility',
        header: 'Visibility',
        accessorFn: (row) => (row.private ? 'Private' : 'Public'),
        cell: ({ row }) => (
          <span className={`badge ${row.original.private ? 'private' : 'public'}`}>
            {row.original.private ? 'Private' : 'Public'}
          </span>
        ),
      },
      {
        id: 'language',
        header: 'Language',
        accessorFn: (row) => row.language || 'Unknown',
        cell: ({ row }) => row.original.language || 'Unknown',
      },
      {
        id: 'archived',
        header: 'Archived',
        accessorFn: (row) => (row.archived ? 'Archived' : 'Active'),
        cell: ({ row }) => (row.original.archived ? 'Archived' : 'Active'),
      },
      {
        id: 'updated',
        header: 'Updated',
        accessorFn: (row) => row.updated_at || '',
        cell: ({ row }) => formatDate(row.original.updated_at),
      },
    ],
    [],
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: repos,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const { gridTemplateColumns, minWidth } = useMemo(() => {
    const columnWidths: Record<RepoColumnKey, { template: string; min: number }> = {
      name: { template: 'minmax(260px, 2.4fr)', min: 260 },
      visibility: { template: 'minmax(120px, 1fr)', min: 120 },
      language: { template: 'minmax(130px, 1fr)', min: 130 },
      archived: { template: 'minmax(120px, 1fr)', min: 120 },
      updated: { template: 'minmax(150px, 1fr)', min: 150 },
    }
    const visible = table.getVisibleLeafColumns()
    const template = visible
      .map((column) => {
        const key = column.id as RepoColumnKey
        return columnWidths[key]?.template || 'minmax(120px, 1fr)'
      })
      .join(' ')
    const gap = 12
    const padding = 24
    const min =
      visible.reduce((sum, column) => {
        const key = column.id as RepoColumnKey
        return sum + (columnWidths[key]?.min ?? 120)
      }, 0) +
      Math.max(visible.length - 1, 0) * gap +
      padding
    return { gridTemplateColumns: template, minWidth: Math.max(min, 0) }
  }, [table])

  const rows = table.getRowModel().rows
  const parentRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
  })

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Repositories</h3>
        <span className="pill">
          {typeof totalCount === 'number' && totalCount !== repos.length
            ? `${repos.length} shown / ${totalCount} total`
            : `${repos.length} total`}
        </span>
      </div>
      {repos.length ? (
        <div
          className="table-shell"
          style={
            {
              '--table-columns': gridTemplateColumns,
              '--table-min-width': `${minWidth}px`,
            } as CSSProperties
          }
        >
          <div className="table-head">
            {table.getHeaderGroups().map((headerGroup) => (
              <div className="table-row head" key={headerGroup.id} role="row">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sort = header.column.getIsSorted()
                  return (
                    <button
                      key={header.id}
                      type="button"
                      className={`table-cell header ${canSort ? 'sortable' : ''}`}
                      onClick={header.column.getToggleSortingHandler()}
                      aria-sort={
                        sort === 'asc'
                          ? 'ascending'
                          : sort === 'desc'
                            ? 'descending'
                            : 'none'
                      }
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort ? (
                        <span className="sort-indicator">
                          {sort === 'asc' ? '↑' : sort === 'desc' ? '↓' : '↕'}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="table-body" ref={parentRef}>
            <div
              className="table-virtual"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index]
                return (
                  <div
                    key={row.id}
                    className="table-row"
                    role="row"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div className="table-cell" role="cell" key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <p className="empty">No repositories loaded yet.</p>
      )}
    </section>
  )
}

export default RepoPanel
