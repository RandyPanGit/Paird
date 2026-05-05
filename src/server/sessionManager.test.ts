import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../shared/types'
import { SessionManager } from './sessionManager'

function makeMessage(id: string, content: string): ChatMessage {
  return {
    id,
    senderId: 'socket-1',
    senderName: 'Alice',
    content,
    timestamp: new Date('2026-04-30T00:00:00.000Z'),
    type: 'user',
  }
}

describe('SessionManager', () => {
  it('stores chat history and trims to the latest 100 messages', () => {
    const session = new SessionManager()

    for (let index = 0; index < 101; index += 1) {
      session.addChatMessage(makeMessage(`m${index}`, `message ${index}`))
    }

    expect(session.getChatHistory()).toHaveLength(100)
    expect(session.getChatHistory()[0].id).toBe('m1')
    expect(session.getChatHistory()[99].id).toBe('m100')
  })

  it('passes driver to another socket id', () => {
    const session = new SessionManager()
    session.addUser('socket-1', 'Alice')
    session.addUser('socket-2', 'Bob')
    session.setDriver('socket-1')

    session.passDriverTo('socket-2')

    expect(session.getDriver()?.name).toBe('Bob')
    expect(session.getFullState().users.find(user => user.socketId === 'socket-1')?.isDriver).toBe(false)
  })

  it('finds users by exact name', () => {
    const session = new SessionManager()
    session.addUser('socket-1', 'Alice')
    session.addUser('socket-2', 'Bob')

    expect(session.findUsersByName('Bob').map(user => user.socketId)).toEqual(['socket-2'])
    expect(session.findUsersByName('alice')).toEqual([])
  })

  it('stores git status snapshots in the full session state', () => {
    const session = new SessionManager()
    const gitStatus = {
      branch: 'develop',
      modified: ['src/server/index.ts'],
      added: ['src/client/components/GitPanel.tsx'],
      deleted: [],
      lastUpdated: new Date('2026-04-30T10:00:00.000Z'),
    }

    session.setGitStatus(gitStatus)

    expect(session.getGitStatus()).toEqual(gitStatus)
    expect(session.getFullState().gitStatus).toEqual(gitStatus)
  })

})
