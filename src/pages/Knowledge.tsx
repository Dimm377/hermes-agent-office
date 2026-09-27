import { useState } from 'react'
import { usePolling } from '../polling.ts'
import type { KnowledgeSnapshot } from '../types.ts'
import { EmptyState, PageTitle, SearchInput, SourceStatus, Unavailable } from '../ui.tsx'

export function Knowledge() {
  const snapshot = usePolling<KnowledgeSnapshot>('/api/knowledge', 60_000)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const skills = data?.skills
  const all = skills?.data ?? []
  const categories = [...new Set(all.map((skill) => skill.category || 'uncategorized'))].sort()
  const needle = query.trim().toLowerCase()
  const visible = all.filter((skill) => (category === 'all' || (skill.category || 'uncategorized') === category) && (!needle || `${skill.name} ${skill.category} ${skill.source}`.toLowerCase().includes(needle)))
  return <><PageTitle eyebrow="HERMES SKILLS" title="Knowledge">A read-only catalog of enabled Hermes skills, limited to fields recognizable in the CLI table.</PageTitle>
    <SourceStatus source={skills} fetchedAt={data?.fetchedAt} request={snapshot}/><Unavailable source={skills} request={snapshot}/>
    {skills?.availability === 'available' && (all.length === 0 ? <EmptyState title="No enabled skills">Hermes did not return any enabled skill rows.</EmptyState> : <>
      <div className="toolbar"><SearchInput value={query} onChange={setQuery} label="Search skills"/><span className="toolbar-count">{visible.length} of {all.length}</span></div>
      <div className="chip-row" role="group" aria-label="Filter by category">{['all', ...categories].map((item) => <button type="button" key={item} className={`chip chip-button ${category === item ? 'active' : ''}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}{item !== 'all' && ` · ${all.filter((skill) => (skill.category || 'uncategorized') === item).length}`}</button>)}</div>
      <section className="skill-grid">{visible.map((skill) => <article key={skill.name}><p className="eyebrow">{skill.category || 'UNCATEGORIZED'}</p><h2>{skill.name}</h2><dl><div><dt>Source</dt><dd>{skill.source}</dd></div><div><dt>Trust</dt><dd>{skill.trust}</dd></div><div><dt>Status</dt><dd>{skill.status}</dd></div></dl></article>)}</section>
    </>)}
  </>
}
