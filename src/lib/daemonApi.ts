import { GIT_DAEMON_API, GIT_DAEMON_TOKEN } from '../config'
import type { HealthcheckStatus, RepoHealthchecks } from '../types'

type HealthcheckRunResponse = {
  jobId: string
}

type HealthcheckRunResult = {
  status?: HealthcheckStatus
  summary?: string
  finishedAt?: string
}

const isHealthcheckStatus = (value: unknown): value is HealthcheckStatus => {
  return (
    value === 'na' ||
    value === 'failed' ||
    value === 'pass-partial' ||
    value === 'pass-full'
  )
}

const buildHeaders = (withJson: boolean) => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (withJson) {
    headers['Content-Type'] = 'application/json'
  }
  if (GIT_DAEMON_TOKEN) {
    headers.Authorization = `Bearer ${GIT_DAEMON_TOKEN}`
  }
  return headers
}

const readJson = async (response: Response): Promise<unknown | null> => {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const parseHealthcheckRunResponse = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null
  const record = data as HealthcheckRunResponse
  return typeof record.jobId === 'string' ? record.jobId : null
}

const parseHealthcheckResult = (data: unknown): RepoHealthchecks | null => {
  if (!data || typeof data !== 'object') return null
  const record = data as HealthcheckRunResult
  if (!isHealthcheckStatus(record.status)) return null
  return {
    status: record.status,
    summary: typeof record.summary === 'string' ? record.summary : null,
    finishedAt: typeof record.finishedAt === 'string' ? record.finishedAt : null,
  }
}

export const checkDaemonAvailable = async (signal?: AbortSignal) => {
  try {
    const response = await fetch(`${GIT_DAEMON_API}/v1/meta`, {
      headers: { Accept: 'application/json' },
      signal,
    })
    return response.ok
  } catch {
    return false
  }
}

export const startHealthcheckRun = async (
  repoPath: string,
  signal?: AbortSignal,
): Promise<string | null> => {
  if (!GIT_DAEMON_TOKEN) return null
  const response = await fetch(`${GIT_DAEMON_API}/v1/healthchecks/run`, {
    method: 'POST',
    headers: buildHeaders(true),
    body: JSON.stringify({ repoPath }),
    signal,
  })
  if (!response.ok) return null
  const data = await readJson(response)
  return parseHealthcheckRunResponse(data)
}

export const waitForHealthcheckResult = async (
  jobId: string,
  options: { signal?: AbortSignal; timeoutMs?: number; intervalMs?: number } = {},
): Promise<RepoHealthchecks | null> => {
  const { signal, timeoutMs = 12_000, intervalMs = 900 } = options
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (signal?.aborted) return null
    const response = await fetch(
      `${GIT_DAEMON_API}/v1/healthchecks/jobs/${jobId}/result`,
      {
        headers: buildHeaders(false),
        signal,
      },
    )
    if (response.status === 409) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      continue
    }
    if (!response.ok) return null
    const data = await readJson(response)
    return parseHealthcheckResult(data)
  }

  return null
}
