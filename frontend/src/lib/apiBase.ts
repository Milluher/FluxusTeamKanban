// Base URL of the backend, shared by the REST client and the socket connection.
//
// Set NEXT_PUBLIC_API_BASE_URL to point a deployment at a different backend
// (a preview, a local server, or the staging environment). It is read at build
// time, so changing it in Vercel needs a redeploy to take effect.
//
// The default is the production backend. It used to be the staging one, which
// meant the live site depended on an environment named "staging" — routine work
// there took the site down.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ||
  'https://fluxusteamkanban-production.up.railway.app';

export default API_BASE_URL;
