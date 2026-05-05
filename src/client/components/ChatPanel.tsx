import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { emitChatSend } from '../socket'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const { isDriver, chatMessages, users, mySocketId, driverId } = useStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const placeholder = isDriver()
    ? 'Send command to agent...'
    : 'Message teammates'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  function handleSend() {
    const content = input.trim()
    if (!content) return
    emitChatSend(content)
    setInput('')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 px-3 py-1.5 flex items-center justify-between">
        <span className="text-xs text-gray-500">Team Chat</span>
        <div className="flex items-center gap-1">
          {users.slice(0, 3).map((user) => {
            const isUserDriver = user.socketId === driverId
            const isMe = user.socketId === mySocketId
            const initials = user.name.slice(0, 2).toUpperCase()
            const title = isUserDriver ? `${user.name} (Driver)` : user.name
            return (
              <span
                key={user.socketId}
                title={title}
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white select-none',
                  isUserDriver ? 'bg-blue-600' : 'bg-gray-500',
                  isMe ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-200 dark:ring-offset-gray-800' : '',
                ].join(' ')}
              >
                {initials}
              </span>
            )
          })}
          {users.length > 3 && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 pl-0.5">
              +{users.length - 3}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {chatMessages.map((message) => {
          if (message.type === 'system') {
            return (
              <p key={message.id} className="text-center text-xs text-gray-400 dark:text-gray-500 py-1">
                {message.content}
              </p>
            )
          }

          const isOwn = message.senderId === mySocketId

          const bubbleColor = isOwn
            ? 'bg-blue-100 dark:bg-blue-900/40 text-gray-900 dark:text-gray-100'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'

          return (
            <div
              key={message.id}
              data-testid="message-bubble"
              className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex items-baseline gap-2 text-xs text-gray-500 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className="font-medium text-gray-700 dark:text-gray-300">{message.senderName}</span>
                <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`rounded-2xl px-3 py-1.5 text-sm max-w-[85%] ${bubbleColor}`}>
                <p>
                  {message.content}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2 border-t border-gray-300 dark:border-gray-700 p-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              handleSend()
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSend}
          className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </div>
  )
}
