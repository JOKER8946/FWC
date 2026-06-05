import API from './axios';

export const getAllRisks      = (params) => API.get('/flight-risk', { params });
export const getEmployeeRisk  = (empId)  => API.get(`/flight-risk/${empId}`);
export const runAnalysis      = (data)   => API.post('/flight-risk/run', data || {});
export const resolveRisk      = (id, data) => API.patch(`/flight-risk/${id}/resolve`, data);
export const retrainModel     = ()       => API.post('/flight-risk/retrain');
