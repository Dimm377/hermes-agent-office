import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CommandError, collectTaskBoard, systemRun } from './mission-control.js'

const temporaryPaths: string[] = []
const originalPath = process.env.PATH
const originalDelegatedContext = process.env.HERMES_DELEGATED_CHILD_CONTEXT

afterEach(async () => {
  if (originalPath === undefined) delete process.env.PATH
  else process.env.PATH = originalPath
  if (originalDelegatedContext === undefined) delete process.env.HERMES_DELEGATED_CHILD_CONTEXT
  else process.env.HERMES_DELEGATED_CHILD_CONTEXT = originalDelegatedContext
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function executable(source: string, name = 'fixture'): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ruang-task-runtime-'))
  temporaryPaths.push(directory)
  const file = join(directory, name)
  await writeFile(file, `#!/bin/sh\n${source}`)
  await chmod(file, 0o755)
  return file
}

describe('Kanban runtime integration', () => {
  it('uses the exact Hermes board-list arguments and returns the task-board API shape', async () => {
    const calls: [string, string[]][] = []
    const snapshot = await collectTaskBoard(async (file, args) => {
      calls.push([file, args])
      if (args.join(' ') === 'kanban boards list --json') return '[{"slug":"default","name":"Default","archived":false,"is_current":true,"total":1}]'
      return '[{"id":"t_1","title":"Ship it","status":"running"}]'
    })

    expect(calls).toEqual([
      ['hermes', ['kanban', 'boards', 'list', '--json']],
      ['hermes', ['kanban', '--board', 'default', 'list', '--json']],
    ])
    expect(snapshot).toMatchObject({
      tasks: { availability: 'available', data: [{ id: 't_1', title: 'Ship it', status: 'running', board: 'default' }] },
      boards: [{ slug: 'default', name: 'Default', current: true, total: 1 }],
    })
    expect(typeof snapshot.fetchedAt).toBe('string')
  })

  it('keeps valid JSON stdout when Hermes writes a warning to stderr', async () => {
    const command = await executable("printf '[{\\\"id\\\":\\\"t_1\\\",\\\"title\\\":\\\"Ship it\\\",\\\"status\\\":\\\"todo\\\"}]'\nprintf 'warning on stderr\\n' >&2\n")

    await expect(systemRun(command, [])).resolves.toBe('[{"id":"t_1","title":"Ship it","status":"todo"}]')
  })

  it('does not pass a delegated-worker mutation fence to fixed Hermes reads', async () => {
    const hermes = await executable("test -z \"$HERMES_DELEGATED_CHILD_CONTEXT\" || exit 17\nprintf '[]'\n", 'hermes')
    const directory = hermes.slice(0, hermes.lastIndexOf('/'))
    process.env.PATH = `${directory}:${originalPath ?? ''}`
    process.env.HERMES_DELEGATED_CHILD_CONTEXT = directory

    await expect(systemRun('hermes', ['kanban', 'list', '--json'])).resolves.toBe('[]')
  })

  it('turns a nonzero Hermes exit into a command failure', async () => {
    const command = await executable("printf 'kanban failed\\n' >&2\nexit 17\n")

    await expect(systemRun(command, [])).rejects.toEqual(expect.objectContaining<Partial<CommandError>>({ code: 'COMMAND_FAILED' }))
  })
})
