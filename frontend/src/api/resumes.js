import API from './axios';

export const getJobsForScreener = ()       => API.get('/resumes/jobs');
export const getResumes         = (jobId)  => API.get('/resumes', { params: { jobId } });
export const uploadResume       = (formData) => API.post('/resumes/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const shortlistResume    = (id)     => API.patch(`/resumes/${id}/shortlist`);
export const rejectResume       = (id)     => API.patch(`/resumes/${id}/reject`);

export const createJob = (data) => API.post('/jobs', data);
export const getJobs   = ()     => API.get('/jobs');
