import axios from 'axios';

const api = axios.create({
  baseURL: 'https://fluxusteamkanban-staging.up.railway.app/api',
  withCredentials: true, // send httpOnly auth cookie on every request
});

export default api;
