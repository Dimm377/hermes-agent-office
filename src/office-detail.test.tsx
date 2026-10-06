import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { OfficeDetail } from './pages/Office.tsx'
import { Agents } from './pages/Agents.tsx'
import type { OfficeStation, RuntimeSnapshot } from './types.ts'

describe('Agents display names', () => {
  it('shows the Hermes label while keeping the canonical profile id for identity', () => {
    const runtime: RuntimeSnapshot = {
      profiles: { availability: 'available', data: [
        { name: 'default', displayName: 'Lead Engineer', model: 'm', gateway: 'Running' },
        { name: 'personal-intelligence-team', model: 'm', gateway: 'Running' },
      ] },
      openCode: { availability: 'unavailable', data: '' }, fetchedAt: '2026-09-27T12:00:00.000Z',
    }
    const markup = renderToStaticMarkup(<Agents runtime={runtime}/>)
    expect(markup).toContain('<h2>Lead Engineer</h2>')
    expect(markup).toContain('<h2>personal-intelligence-team</h2>')
    expect(markup).not.toContain('<h2>default</h2>')
  })
})

describe('OfficeDetail', () => {
  it('renders a labelled in-page dialog with station metadata, evidence, and a close control', () => {
    const station: OfficeStation = {
      id: 'coder', name: 'coder', role: 'Hermes profile', room: 'Workspace', roomPosition: 'review-desk',
      state: 'Reviewing', currentTask: 'Review office behavior', recentActivity: 'No attributed recent activity',
      activity: 'Reviewing: Review office behavior', seat: 2, provenance: 'Gateway Running; explicit state records: none; Kanban: available; activity: available',
      freshness: 'Runtime 2026-09-27T12:00:00.000Z; Kanban 2026-09-27T12:00:00.000Z; activity 2026-09-27T12:00:00.000Z',
    }

    const markup = renderToStaticMarkup(<OfficeDetail station={station} onClose={vi.fn()}/>)

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-label="Close coder details"')
    expect(markup).toContain('Hermes profile')
    expect(markup).toContain('Current room')
    expect(markup).toContain('Workspace')
    expect(markup).toContain('Review office behavior')
    expect(markup).toContain('No attributed recent activity')
    expect(markup).toContain('Gateway Running')
    expect(markup).toContain('Runtime 2026-09-27T12:00:00.000Z')
  })
})

describe('Office characters', () => {
  it('renders CSS pixel character anatomy without printing avatar tokens', () => {
    const station: OfficeStation = {
      id: 'default', name: 'default', role: 'Hermes profile', room: 'Lounge', roomPosition: 'lounge-seat-1',
      state: 'Idle', currentTask: 'No attributed task', recentActivity: 'No attributed recent activity',
      activity: 'On a break', seat: 1, provenance: 'Ruang managed-idle placement policy', freshness: 'Runtime current',
    }

    const markup = renderToStaticMarkup(<OfficeDetail station={station} onClose={vi.fn()}/>)

    expect(markup).toContain('pixel-character')
    expect(markup).toContain('character-head')
    expect(markup).not.toContain('>LA<')
    expect(markup).not.toContain('>LE<')
    expect(markup).not.toContain('>OC<')
  })
})
