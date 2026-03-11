import assert from 'node:assert/strict'
import test from 'node:test'

import { sanitizeIncomingChatMessages } from './chat-message-sanitizer.ts'

test('sanitizeIncomingChatMessages keeps only user/assistant with non-empty string content', () => {
  const sanitized = sanitizeIncomingChatMessages([
    { role: 'user', content: ' hello ' },
    { role: 'assistant', content: 'world' },
    { role: 'system', content: 'ignore' },
    { role: 'user', content: '   ' },
    { role: 123, content: 'bad role' },
    { role: 'assistant', content: ['bad content'] },
  ])

  assert.deepEqual(sanitized, [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'world' },
  ])
})

test('sanitizeIncomingChatMessages returns empty list for non-array input', () => {
  assert.deepEqual(sanitizeIncomingChatMessages(null), [])
  assert.deepEqual(sanitizeIncomingChatMessages({ role: 'user', content: 'hello' }), [])
})
