// Supabase access for the admin page: magic-link login (GoTrue REST, no library), the session in
// localStorage with refresh, PostgREST calls, RPCs and logo uploads. Everything is checked again
// server-side by row-level security (supabase/partners.sql), so this is convenience, not security.
import { PARTNERS } from '../shared/config.js';

const KEY = 'bangsaen.admin.session', base = PARTNERS.rest.replace('/rest/v1', '');
const auth = `${base}/auth/v1`, storage = `${base}/storage/v1`;
let session = null;
try { session = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* blocked */ }
const save = s => { session = s; try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* blocked */ } };

/** A magic link lands here with #access_token=…; keep it and clean the address bar. */
export function takeSessionFromHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.get('access_token')) return false;
  save({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: Date.now() + (+h.get('expires_in') || 3600) * 1000, email: emailOf(h.get('access_token')) });
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}
function emailOf(jwt) { try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email || ''; } catch { return ''; } }

export const me = () => session?.email || null;
export const signedIn = () => !!session?.access_token;

export async function sendMagicLink(email) {
  const r = await fetch(`${auth}/otp?redirect_to=${encodeURIComponent(location.origin + location.pathname)}`, {
    method: 'POST', headers: { apikey: PARTNERS.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: true }),
  });
  if (!r.ok) throw new Error((await r.json()).msg || r.status);
}
/** If the email shows a 6-digit code instead of a link. */
export async function verifyCode(email, token) {
  const r = await fetch(`${auth}/verify`, { method: 'POST', headers: { apikey: PARTNERS.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'email', email, token }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.msg || d.error_description || r.status);
  save({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + d.expires_in * 1000, email: d.user?.email || email });
}
export function signOut() { save(null); }

async function token() {
  if (!session) throw new Error('login');
  if (Date.now() > session.expires_at - 60000 && session.refresh_token) {
    const r = await fetch(`${auth}/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: PARTNERS.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
    if (!r.ok) { save(null); throw new Error('login'); }
    const d = await r.json();
    save({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + d.expires_in * 1000, email: d.user?.email || session.email });
  }
  return session.access_token;
}

/** PostgREST: rest('placements?select=*&order=created_at.desc'), rest('placements', { method: 'POST', body }) … */
export async function rest(path, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${PARTNERS.rest}/${path}`, {
    method, headers: { apikey: PARTNERS.key, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Prefer: prefer || (method === 'GET' ? '' : 'return=representation') },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 401) { save(null); throw new Error('login'); }
  const text = await r.text(), data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(data?.message || data?.hint || `HTTP ${r.status}`);
  return data;
}
export const rpc = (name, args) => rest(`rpc/${name}`, { method: 'POST', body: args, prefer: 'return=representation' });

/** Upload a logo file to the public `logos` bucket; returns its public URL. */
export async function uploadLogo(file, placementId) {
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg'), name = `${placementId}-${Date.now()}.${ext}`;
  const r = await fetch(`${storage}/object/logos/${name}`, { method: 'POST', headers: { apikey: PARTNERS.key, Authorization: `Bearer ${await token()}`, 'Content-Type': file.type, 'x-upsert': 'true' }, body: file });
  if (!r.ok) throw new Error((await r.json()).message || r.status);
  return `${storage}/object/public/logos/${name}`;
}
