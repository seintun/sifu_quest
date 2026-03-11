import assert from 'node:assert/strict'
import test from 'node:test'

import { consumeChatStream } from './stream-parser.ts'

function readerFromChunks(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder()
  return readerFromByteChunks(chunks.map((chunk) => encoder.encode(chunk)))
}

function readerFromByteChunks(chunks: Uint8Array[]): ReadableStreamDefaultReader<Uint8Array> {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
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

test('consumeChatStream flushes a split multibyte codepoint from decoder buffer', async () => {
  const frames: Array<Record<string, unknown>> = []
  const payload = 'data: {"text":"🙂"}\n\n'
  const encoded = new TextEncoder().encode(payload)
  const multibyteStart = encoded.findIndex((byte) => byte >= 0x80)
  assert.ok(multibyteStart >= 0, 'Expected emoji bytes to exist in payload')

  const reader = readerFromByteChunks([
    encoded.slice(0, multibyteStart + 2),
    encoded.slice(multibyteStart + 2),
  ])

  await consumeChatStream(reader, (frame) => {
    frames.push(frame as Record<string, unknown>)
  })

  assert.equal(frames.length, 1)
  assert.deepEqual(frames[0], { text: '🙂' })
})
