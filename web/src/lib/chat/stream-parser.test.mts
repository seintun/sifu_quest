import assert from 'node:assert/strict'
import test from 'node:test'

import { consumeChatStream } from './stream-parser.ts'

function readerFromChunks(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
  return stream.getReader()
}

test('consumeChatStream parses valid SSE frames and ignores malformed chunks', async () => {
  const frames: Array<Record<string, unknown>> = []
  const reader = readerFromChunks([
    'data: {"text":"Hel',
    'lo"}\n\n',
    'data: not-json\n\n',
    'data: {"type":"status","status":"thinking"}\n\n',
    'data: [DONE]\n\n',
  ])

  await consumeChatStream(reader, (frame) => {
    frames.push(frame as Record<string, unknown>)
  })

  assert.equal(frames.length, 2)
  assert.deepEqual(frames[0], { text: 'Hello' })
  assert.deepEqual(frames[1], { type: 'status', status: 'thinking' })
})
