import API from './axios';

export const getEmployees    = (params) => API.get('/employees', { params });
export const getEmployee     = (id)     => API.get(`/employees/${id}`);
export const getMyProfile    = ()       => API.get('/employees/me');
export const getDepartments  = ()       => API.get('/employees/departments');
export const createEmployee  = (data)   => API.post('/employees', data);
export const updateEmployee  = (id, data) => API.put(`/employees/${id}`, data);
export const deactivateEmployee = (id)  => API.delete(`/employees/${id}`);
