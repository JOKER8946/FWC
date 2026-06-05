const RagChunk = require('../models/RagChunk');
const PolicyDocument = require('../models/PolicyDocument');
const { generateContent } = require('../services/geminiService');

// ─────────────────────────────────────────────────────────────────────────────
// Keyword RAG retrieval from active policy documents
// Uses MongoDB $text index on RagChunk.content
// ─────────────────────────────────────────────────────────────────────────────
const retrievePolicyChunks = async (question, topK = 6) => {
  // Get all active document IDs
  const activeDocs = await PolicyDocument.find({ isActive: true, chunkingStatus: 'completed' })
    .select('_id title').lean();

  if (!activeDocs.length) return { chunks: [], docMap: {} };

  const activeIds = activeDocs.map(d => d._id);
  const docMap = Object.fromEntries(activeDocs.map(d => [d._id.toString(), d.title]));

  // Build keyword query from question
  const keywords = question
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)  // strip short words like "is", "the"
    .join(' ');

  let chunks = [];

  if (keywords.trim()) {
    chunks = await RagChunk.find(
      { documentId: { $in: activeIds }, $text: { $search: keywords } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(topK)
      .lean();
  }

  // Fallback: if no text match, grab first chunks from each active doc
  if (chunks.length < 3) {
    const fallback = await RagChunk.find({
      documentId: { $in: activeIds },
      chunkIndex: { $lte: 3 },
    })
      .limit(topK)
      .lean();

    const seen = new Set(chunks.map(c => c._id.toString()));
    fallback.forEach(c => { if (!seen.has(c._id.toString())) chunks.push(c); });
  }

  return { chunks: chunks.slice(0, topK), docMap };
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Answer a policy question using RAG + Gemini
// @route   POST /api/policy/ask
// @access  All authenticated users
// ─────────────────────────────────────────────────────────────────────────────
const askBot = async (req, res) => {
  try {
    const { question, conversationHistory = [] } = req.body;

    if (!question || question.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Please provide a valid question.' });
    }

    // ── 1. Retrieve relevant policy chunks via keyword RAG ────────────────────
    const { chunks, docMap } = await retrievePolicyChunks(question.trim());

    if (!chunks.length) {
      return res.status(200).json({
        success: true,
        answer: "I couldn't find any active policy documents to answer your question. Please ask your HR administrator to upload the company policy handbook.",
        sources: [],
        chunksUsed: 0,
      });
    }

    // ── 2. Build context from retrieved chunks ────────────────────────────────
    const context = chunks
      .map((c, i) => {
        const docTitle = docMap[c.documentId?.toString()] || 'Company Policy';
        return `[Source ${i + 1} — ${docTitle}]\n${c.content}`;
      })
      .join('\n\n---\n\n');

    // ── 3. Build conversation history string ──────────────────────────────────
    const historyStr = conversationHistory
      .slice(-6) // last 3 exchanges
      .map(m => `${m.role === 'user' ? 'Employee' : 'HR Assistant'}: ${m.content}`)
      .join('\n');

    // ── 4. Prompt Gemini ──────────────────────────────────────────────────────
    const prompt = `
You are a helpful, friendly HR Policy Assistant for FWC IT Services Pvt. Ltd.
Your job is to answer employee questions accurately based ONLY on the provided company policy documents.

Rules:
- Answer ONLY from the provided policy context. Do not make up policies.
- If the answer is not in the context, say "This isn't covered in the current policy documents. Please contact HR directly."
- Be concise, warm, and professional.
- If relevant, mention which policy section the answer comes from.
- Format your answer clearly. Use bullet points for lists.

## Policy Context (retrieved via RAG)
${context}

## Conversation History
${historyStr || 'No previous conversation.'}

## Employee Question
${question}

## Your Answer:
`;

    const answer = await generateContent(prompt);

    // ── 5. Collect unique source document titles ──────────────────────────────
    const sources = [...new Set(
      chunks.map(c => docMap[c.documentId?.toString()]).filter(Boolean)
    )];

    res.status(200).json({
      success: true,
      answer,
      sources,
      chunksUsed: chunks.length,
    });
  } catch (err) {
    console.error('askBot error:', err);
    res.status(500).json({ success: false, message: 'Failed to get answer from policy bot.' });
  }
};

module.exports = { askBot };
