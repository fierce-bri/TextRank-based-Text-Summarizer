-- Initial schema for the local saved-summary feature.
BEGIN;

CREATE TABLE public.saved_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_text TEXT NOT NULL,
    summary TEXT NOT NULL,
    original_sentence_count INTEGER NOT NULL,
    selected_sentence_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT source_text_length
        CHECK (char_length(source_text) BETWEEN 1 AND 50000),

    CONSTRAINT summary_length
        CHECK (char_length(summary) BETWEEN 1 AND 50000),

    CONSTRAINT original_sentence_count_positive
        CHECK (original_sentence_count >= 1),

    CONSTRAINT selected_sentence_count_valid
        CHECK (
            selected_sentence_count BETWEEN 1 AND 20
            AND selected_sentence_count <= original_sentence_count
        )
);

CREATE INDEX saved_summaries_newest_idx
    ON public.saved_summaries (created_at DESC, id DESC);

COMMIT;