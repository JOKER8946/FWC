/**
 * Splits raw text into overlapping chunks for keyword RAG retrieval.
 * @param {string} text       - Full extracted resume text
 * @param {number} chunkSize  - Max characters per chunk (default 600)
 * @param {number} overlap    - Overlap between consecutive chunks (default 100)
 * @returns {string[]} array of text chunks
 */
const chunkText = (text, chunkSize = 600, overlap = 100) => {
  // Normalize whitespace
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;

    // Don't cut mid-word — extend to next whitespace
    if (end < cleaned.length) {
      const nextSpace = cleaned.indexOf(' ', end);
      if (nextSpace !== -1 && nextSpace - end < 60) end = nextSpace;
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 40) chunks.push(chunk); // skip tiny remnants
    start = end - overlap;
  }

  return chunks;
};

module.exports = chunkText;
