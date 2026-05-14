import axios from 'axios';

const api = axios.create({
  baseURL: 'https://fluxusteamkanban-staging.up.railway.app/api',
  withCredentials: true, // send httpOnly auth cookie on every request
});

// If any request returns 401, the session has expired — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
