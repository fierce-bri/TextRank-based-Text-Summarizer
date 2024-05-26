# TextRank-based-Text-Summarizer
An NLP project that uses the TextRank algorithm to automatically generate summaries of text documents.

In this project, we explore the application of the TextRank graph-based algorithm for
extractive text summarization. Text summarization plays a crucial role in condensing large
volumes of text into concise and informative summaries, aiding in information retrieval,
document understanding, and content summarization. The choice of the TextRank algorithm
is motivated by its effectiveness, simplicity, and ability to capture the salient information in a
text document by modelling the relationships between sentences as a graph.
We plan to utilize a dataset consisting of various types of text documents, including news
articles, research papers, and online reviews, to train and evaluate our model. We begin by
detailing the preprocessing steps, including sentence tokenization and the removal of stop
words and punctuation, which are essential for preparing the input text for summarization.
Next, we construct a graph representation of the document, where nodes correspond to
sentences and edges capture semantic similarity between sentences based on cosine
similarity of their vector representations.

For evaluation, we employ the BLEU metric, commonly used in machine translation tasks, to
assess the quality of the generated summaries. The decision to use BLEU is informed by its
simplicity, widespread adoption, and ability to measure the overlap between the generated
summary and human-authored reference summaries. Additionally, we compare the
performance of TextRank with other evaluation metrics such as ROUGE and METEOR,
highlighting the strengths and limitations of each metric in the context of extractive text
summarization.

Overall, this project contributes to the understanding of graph-based algorithms for
extractive text summarization.
