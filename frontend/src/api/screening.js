import API from './axios';

export const getSessions    = (jobId)  => API.get('/screening', { params: { jobId } });
export const getSession     = (id)     => API.get(`/screening/${id}`);
export const createSession  = (data)   => API.post('/screening/create', data);
export const sendMessage    = (id, data) => API.post(`/screening/${id}/message`, data);
export const endSession            = (id)  => API.post(`/screening/${id}/end`);
export const generateCandidateLink = (id)  => API.post(`/screening/${id}/generate-link`);
