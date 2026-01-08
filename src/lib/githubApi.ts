import type { RateLimitInfo } from '../types'

const buildHeaders = (token: string) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
})

const readRateLimit = (headers: Headers): RateLimitInfo | null => {
  const limit = Number(headers.get('x-ratelimit-limit'))
  const remaining = Number(headers.get('x-ratelimit-remaining'))
  const reset = Number(headers.get('x-ratelimit-reset'))
  const usedHeader = headers.get('x-ratelimit-used')
  const usedValue = usedHeader ? Number(usedHeader) : null

  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || !Number.isFinite(reset)) {
    return null
  }

  return {
    limit,
    remaining,
    reset,
    used: Number.isFinite(usedValue) ? usedValue : null,
  }
}

export const pickMoreConservativeRate = (
  current: RateLimitInfo | null,
  next: RateLimitInfo,
) => {
  if (!current) return next
  if (next.remaining < current.remaining) return next
  if (next.remaining === current.remaining && next.reset > current.reset) return next
  return current
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

const parseNextLink = (linkHeader: string | null): string | null => {
  if (!linkHeader) return null
  const parts = linkHeader.split(',')
  for (const part of parts) {
    const urlMatch = part.match(/<([^>]+)>/)
    const relMatch = part.match(/rel="([^"]+)"/)
    if (urlMatch && relMatch && relMatch[1] === 'next') {
      return urlMatch[1]
    }
  }
  return null
}

const getErrorMessage = (data: unknown, fallback: string): string => {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }
  return fallback
}

export const fetchJson = async <T,>(
  url: string,
  token: string,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<T> => {
  const response = await fetch(url, { headers: buildHeaders(token) })
  const rateLimit = readRateLimit(response.headers)
  if (rateLimit && onRateLimit) {
    onRateLimit(rateLimit)
  }
  const data = await readJson(response)
  if (!response.ok) {
    const message = getErrorMessage(data, `GitHub error ${response.status}`)
    throw new Error(message)
  }
  return data as T
}

export const fetchAllPages = async <T,>(
  url: string,
  token: string,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<T[]> => {
  const items: T[] = []
  let nextUrl = url
  while (nextUrl) {
    const response = await fetch(nextUrl, { headers: buildHeaders(token) })
    const rateLimit = readRateLimit(response.headers)
    if (rateLimit && onRateLimit) {
      onRateLimit(rateLimit)
    }
    const data = await readJson(response)
    if (!response.ok) {
      const message = getErrorMessage(data, `GitHub error ${response.status}`)
      throw new Error(message)
    }
    if (Array.isArray(data)) {
      items.push(...data)
    }
    nextUrl = parseNextLink(response.headers.get('link'))
  }
  return items
}
