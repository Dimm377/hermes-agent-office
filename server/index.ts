import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express, { type NextFunction, type Request, type Response } from 'express'
import { excludedFor, FolderError, listFolder, publicAgent, readFolderFile, resolveAgentFolders } from './folders.js'
import { API_VERSION } from './api-version.js'
import { collectMemory } from './memory.js'
import { getActivity, getCalendar, getChannels, getCommandLog, getDashboard, getKnowledge, getLogs, getOffice, getSnapshot, getTaskBoard, getTaskDetail } from './mission-control.js'

const HOST = '127.0.0.1'
const PORT = Number(process.env.MISSION_CONTROL_PORT) || 3001
const distDirectory = fileURLToPath(new URL('../dist', import.meta.url))

const app = express()
app.disable('x-powered-by')
app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
})

const startedAt = new Date().toISOString()
app.get('/api/health', (_request, response) => { response.json({ ok: true, apiVersion: API_VERSION, startedAt }) })

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
app.get('/api/tasks/:id', async (request, response) => {
  const detail = await getTaskDetail(String(request.params.id))
  if (!detail) { response.status(404).json({ error: 'Unknown task.' }); return }
  response.json(detail)
})

// Folders: read-only view of each agent's own folder. Only agents Mission Control resolved
// (declared stations, Hermes-reported profiles, OpenCode) can be opened.
async function agentFolders() {
  const runtime = await getSnapshot()
  return resolveAgentFolders(runtime.profiles.data.map((profile) => profile.name))
}
async function openFolder(profile: string) {
  const folders = await agentFolders()
  const folder = folders.find((item) => item.profile === profile)
  if (!folder) throw new FolderError('Unknown agent.', 404)
  if (!folder.available) throw new FolderError(folder.reason ?? 'Folder not available.', 404)
  return { folder, excluded: excludedFor(folder, folders) }
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
app.get('/api/memory', folderRoute(async () => collectMemory(await agentFolders())))
app.get('/api/folders', folderRoute(async () => ({ agents: (await agentFolders()).map(publicAgent), fetchedAt: new Date().toISOString() })))
app.get('/api/folders/:profile/list', folderRoute(async (request) => {
  const { folder, excluded } = await openFolder(String(request.params.profile))
  return listFolder(folder, request.query.path, excluded)
}))
app.get('/api/folders/:profile/file', folderRoute(async (request) => {
  const { folder, excluded } = await openFolder(String(request.params.profile))
  return readFolderFile(folder, request.query.path, excluded)
}))

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
