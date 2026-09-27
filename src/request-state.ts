export type RequestState<T> =
  | { status: 'pending' }
  | { status: 'ready'; data: T; stale?: boolean }
  | { status: 'failed' }

export async function loadSnapshot<T>(path: string, request: typeof fetch = fetch): Promise<RequestState<T>> {
  try {
    const response = await request(path)
    if (!response.ok) return { status: 'failed' }
    return { status: 'ready', data: await response.json() as T }
  } catch {
    return { status: 'failed' }
  }
}

/** Keeps the last good data visible (marked stale) when a background refresh fails. */
export function mergeRefresh<T>(previous: RequestState<T>, next: RequestState<T>): RequestState<T> {
  if (next.status === 'failed' && previous.status === 'ready') return { ...previous, stale: true }
  return next
}
