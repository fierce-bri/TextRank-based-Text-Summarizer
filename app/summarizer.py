"""Core TextRank extractive summarization logic."""

from __future__ import annotations

from dataclasses import dataclass
import re

import networkx as nx
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer


@dataclass(frozen=True)
class SummaryResult:
    """Result returned by the summarization service."""

    summary: str
    original_sentence_count: int
    selected_sentence_count: int


def split_sentences(text: str) -> list[str]:
    """
    Split input text into sentences.

    This lightweight splitter avoids downloading external language models,
    making the service easier to install and run.
    """

    normalized_text = re.sub(r"\s+", " ", text).strip()

    if not normalized_text:
        return []

    sentences = re.split(r"(?<=[.!?])\s+", normalized_text)

    return [
        sentence.strip()
        for sentence in sentences
        if sentence.strip()
    ]


def _select_by_tfidf_relevance(
    tfidf_matrix,
    sentence_count: int,
) -> list[int]:
    """
    Select sentences using their total TF-IDF relevance.

    This is used as a fallback when the similarity graph does not contain
    enough meaningful connections for PageRank.
    """

    relevance_scores = np.asarray(
        tfidf_matrix.sum(axis=1)
    ).reshape(-1)

    ranked_indices = np.argsort(relevance_scores)[::-1]

    selected_indices = ranked_indices[:sentence_count]

    return sorted(int(index) for index in selected_indices)


def summarize_text(
    text: str,
    sentence_count: int = 3,
    similarity_threshold: float = 0.05,
) -> SummaryResult:
    """
    Create an extractive summary using a TextRank-style algorithm.

    The algorithm:

    1. Splits the input into sentences.
    2. Converts sentences into TF-IDF vectors.
    3. Calculates sentence-to-sentence cosine similarity.
    4. Creates a weighted similarity graph.
    5. Uses PageRank to identify important sentences.
    6. Returns selected sentences in their original document order.

    Args:
        text:
            Source text to summarize.

        sentence_count:
            Maximum number of sentences to include in the summary.

        similarity_threshold:
            Minimum similarity required to create an edge between two
            sentence nodes.

    Returns:
        A SummaryResult containing the generated summary and metadata.

    Raises:
        TypeError:
            If text is not a string.

        ValueError:
            If the text is empty or configuration values are invalid.
    """

    if not isinstance(text, str):
        raise TypeError("text must be a string")

    if sentence_count < 1:
        raise ValueError("sentence_count must be at least 1")

    if not 0.0 <= similarity_threshold <= 1.0:
        raise ValueError(
            "similarity_threshold must be between 0.0 and 1.0"
        )

    sentences = split_sentences(text)

    if not sentences:
        raise ValueError("text must contain at least one sentence")

    original_sentence_count = len(sentences)

    if original_sentence_count <= sentence_count:
        return SummaryResult(
            summary=" ".join(sentences),
            original_sentence_count=original_sentence_count,
            selected_sentence_count=original_sentence_count,
        )

    try:
        vectorizer = TfidfVectorizer(stop_words="english")
        tfidf_matrix = vectorizer.fit_transform(sentences)

    except ValueError:
        # This can happen when the input contains only stop words or
        # punctuation. Returning the first sentences is safer than failing.
        selected_indices = list(range(sentence_count))

    else:
        similarity_matrix = (
            tfidf_matrix @ tfidf_matrix.T
        ).toarray()

        # A sentence should not be connected to itself.
        np.fill_diagonal(similarity_matrix, 0.0)

        # Remove weak sentence relationships.
        similarity_matrix[
            similarity_matrix < similarity_threshold
        ] = 0.0

        graph = nx.from_numpy_array(similarity_matrix)

        if graph.number_of_edges() == 0:
            selected_indices = _select_by_tfidf_relevance(
                tfidf_matrix,
                sentence_count,
            )

        else:
            try:
                page_rank_scores = nx.pagerank(
                    graph,
                    weight="weight",
                    max_iter=200,
                )

            except nx.PowerIterationFailedConvergence:
                selected_indices = _select_by_tfidf_relevance(
                    tfidf_matrix,
                    sentence_count,
                )

            else:
                ranked_indices = sorted(
                    page_rank_scores,
                    key=page_rank_scores.get,
                    reverse=True,
                )

                # Restore document order so the summary reads naturally.
                selected_indices = sorted(
                    ranked_indices[:sentence_count]
                )

    summary = " ".join(
        sentences[index]
        for index in selected_indices
    )

    return SummaryResult(
        summary=summary,
        original_sentence_count=original_sentence_count,
        selected_sentence_count=len(selected_indices),
    )
