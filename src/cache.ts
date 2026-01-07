import type { CachePayload } from './types'

const DB_NAME = 'github-access-cache'
const DB_VERSION = 1
const STORE_NAME = 'state'
const CACHE_KEY = 'payload'

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const isCachePayload = (value: unknown): value is CachePayload => {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<CachePayload>
  return Array.isArray(record.orgs) && Array.isArray(record.repos)
}

export const readCache = async (): Promise<CachePayload | null> => {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(CACHE_KEY)
    request.onsuccess = () => {
      const value = request.result
      if (!isCachePayload(value)) {
        resolve(null)
      } else {
        resolve({
          profile: value.profile ?? null,
          orgs: value.orgs ?? [],
          repos: value.repos ?? [],
          lastUpdated: value.lastUpdated ?? '',
          rateLimit: value.rateLimit ?? null,
        })
      }
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
  })
}

export const writeCache = async (payload: CachePayload): Promise<void> => {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(payload, CACHE_KEY)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}
