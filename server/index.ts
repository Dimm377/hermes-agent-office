import express from 'express'
import { getActivity, getCalendar, getChannels, getKnowledge, getOffice, getSnapshot, getTaskBoard } from './mission-control.js'

const app = express()
app.get('/api/runtime', async (_request, response) => {
  response.json(await getSnapshot())
})
app.get('/api/tasks', async (_request, response) => {
  response.json(await getTaskBoard())
})
app.get('/api/calendar', async (_request, response) => {
  response.json(await getCalendar())
})
app.get('/api/activity', async (_request, response) => {
  response.json(await getActivity())
})
app.get('/api/knowledge', async (_request, response) => {
  response.json(await getKnowledge())
})
app.get('/api/office', async (_request, response) => {
  response.json(await getOffice())
})
app.get('/api/channels', async (_request, response) => {
  response.json(await getChannels())
})
app.listen(3001, '127.0.0.1', () => console.log('Mission Control API listening on http://127.0.0.1:3001'))
