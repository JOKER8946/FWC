const { GoogleGenAI }          = require('@google/genai');
const { GoogleGenerativeAI }   = require('@google/generative-ai');
const ResumeChunk = require('../models/ResumeChunk');

// Separate client using @google/generative-ai — needed for inline audio/binary data parts
const genAIv1 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DEFAULT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

const modelCache = { name: null };

const getModelCandidates = () => {
  const envModel = process.env.GEMINI_MODEL?.trim();
  const candidates = envModel ? [envModel, ...DEFAULT_MODELS] : [...DEFAULT_MODELS];
  return [...new Set(candidates)];
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const isModelUnavailableError = (err) => {
  const message = String(err?.message || '').toLowerCase();
  const status = err?.status || (err?.response && err.response.status);

  return (
    status === 404 ||
    status === 429 ||
    status === 503 ||
    message.includes('404') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('not found') ||
    message.includes('not supported') ||
    message.includes('retired') ||
    message.includes('deprecated') ||
    message.includes('quota') ||
    message.includes('limit: 0') ||
    message.includes('rate limit') ||
    message.includes('high demand') ||
    message.includes('unavailable')
  );
};

/**
 * Generic content generation with automatic model fallback
 */
const generateContent = async (prompt) => {
  // Use cached successful model if available
  if (modelCache.name) {
    try {
      const response = await ai.models.generateContent({
        model: modelCache.name,
        contents: prompt
      });
      return response.text;
    } catch (err) {
      if (isModelUnavailableError(err)) {
        modelCache.name = null; // Clear cache on failure
      } else {
        throw err;
      }
    }
  }

  let lastErr;
  for (const name of getModelCandidates()) {
    try {
      const response = await ai.models.generateContent({
        model: name,
        contents: prompt
      });
      modelCache.name = name;
      return response.text;
    } catch (err) {
      lastErr = err;
      if (isModelUnavailableError(err)) {
        console.warn(`Gemini model ${name} unavailable (status: ${err.status || 'unknown'}), trying next...`);
        await sleep(300);
        continue;
      }
      throw err;
    }
  }

  const tried = getModelCandidates().join(', ');
  throw new Error(`No available Gemini model found. Tried: ${tried}. Last error: ${lastErr?.message || lastErr}`);
};

const generateWithFallback = async (prompt) => {
  // Legacy wrapper for scoreResumeWithRAG compatibility
  const text = await generateContent(prompt);
  return { text };
};

const retrieveRelevantChunks = async (resumeId, jobRequirements, topK = 6) => {
  const keywords = jobRequirements
    .join(' ')
    .replace(/[^a-zA-Z0-9\s+]/g, '')
    .trim();

  if (!keywords) {
    return await ResumeChunk.find({ resumeId })
      .sort({ chunkIndex: 1 })
      .limit(topK)
      .lean();
  }

  const chunks = await ResumeChunk.find(
    { resumeId, $text: { $search: keywords } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(topK)
    .lean();

  if (chunks.length < topK) {
    const found = new Set(chunks.map(c => c.chunkIndex));
    const extra = await ResumeChunk.find({
      resumeId,
      chunkIndex: { $nin: [...found] },
    })
      .sort({ chunkIndex: 1 })
      .limit(topK - chunks.length)
      .lean();
    chunks.push(...extra);
  }

  return chunks;
};

const scoreResumeWithRAG = async (resumeId, jobTitle, jobRequirements, fullResumeText) => {
  const chunks = await retrieveRelevantChunks(resumeId, jobRequirements);
  const retrievedContext = chunks.map((c, i) => `[Chunk ${i + 1}]\n${c.content}`).join('\n\n');

  const prompt = `
You are an expert HR analyst performing blind resume screening. Your job is to evaluate a candidate fairly and objectively.

## Job Title
${jobTitle}

## Job Requirements
${jobRequirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Most Relevant Resume Sections (retrieved via RAG)
${retrievedContext}

## Full Resume Text (for PII extraction only)
${fullResumeText.slice(0, 3000)}

## Your Task
1. Score the candidate ONLY on skills and experience — ignore name, gender, age, location.
2. Extract personal identifiers (name, email, phone, location) separately — these will be HIDDEN from the recruiter initially.
3. Return a single valid JSON object. No explanation, no markdown, no backticks — ONLY the raw JSON.

## Required JSON format:
{
  "blindScore": <number 0-100, overall match score>,
  "skillsMatch": <number 0-100>,
  "experienceMatch": <number 0-100>,
  "strengths": [<string>, <string>, <string>],
  "gaps": [<string>, <string>],
  "redFlags": [<string>],
  "recommendation": "<one of: strong_hire | consider | reject>",
  "reasoning": "<2-3 sentence plain English summary of the score>",
  "candidateInfo": {
    "name": "<full name or 'Not found'>",
    "email": "<email or 'Not found'>",
    "phone": "<phone or 'Not found'>",
    "location": "<city/state or 'Not found'>"
  }
}
`;

  const result = await generateWithFallback(prompt);
  const raw = result.text.trim(); // result.text is used in @google/genai

  const cleaned = raw.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned non-JSON response: ${cleaned.slice(0, 200)}`);
  }

  ['blindScore', 'skillsMatch', 'experienceMatch'].forEach(key => {
    if (typeof parsed[key] === 'number') {
      parsed[key] = Math.min(100, Math.max(0, Math.round(parsed[key])));
    }
  });

  return parsed;
};

module.exports = { generateContent, scoreResumeWithRAG, retrieveRelevantChunks };
