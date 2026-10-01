import { useState } from 'react'

export default function SaveSummary({ result, onSavingChange }) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  async function handleSave() {
    if (status === 'saving' || status === 'saved') {
      return
    }

    setStatus('saving')
    setError('')
    onSavingChange(true)

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      controller.abort()
    }, 15_000)

    try {
      const response = await fetch('/api/summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_text: result.source_text,
          summary: result.summary,
          original_sentence_count: result.original_sentence_count,
          selected_sentence_count: result.selected_sentence_count,
        }),
        signal: controller.signal,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === 'string'
            ? data.detail
            : `Saving failed (HTTP ${response.status}).`,
        )
      }

      if (
        response.status !== 201 ||
        typeof data?.saved_summary?.id !== 'string' ||
        !data.saved_summary.id
      ) {
        throw new Error(
          'The API did not return a valid save confirmation.',
        )
      }

      setStatus('saved')
    } catch (failure) {
      setStatus('error')

      if (controller.signal.aborted) {
        setError('The save confirmation took too long.')
      } else if (failure instanceof TypeError) {
        setError('Could not reach the save API.')
      } else {
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not confirm that the summary was saved.',
        )
      }
    } finally {
      window.clearTimeout(timeoutId)
      onSavingChange(false)
    }
  }

  let buttonLabel = 'Save summary'

  if (status === 'saving') {
    buttonLabel = 'Saving…'
  } else if (status === 'saved') {
    buttonLabel = 'Saved'
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSave}
        disabled={status === 'saving' || status === 'saved'}
      >
        {buttonLabel}
      </button>

      {status === 'saved' && (
        <p className="field-note">
          Saved to your local database.
        </p>
      )}

      {error && (
        <div className="error-message" role="alert">
          <p>{error}</p>
          <p>
            Check saved history before retrying. A lost confirmation
            does not necessarily mean the record was not created.
          </p>
        </div>
      )}
    </div>
  )
}