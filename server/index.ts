import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express, { type NextFunction, type Request, type Response } from 'express'
import { FolderError, folderAgents, listFolder, readFolderFile } from './folders.js'
import { getActivity, getCalendar, getChannels, getCommandLog, getDashboard, getKnowledge, getLogs, getOffice, getSnapshot, getTaskBoard } from './mission-control.js'

const HOST = '127.0.0.1'
const PORT = Number(process.env.MISSION_CONTROL_PORT) || 3001
const distDirectory = fileURLToPath(new URL('../dist', import.meta.url))

const app = express()
app.disable('x-powered-by')
app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
})

// `?fresh=1` (manual refresh) bypasses the 10s cache for anything older than 2s.
const FRESH_WINDOW_MS = 8_000
const routes: Record<string, (now: number) => Promise<unknown> | unknown> = {
  '/api/runtime': getSnapshot,
  '/api/dashboard': getDashboard,
  '/api/tasks': getTaskBoard,
  '/api/calendar': getCalendar,
  '/api/activity': getActivity,
  '/api/knowledge': getKnowledge,
  '/api/office': getOffice,
  '/api/channels': getChannels,
  '/api/logs': getLogs,
  '/api/command-log': () => getCommandLog(),
}
for (const [path, handler] of Object.entries(routes)) {
  app.get(path, async (request, response) => {
    const now = Date.now() + (request.query.fresh === '1' ? FRESH_WINDOW_MS : 0)
    response.json(await handler(now))
  })
}
// Folders: read-only view of each Hermes profile folder. Only profiles Hermes itself reports
// (plus the two declared stations) can be opened.
async function allowedProfiles(): Promise<string[]> {
  const runtime = await getSnapshot()
  return (await folderAgents(runtime.profiles.data.map((profile) => profile.name))).map((agent) => agent.profile)
}
async function checkedProfile(profile: string): Promise<string> {
  if (!(await allowedProfiles()).includes(profile)) throw new FolderError('Unknown profile.', 404)
  return profile
}
function folderRoute(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request, response: Response) => {
    try {
      response.json(await handler(request))
    } catch (error) {
      if (error instanceof FolderError) { response.status(error.status).json({ error: error.message }); return }
      throw error
    }
  }
}
app.get('/api/folders', folderRoute(async () => {
  const runtime = await getSnapshot()
  return { agents: await folderAgents(runtime.profiles.data.map((profile) => profile.name)), fetchedAt: new Date().toISOString() }
}))
app.get('/api/folders/:profile/list', folderRoute(async (request) => listFolder(await checkedProfile(String(request.params.profile)), request.query.path)))
app.get('/api/folders/:profile/file', folderRoute(async (request) => readFolderFile(await checkedProfile(String(request.params.profile)), request.query.path)))

app.use('/api', (_request, response) => { response.status(404).json({ error: 'Not found' }) })

if (existsSync(distDirectory)) {
  app.use(express.static(distDirectory))
  app.get(/^(?!\/api\/).*/, (_request, response) => { response.sendFile('index.html', { root: distDirectory }) })
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  void _next
  console.error('Mission Control request failed:', error instanceof Error ? error.message : error)
  response.status(500).json({ error: 'Internal error' })
})

app.listen(PORT, HOST, () => console.log(`Mission Control listening on http://${HOST}:${PORT}${existsSync(distDirectory) ? ' (serving built UI)' : ' (API only; run the Vite dev server for the UI)'}`))
