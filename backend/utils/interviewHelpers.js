const MAX_TURNS = 8;

const formatHistory = (history) =>
  history
    .map(t => `${t.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${t.message}`)
    .join('\n');

const buildOpeningPrompt = (job, resume) => `
You are a professional technical interviewer conducting an initial screening interview.

Job Role: ${job?.title || 'Software Engineer'}
Department: ${job?.department || 'Engineering'}
Key Requirements: ${(job?.requirements || []).slice(0, 6).join(', ')}
Candidate blind score: ${resume?.blindScore || 'N/A'}/100
Top strengths from resume: ${(resume?.aiEvaluation?.strengths || []).slice(0, 2).join(', ')}

Generate a warm, professional OPENING question to start the interview.
Rules:
- Keep it conversational and welcoming
- One question only — no multi-part questions
- Start with a brief 1-sentence welcome
- Ask something that lets the candidate introduce themselves and their relevant experience
- Do NOT ask about salary, location, or personal details
- Maximum 3 sentences total

Reply with ONLY the question text. No labels, no formatting.
`;

const buildFollowUpPrompt = (job, history, turnCount) => {
  const isLastTurn = turnCount >= MAX_TURNS;
  const historyStr = formatHistory(history);
  return `
You are a professional technical interviewer. This is a live screening interview.

Job Role: ${job?.title || 'Engineer'}
Requirements: ${(job?.requirements || []).slice(0, 5).join(', ')}
Turn: ${turnCount} of ${MAX_TURNS}
${isLastTurn ? '⚠ This is the FINAL question. Make it a closing question.' : ''}

Full conversation so far:
${historyStr}

Your task: Generate the NEXT interview question.

Rules:
- Read the candidate's last answer carefully
- If they mentioned a specific technology or experience → ask a targeted follow-up about it
- If the answer was vague → probe deeper on that point
- If the answer was strong → advance to a new relevant topic
- One focused question only — no multi-part questions
- Be conversational, not robotic
${
  isLastTurn
    ? '- This is the final question. Ask something like "Is there anything else you would like us to know about your experience?" or a closing behavioural question.'
    : '- Keep advancing through: experience → technical depth → problem solving → teamwork'
}

Reply with ONLY the question text. No labels, no preamble.
`;
};

const buildAnalysisPrompt = (job, history) => {
  const historyStr = formatHistory(history);
  return `
You are a senior HR analyst reviewing a completed technical screening interview.

Job Role: ${job?.title || 'Engineer'}
Requirements: ${(job?.requirements || []).slice(0, 5).join(', ')}

Full Interview Transcript:
${historyStr}

Analyze the candidate's performance and return ONLY a valid JSON object. No markdown, no backticks.

{
  "communicationScore": <0-100, how clearly and confidently they communicated>,
  "technicalScore": <0-100, depth of technical knowledge shown>,
  "confidenceScore": <0-100, based on language certainty and detail richness>,
  "keyInsights": [
    "<specific observation 1>",
    "<specific observation 2>",
    "<specific observation 3>"
  ],
  "overallVerdict": "<advance | hold | reject>",
  "summary": "<2-3 sentence plain English performance summary>"
}
`;
};

const parseAnalysis = (raw) => {
  try {
    const cleaned = raw.trim().replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(cleaned);
    ['communicationScore', 'technicalScore', 'confidenceScore'].forEach(k => {
      if (typeof analysis[k] === 'number') {
        analysis[k] = Math.min(100, Math.max(0, Math.round(analysis[k])));
      }
    });
    return analysis;
  } catch {
    return {
      communicationScore: 60,
      technicalScore:     60,
      confidenceScore:    60,
      keyInsights:        [],
      overallVerdict:     'hold',
      summary:            'Analysis could not be parsed.',
    };
  }
};

module.exports = { MAX_TURNS, formatHistory, buildOpeningPrompt, buildFollowUpPrompt, buildAnalysisPrompt, parseAnalysis };
