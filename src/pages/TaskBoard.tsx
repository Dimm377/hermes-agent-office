import { useState } from 'react'
import { orderedStatuses, statusTone } from '../format.ts'
import { usePolling } from '../polling.ts'
import type { TaskBoardSnapshot } from '../types.ts'
import { EmptyState, PageTitle, SearchInput, SourceStatus, Unavailable } from '../ui.tsx'

const UNASSIGNED = '(unassigned)'

export function TaskBoard() {
  const snapshot = usePolling<TaskBoardSnapshot>('/api/tasks', 10_000)
  const [query, setQuery] = useState('')
  const [assignee, setAssignee] = useState('all')
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const tasks = data?.tasks
  const all = tasks?.data ?? []
  const assignees = [...new Set(all.map((task) => task.assignee ?? UNASSIGNED))].sort()
  const needle = query.trim().toLowerCase()
  const visible = all.filter((task) => (assignee === 'all' || (task.assignee ?? UNASSIGNED) === assignee) && (!needle || `${task.title} ${task.id ?? ''} ${task.assignee ?? ''}`.toLowerCase().includes(needle)))
  const columns = orderedStatuses(all.map((task) => task.status), true)
  return <><PageTitle eyebrow="HERMES KANBAN" title="Task board">Live, read-only view of <code>hermes kanban list</code>. Columns follow the Hermes board order; the board refreshes every 10 seconds.</PageTitle>
    <SourceStatus source={tasks} fetchedAt={data?.fetchedAt} request={snapshot}/><Unavailable source={tasks} request={snapshot}/>
    {tasks?.availability === 'available' && (all.length === 0 ? <EmptyState title="No tasks">Hermes returned an empty Kanban task list. Create one with <code>hermes kanban create</code>.</EmptyState> : <>
      <div className="toolbar"><SearchInput value={query} onChange={setQuery} label="Search tasks"/><label className="select-label">Assignee <select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="all">All ({all.length})</option>{assignees.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><span className="toolbar-count">{visible.length} shown</span></div>
      <section className="board" aria-label="Kanban board">{columns.map((status) => {
        const items = visible.filter((task) => task.status === status).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
        return <article key={status} className={`column tone-border-${statusTone(status)}`} aria-label={`${status} column`}><header className="column-head"><p className="eyebrow">{status}</p><span className="column-count">{items.length}</span></header>
          {items.length === 0 ? <p className="column-empty">—</p> : items.map((task) => <div className="task" key={`${task.status}-${task.id ?? task.title}`}><strong>{task.title}</strong><div className="task-meta">{task.id && <small>{task.id}</small>}<span className={`chip ${task.assignee ? '' : 'chip-muted'}`}>{task.assignee ?? 'unassigned'}</span>{task.priority ? <span className="chip chip-priority">P{task.priority}</span> : null}</div></div>)}
        </article>
      })}</section>
    </>)}
  </>
}
