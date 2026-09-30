import { useState } from 'react'
import './App.css'

const MAX_TEXT_LENGTH = 50_000

const SENTENCE_OPTIONS = Array.from(
  { length: 20 },
  (_, index) => index + 1,
)

const EXAMPLE_TEXT = [
  'TextRank is a graph-based approach to text summarization.',
  'It represents sentences as nodes in a graph.',
  'Related sentences are connected using similarity scores.',
  'PageRank identifies important sentences within the graph.',
  'The selected sentences form an extractive summary.',
].join(' ')

export default function App() {
  const [text, setText] = useState('')
  const [sentenceCount, setSentenceCount] = useState(3)

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">EXTRACTIVE TEXT SUMMARIZATION</p>

        <h1>TextRank</h1>

        <p className="subtitle">
          Find the key sentences in your text without rewriting
          the original wording.
        </p>
      </header>

      <div className="workspace">
        <section className="panel" aria-labelledby="input-heading">
          <h2 id="input-heading">Original text</h2>

          <label htmlFor="source-text">
            Text to summarize
          </label>

          <textarea
            id="source-text"
            name="text"
            rows={12}
            maxLength={MAX_TEXT_LENGTH}
            placeholder="Paste an article, report, or set of notes..."
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-describedby="text-help"
          />

          <p id="text-help" className="field-note">
            {text.length.toLocaleString()} /{' '}
            {MAX_TEXT_LENGTH.toLocaleString()} characters
          </p>

          <label htmlFor="sentence-count">
            Maximum summary length
          </label>

          <select
            id="sentence-count"
            name="sentence_count"
            value={sentenceCount}
            onChange={(event) =>
              setSentenceCount(Number(event.target.value))
            }
          >
            {SENTENCE_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? 'sentence' : 'sentences'}
              </option>
            ))}
          </select>

          <div className="secondary-actions">
            <button
              type="button"
              onClick={() => setText(EXAMPLE_TEXT)}
            >
              Use example
            </button>

            <button
              type="button"
              onClick={() => setText('')}
              disabled={text.length === 0}
            >
              Clear text
            </button>
          </div>

          {/* Enable this after connecting the backend. */}
          <button
            type="button"
            className="primary-button"
            disabled
            aria-describedby="connection-note"
          >
            Generate summary
          </button>

          <p id="connection-note" className="field-note">
            Interface preview: the API is not connected yet.
            Your text is not submitted or saved.
          </p>
        </section>

        <section className="panel" aria-labelledby="summary-heading">
          <h2 id="summary-heading">Your summary</h2>

          <p className="empty-state">
            Your generated summary will appear here once
            the API connection is enabled.
          </p>
        </section>
      </div>
    </main>
  )
}