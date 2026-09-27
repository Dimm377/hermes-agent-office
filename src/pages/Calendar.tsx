import { formatDateTime, statusTone } from '../format.ts'
import { usePolling } from '../polling.ts'
import type { CalendarSnapshot } from '../types.ts'
import { EmptyState, PageTitle, SourceStatus, Unavailable } from '../ui.tsx'

export function Calendar() {
  const snapshot = usePolling<CalendarSnapshot>('/api/calendar', 30_000)
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const jobs = data?.jobs
  const sorted = [...(jobs?.data ?? [])].sort((a, b) => (a.nextRun ?? '~').localeCompare(b.nextRun ?? '~'))
  return <><PageTitle eyebrow="HERMES CRON" title="Calendar">Scheduled Hermes cron jobs (including paused and completed). General calendar events are not inferred or displayed.</PageTitle>
    <SourceStatus source={jobs} fetchedAt={data?.fetchedAt} request={snapshot}/><Unavailable source={jobs} request={snapshot}/>
    {jobs?.availability === 'available' && (sorted.length === 0 ? <EmptyState title="No scheduled jobs">Hermes did not report any cron jobs. Create one with <code>hermes cron create</code>.</EmptyState> : <section className="data-list">{sorted.map((job) => <article key={job.id ?? `${job.name}-${job.schedule}`}>
      <div><h2>{job.name}</h2><p><code>{job.schedule}</code>{job.repeat && <> · repeat {job.repeat}</>}</p></div>
      <dl>
        {job.status && <div><dt>Status</dt><dd><span className={`badge ${statusTone(job.status)}`}>{job.status}</span></dd></div>}
        <div><dt>{job.overdue ? 'Overdue since' : 'Next run'}</dt><dd className={job.overdue ? 'text-bad' : ''}>{formatDateTime(job.nextRun)}</dd></div>
        {job.lastRun && <div><dt>Last run</dt><dd>{formatDateTime(job.lastRun)} <span className={`badge ${job.lastRunOk ? 'good' : 'bad'}`}>{job.lastRunOk ? 'ok' : 'failed'}</span></dd></div>}
      </dl>
    </article>)}</section>)}
  </>
}
