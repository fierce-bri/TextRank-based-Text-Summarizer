"""Unit tests for the core TextRank summarization logic."""

import pytest

from app.summarizer import split_sentences, summarize_text


def test_split_sentences_normalizes_whitespace() -> None:
    """Sentence splitting should remove unnecessary whitespace."""

    text = (
        "First sentence.   "
        "Second sentence!\n"
        "Third sentence?"
    )

    assert split_sentences(text) == [
        "First sentence.",
        "Second sentence!",
        "Third sentence?",
    ]


def test_short_text_is_returned_without_truncation() -> None:
    """Text shorter than the requested limit should remain unchanged."""

    result = summarize_text(
        text="First sentence. Second sentence.",
        sentence_count=3,
    )

    assert result.summary == "First sentence. Second sentence."
    assert result.original_sentence_count == 2
    assert result.selected_sentence_count == 2


def test_summary_respects_requested_sentence_count() -> None:
    """The summarizer should return no more than the requested count."""

    text = (
        "Data pipelines move information between systems. "
        "Reliable pipelines validate incoming records. "
        "Monitoring helps teams detect failures quickly. "
        "Partitioning can improve processing performance. "
        "Clear documentation makes systems easier to maintain."
    )

    source_sentences = split_sentences(text)

    result = summarize_text(
        text=text,
        sentence_count=2,
    )

    summary_sentences = split_sentences(result.summary)

    assert result.original_sentence_count == 5
    assert result.selected_sentence_count == 2
    assert len(summary_sentences) == 2

    for sentence in summary_sentences:
        assert sentence in source_sentences


def test_summary_preserves_original_document_order() -> None:
    """Selected sentences should appear in their original order."""

    text = (
        "Python is commonly used for data processing. "
        "Data validation helps prevent incorrect results. "
        "Python also supports many machine learning libraries. "
        "Monitoring makes data systems easier to maintain."
    )

    source_sentences = split_sentences(text)

    result = summarize_text(
        text=text,
        sentence_count=2,
    )

    selected_positions = [
        source_sentences.index(sentence)
        for sentence in split_sentences(result.summary)
    ]

    assert selected_positions == sorted(selected_positions)


@pytest.mark.parametrize(
    "text",
    [
        "",
        "   ",
        "\n\t",
    ],
)
def test_empty_text_raises_value_error(text: str) -> None:
    """Empty or whitespace-only input should be rejected."""

    with pytest.raises(
        ValueError,
        match="text must contain at least one sentence",
    ):
        summarize_text(text)


@pytest.mark.parametrize(
    "sentence_count",
    [
        0,
        -1,
    ],
)
def test_invalid_sentence_count_raises_value_error(
    sentence_count: int,
) -> None:
    """A summary must request at least one sentence."""

    with pytest.raises(
        ValueError,
        match="sentence_count must be at least 1",
    ):
        summarize_text(
            text="A valid sentence.",
            sentence_count=sentence_count,
        )


@pytest.mark.parametrize(
    "similarity_threshold",
    [
        -0.01,
        1.01,
    ],
)
def test_invalid_similarity_threshold_raises_value_error(
    similarity_threshold: float,
) -> None:
    """Similarity thresholds must remain between zero and one."""

    with pytest.raises(
        ValueError,
        match=(
            "similarity_threshold must be between 0.0 and 1.0"
        ),
    ):
        summarize_text(
            text="A valid sentence.",
            similarity_threshold=similarity_threshold,
        )


def test_non_string_text_raises_type_error() -> None:
    """The core service should reject non-string input."""

    with pytest.raises(
        TypeError,
        match="text must be a string",
    ):
        summarize_text(123)  # type: ignore[arg-type]
