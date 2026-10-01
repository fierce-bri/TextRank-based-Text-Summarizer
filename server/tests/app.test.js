import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createApp } from '../src/app.js'

const INPUT = {
  source_text: "A writer's note. Another sentence.",
  summary: "A writer's note.",
  original_sentence_count: 2,
  selected_sentence_count: 1,
}

const SAVED = {
  id: '11111111-1111-4111-8111-111111111111',
  summary: INPUT.summary,
  original_sentence_count: 2,
  selected_sentence_count: 1,
  created_at: '2026-10-01T12:00:00.000Z',
}

function jsonPost(body) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

// Run the real Express routes with fake external dependencies.
async function startApi(t, { query, upstream } = {}) {
  const queries = []
  const upstreamCalls = []

  const app = createApp({
    pool: {
      async query(sql, values) {
        queries.push({ sql, values })
        if (!query) throw new Error('Unexpected database call in test.')
        return query(sql, values)
      },
    },
    fetch: async (url, options) => {
      upstreamCalls.push({ url, options })
      if (!upstream) throw new Error('Unexpected Python call in test.')
      return upstream(url, options)
    },
  })

  // Port 0 asks the OS for a free port, not your development port.
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')

  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
    server.closeAllConnections()
  }))

  const baseUrl = `http://127.0.0.1:${server.address().port}`

  return {
    queries,
    upstreamCalls,
    request(path, options = {}) {
      return globalThis.fetch(`${baseUrl}${path}`, {
        ...options,
        signal: AbortSignal.timeout(5_000),
      })
    },
  }
}

test('health responds without using the database or Python', async (t) => {
  const api = await startApi(t)
  const response = await api.request('/api/health')

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'textrank-web-api',
  })
  assert.equal(api.queries.length, 0)
  assert.equal(api.upstreamCalls.length, 0)
})

test('summarization forwards the input and returns the result', async (t) => {
  const result = {
    summary: INPUT.summary,
    original_sentence_count: 2,
    selected_sentence_count: 1,
  }
  const api = await startApi(t, {
    upstream: async () => Response.json(result),
  })
  const payload = { text: INPUT.source_text, sentence_count: 1 }
  const response = await api.request('/api/summarize', jsonPost(payload))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), result)
  assert.equal(api.upstreamCalls.length, 1)
  assert.equal(api.upstreamCalls[0].url, 'http://127.0.0.1:8000/summarize')
  assert.equal(api.upstreamCalls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(api.upstreamCalls[0].options.body), payload)
  assert.equal(api.queries.length, 0)
})

test('malformed JSON is rejected before a database query', async (t) => {
  const api = await startApi(t)
  const response = await api.request('/api/summaries', {
    ...jsonPost({}),
    body: '{invalid',
  })

  assert.equal(response.status, 400)
  assert.equal((await response.json()).detail, 'Request body is not valid JSON.')
  assert.equal(api.queries.length, 0)
})

test('saving requires the JSON content type', async (t) => {
  const api = await startApi(t)
  const response = await api.request('/api/summaries', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'plain text',
  })

  assert.equal(response.status, 415)
  assert.equal((await response.json()).detail, 'Content-Type must be application/json.')
  assert.equal(api.queries.length, 0)
})

test('invalid save payloads never reach the database', async (t) => {
  const api = await startApi(t)
  const invalidInputs = [
    null,
    [],
    {},
    { ...INPUT, extra_field: true },
    { ...INPUT, source_text: '   ' },
    { ...INPUT, summary: 123 },
    { ...INPUT, summary: 'a'.repeat(50_001) },
    { ...INPUT, source_text: 'bad\u0000text' },
    { ...INPUT, original_sentence_count: 0 },
    { ...INPUT, selected_sentence_count: 3 },
    { ...INPUT, selected_sentence_count: 1.5 },
    { ...INPUT, selected_sentence_count: 21 },
  ]

  for (const [index, body] of invalidInputs.entries()) {
    const response = await api.request('/api/summaries', jsonPost(body))
    assert.equal(response.status, 422, `Invalid input case ${index + 1}`)
    assert.equal(typeof (await response.json()).detail, 'string')
  }

  assert.equal(api.queries.length, 0)
})

test('saving passes text as SQL parameters and returns 201', async (t) => {
  const api = await startApi(t, {
    query: async () => ({ rows: [SAVED], rowCount: 1 }),
  })
  const response = await api.request('/api/summaries', jsonPost(INPUT))

  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { saved_summary: SAVED })
  assert.equal(api.queries.length, 1)
  assert.match(api.queries[0].sql, /VALUES\s*\(\$1,\s*\$2,\s*\$3,\s*\$4\)/)
  assert.deepEqual(api.queries[0].values, [
    INPUT.source_text, INPUT.summary, 2, 1,
  ])
  assert.equal(api.queries[0].sql.includes(INPUT.source_text), false)
})

test('history returns empty and populated database results', async (t) => {
  for (const rows of [[], [SAVED]]) {
    const api = await startApi(t, { query: async () => ({ rows }) })
    const response = await api.request('/api/summaries')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { summaries: rows })
    assert.equal(api.queries.length, 1)
  }
})

test('an invalid deletion ID never reaches the database', async (t) => {
  const api = await startApi(t)
  const response = await api.request('/api/summaries/not-a-uuid', {
    method: 'DELETE',
  })

  assert.equal(response.status, 400)
  assert.equal((await response.json()).detail, 'Summary ID must be a valid UUID.')
  assert.equal(api.queries.length, 0)
})

test('deleting an existing ID returns 204 with no body', async (t) => {
  const api = await startApi(t, {
    query: async () => ({ rowCount: 1 }),
  })
  const response = await api.request(`/api/summaries/${SAVED.id}`, {
    method: 'DELETE',
  })

  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
  assert.equal(api.queries.length, 1)
  assert.match(api.queries[0].sql, /WHERE id = \$1::uuid/)
  assert.deepEqual(api.queries[0].values, [SAVED.id])
})

test('deleting a missing ID returns 404', async (t) => {
  const api = await startApi(t, {
    query: async () => ({ rowCount: 0 }),
  })
  const response = await api.request(`/api/summaries/${SAVED.id}`, {
    method: 'DELETE',
  })

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), {
    detail: 'Saved summary not found.',
  })
})

test('database failures return a safe error message', async (t) => {
  // Silence the expected server log for this deliberately simulated failure.
  t.mock.method(console, 'error', () => {})
  const api = await startApi(t, {
    query: async () => { throw new Error('Internal database detail') },
  })
  const response = await api.request('/api/summaries')

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), {
    detail: 'Could not load saved summaries. Please try again.',
  })
})

test('an unavailable Python service returns 502', async (t) => {
  t.mock.method(console, 'error', () => {})
  const api = await startApi(t, {
    upstream: async () => { throw new TypeError('Simulated connection failure') },
  })
  const response = await api.request('/api/summarize', jsonPost({
    text: INPUT.source_text,
    sentence_count: 1,
  }))

  assert.equal(response.status, 502)
  assert.deepEqual(await response.json(), {
    detail: 'The Python summarizer is unavailable or returned invalid JSON.',
  })
})