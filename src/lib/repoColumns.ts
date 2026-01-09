import type { VisibilityState } from '@tanstack/react-table'

export const REPO_COLUMNS = [
  { key: 'name', label: 'Repository' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'language', label: 'Language' },
  { key: 'archived', label: 'Archived' },
  { key: 'updated', label: 'Updated' },
] as const

export type RepoColumnKey = (typeof REPO_COLUMNS)[number]['key']
export type RepoColumnVisibility = VisibilityState

export const DEFAULT_REPO_COLUMN_VISIBILITY: VisibilityState = {
  name: true,
  visibility: true,
  language: true,
  archived: true,
  updated: true,
}
