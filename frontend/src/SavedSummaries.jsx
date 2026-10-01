import { useEffect, useRef, useState } from 'react'
import './SavedSummaries.css'

function isValidSummary(item) {
  return (
    typeof item?.id === 'string' &&
    item.id.length > 0 &&
    typeof item.summary === 'string' &&
    item.summary.trim().length > 0 &&
    Number.isInteger(item.original_sentence_count) &&
    item.original_sentence_count >= 1 &&
    Number.isInteger(item.selected_sentence_count) &&
    item.selected_sentence_count >= 1 &&
    item.selected_sentence_count <= 20 &&
    item.selected_sentence_count <= item.original_sentence_count &&
    typeof item.created_at === 'string' &&
    Number.isFinite(Date.parse(item.created_at))
  )
}

export default function SavedSummaries() {
  const [summaries, setSummaries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshCount, setRefreshCount] = useState(0)

  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [notice, setNotice] = useState('')

  // Track the current deletion request independently of rendering.
  const deleteRequest = useRef(null)

  // Cancel an outstanding request if this component is removed.
  useEffect(() => {
    return () => {
      deleteRequest.current?.abort()
      deleteRequest.current = null
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    const timeoutId = window.setTimeout(() => {
      controller.abort()
    }, 15_000)

    async function loadHistory() {
      try {
        const response = await fetch('/api/summaries', {
          signal: controller.signal,
          cache: 'no-store',
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            typeof data?.detail === 'string'
              ? data.detail
              : `Could not load history (HTTP ${response.status}).`,
          )
        }

        if (
          !Array.isArray(data?.summaries) ||
          !data.summaries.every(isValidSummary)
        ) {
          throw new Error(
            'The API returned an unexpected history response.',
          )
        }

        if (active) {
          setSummaries(data.summaries)
        }
      } catch (failure) {
        if (!active) return

        if (controller.signal.aborted) {
          setError(
            'Loading history took too long. Try Refresh history.',
          )
        } else if (failure instanceof TypeError) {
          setError(
            'Could not reach the history API. Check the Node server.',
          )
        } else {
          setError(
            failure instanceof Error
              ? failure.message
              : 'Could not load saved summaries.',
          )
        }
      } finally {
        window.clearTimeout(timeoutId)
        if (active) setIsLoading(false)
      }
    }

    loadHistory()

    // Ignore stale responses and cancel this request on cleanup.
    return () => {
      active = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [refreshCount])

  function refreshHistory() {
    if (isLoading || deleteRequest.current) return

    setIsLoading(true)
    setError('')
    setDeleteError('')
    setNotice('')
    setRefreshCount((count) => count + 1)
  }

  async function handleDelete(item) {
    if (isLoading || deleteRequest.current) return

    const confirmed = window.confirm(
      'Delete this saved summary and its stored source text?\n\n' +
        item.summary.slice(0, 120) +
        '\n\nThis cannot be undone in the app.',
    )

    // Cancelling must not send a deletion request.
    if (!confirmed) return

    const controller = new AbortController()
    deleteRequest.current = controller

    setDeletingId(item.id)
    setDeleteError('')
    setNotice('')

    const timeoutId = window.setTimeout(() => {
      controller.abort()
    }, 15_000)

    try {
      const response = await fetch(
        `/api/summaries/${encodeURIComponent(item.id)}`,
        {
          method: 'DELETE',
          signal: controller.signal,
        },
      )

      let message = 'Saved summary deleted.'

      // A successful 204 response has no JSON body to parse.
      if (response.status !== 204) {
        const data = await response.json().catch(() => null)

        if (
          response.status === 404 &&
          data?.detail === 'Saved summary not found.'
        ) {
          // For example, the record was deleted in another browser tab.
          message = 'That summary was already absent. List updated.'
        } else {
          throw new Error(
            typeof data?.detail === 'string'
              ? data.detail
              : `Unexpected deletion response (HTTP ${response.status}).`,
          )
        }
      }

      if (deleteRequest.current !== controller) return

      // Update the visible list only after confirmation from the API.
      setSummaries((current) =>
        current.filter((summary) => summary.id !== item.id),
      )
      setNotice(message)
    } catch (failure) {
      if (deleteRequest.current !== controller) return

      if (controller.signal.aborted) {
        setDeleteError('The deletion confirmation took too long.')
      } else if (failure instanceof TypeError) {
        setDeleteError('Could not reach the deletion API.')
      } else {
        setDeleteError(
          failure instanceof Error
            ? failure.message
            : 'Could not confirm deletion.',
        )
      }
    } finally {
      window.clearTimeout(timeoutId)

      if (deleteRequest.current === controller) {
        deleteRequest.current = null
        setDeletingId(null)
      }
    }
  }

  return (
    <section
      className="panel history-panel"
      aria-labelledby="history-heading"
    >
      <div className="history-toolbar">
        <h2 id="history-heading">Saved summaries</h2>

        <button
          type="button"
          onClick={refreshHistory}
          disabled={isLoading || deletingId !== null}
        >
          {isLoading ? 'Loading…' : 'Refresh history'}
        </button>
      </div>

      <p className="field-note">
        Up to 20 newest saves. Use Refresh history to reload the list.
        Deleting a save also removes its stored source text.
      </p>

      {isLoading && (
        <p className="field-note" role="status">
          Loading saved summaries…
        </p>
      )}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {notice && (
        <p className="field-note" role="status">
          {notice}
        </p>
      )}

      {deleteError && (
        <div className="error-message" role="alert">
          <p>{deleteError}</p>
          <p>
            Refresh history before retrying. A lost confirmation
            does not necessarily mean deletion failed.
          </p>
        </div>
      )}

      {!isLoading && !error && summaries.length === 0 && (
        <p className="field-note" role="status">
          No saved summaries yet. Generate one, save it,
          then refresh history.
        </p>
      )}

      {!isLoading && !error && summaries.length > 0 && (
        <ul className="history-list">
          {summaries.map((item) => (
            <li key={item.id} className="history-item">
              <p className="field-note">
                <time dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleString()}
                </time>
                {' · '}
                Selected {item.selected_sentence_count} of{' '}
                {item.original_sentence_count} sentences.
              </p>

              <p className="summary-text">
                {item.summary.length > 240
                  ? `${item.summary.slice(0, 240)}…`
                  : item.summary}
              </p>

              {item.summary.length > 240 && (
                <details>
                  <summary>Read full summary</summary>
                  <p className="summary-text">{item.summary}</p>
                </details>
              )}

              <div className="secondary-actions">
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={deletingId !== null}
                  aria-label={`Delete summary saved ${new Date(
                    item.created_at,
                  ).toLocaleString()}`}
                >
                  {deletingId === item.id
                    ? 'Deleting…'
                    : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}