import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Agents, Dashboard, Office } from './App.tsx'

describe('pending application views', () => {
  it('renders loading instead of runtime placeholders on Dashboard and Agents', () => {
    const dashboard = renderToStaticMarkup(<Dashboard runtime={null} pending/>)
    const agents = renderToStaticMarkup(<Agents runtime={null} pending/>)

    for (const markup of [dashboard, agents]) {
      expect(markup).toContain('Loading')
      expect(markup).not.toContain('Not Available')
      expect(markup).not.toContain('Unknown')
    }
  })

  it('renders loading instead of an empty room or zero crew summary while Office is pending', () => {
    const markup = renderToStaticMarkup(<Office/>)

    expect(markup).toContain('Loading')
    expect(markup).not.toContain('0 active work')
    expect(markup).not.toContain('No declared idle presence')
  })
})
