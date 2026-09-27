import type { RuntimeSnapshot } from '../types.ts'
import { LoadingState, PageTitle, RuntimeBadge } from '../ui.tsx'

export function Agents({ runtime, pending = false }: { runtime: RuntimeSnapshot | null; pending?: boolean }) {
  if (pending) return <><PageTitle eyebrow="ORGANIZATION" title="Agent chain"/><LoadingState message="Reading runtime details..."/></>
  const profiles = runtime?.profiles.availability === 'available' ? runtime.profiles.data : []
  const lead = profiles.find((item) => item.name === 'default')
  const engineer = profiles.find((item) => item.name === 'leadengineer')
  const profileField = (value: string | undefined) => !runtime || runtime.profiles.availability === 'unavailable' ? 'Not Available' : value ?? 'Unknown'
  const openCodeVersion = !runtime || runtime.openCode.availability === 'unavailable' ? 'Not Available' : runtime.openCode.data ?? 'Unknown'
  const rows = [
    ['Lead Agent', 'Declarative role', profileField(lead?.name), profileField(lead?.model), runtime?.gateways.default],
    ['Lead Engineer', 'Declarative role', profileField(engineer?.name), profileField(engineer?.model), runtime?.gateways.leadEngineer],
    ['OpenCode', 'Declarative role', 'Unknown', openCodeVersion, undefined],
  ] as const
  const others = profiles.filter((profile) => !['default', 'leadengineer'].includes(profile.name))
  return <><PageTitle eyebrow="ORGANIZATION" title="Agent chain">Role labels are declared architecture. Runtime details below are independently discovered.</PageTitle><section className="chain">Lead Agent <i>→</i> Lead Engineer <i>→</i> OpenCode</section>
    <section className="agent-list">{rows.map(([role, label, profile, version, gateway]) => <article className="agent" key={role}><div><p className="eyebrow">{label}</p><h2>{role}</h2></div><dl><div><dt>Profile</dt><dd>{profile}</dd></div><div><dt>Model / version</dt><dd>{version}</dd></div><div><dt>Gateway</dt><dd>{gateway ? <RuntimeBadge source={gateway}/> : <span className="muted">No gateway (CLI tool)</span>}</dd></div></dl></article>)}</section>
    {others.length > 0 && <section className="data-list other-profiles"><p className="eyebrow">OTHER HERMES PROFILES</p>{others.map((profile) => <article key={profile.name}><div><h2>{profile.name}</h2><p>Not part of the declared chain.</p></div><dl><div><dt>Model</dt><dd>{profile.model}</dd></div></dl></article>)}</section>}
  </>
}
