export type RequestState<T> =
  | { status: 'pending' }
  | { status: 'ready'; data: T }
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
