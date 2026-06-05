import axios from 'axios';

// Raw axios — no JWT interceptor. Candidate is unauthenticated.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') + '/screening/candidate';

export const getCandidateSession   = (token)        => axios.get(`${BASE}/${token}`);
export const candidateSendMessage  = (token, data)  => axios.post(`${BASE}/${token}/message`, data);
export const candidateEndSession   = (token)        => axios.post(`${BASE}/${token}/end`);
export const recordProctoringEvent = (token, data)  => axios.post(`${BASE}/${token}/proctoring-event`, data);

