import { describe, expect, it, vi } from 'vitest'
import { loadSnapshot } from './request-state.ts'

describe('loadSnapshot', () => {
  it('returns failed when a request rejects or responds non-OK', async () => {
    const rejected = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))
    const nonOk = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }))

    await expect(loadSnapshot('/api/tasks', rejected)).resolves.toEqual({ status: 'failed' })
    await expect(loadSnapshot('/api/tasks', nonOk)).resolves.toEqual({ status: 'failed' })
  })
})
