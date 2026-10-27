let token = localStorage.getItem('vetec_token') || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('vetec_token', t);
  else localStorage.removeItem('vetec_token');
}

export function getToken() { return token; }

function qs(params) {
  if (!params) return '';
  const parts = [];
  for (const k of Object.keys(params)) {
    const v = params[k];
    if (v === undefined || v === null || v === '') continue;
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
  }
  return parts.length ? '?' + parts.join('&') : '';
}

async function request(method, url, body, isForm) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let payload = body;
  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch('/api' + url, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }

  if (!res.ok) {
    const err = new Error((data && data.error) || 'Erro ' + res.status);
    err.status = res.status;
    if (res.status === 401 && !url.startsWith('/auth/login')) {
      window.dispatchEvent(new CustomEvent('vetec:unauthorized'));
    }
    throw err;
  }
  return data;
}

export const api = {
  get: (url, params) => request('GET', url + qs(params)),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
  upload: (url, formData) => request('POST', url, formData, true),
  downloadUrl: (url) => '/api' + url
};
