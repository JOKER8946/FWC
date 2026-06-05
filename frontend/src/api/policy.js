import API from './axios';

export const listPolicies  = ()       => API.get('/policy');
export const uploadPolicy  = (data)   => API.post('/policy/upload', data, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const togglePolicy  = (id)     => API.patch(`/policy/${id}/toggle`);
export const deletePolicy  = (id)     => API.delete(`/policy/${id}`);
export const askPolicyBot  = (data)   => API.post('/policy/ask', data);
