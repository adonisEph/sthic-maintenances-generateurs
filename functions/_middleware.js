import { parseCookies, verifySession } from './_utils/auth.js';
import { writeAuditLog } from './api/_utils/audit.js';

function parseBearerToken(authHeader) {
  const h = String(authHeader || '').trim();
  if (!h) return '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? String(m[1] || '').trim() : '';
}

function getAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return '';
  const list = String(env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return '';
  return list.includes(origin) ? origin : '';
}

function withCors(resp, request, env) {
  const allowed = getAllowedOrigin(request, env);
  if (!allowed) return resp;

  const headers = new Headers(resp.headers);
  headers.set('Access-Control-Allow-Origin', allowed);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(resp.body, { ...resp, headers });
}

function actionForRequest(request) {
  const url = new URL(request.url);
  const p = url.pathname;
  const m = String(request.method || '').toUpperCase();
  if (p === '/api/auth/login') return 'AUTH_LOGIN';
  if (p === '/api/auth/token-login') return 'AUTH_TOKEN_LOGIN';
  if (p === '/api/auth/logout') return 'AUTH_LOGOUT';
  if (/^\/api\/pm\/months\/[^/]+\/client-import$/.test(p)) return 'PM_CLIENT_IMPORT';
  if (/^\/api\/pm\/months\/[^/]+\/noc-import$/.test(p)) return 'PM_NOC_IMPORT';
  if (/^\/api\/pm\/months\/[^/]+\/items$/.test(p) && m === 'PATCH') return 'PM_ITEM_UPDATE';
  if (p === '/api/sites/bulk-replace') return 'SITES_BULK_REPLACE';
  if (p === '/api/users' && m === 'POST') return 'USERS_CREATE';
  if (/^\/api\/users\/[^/]+$/.test(p) && m === 'PATCH') return 'USERS_UPDATE';
  if (/^\/api\/users\/[^/]+$/.test(p) && m === 'DELETE') return 'USERS_DELETE';
  if (p === '/api/admin/reset') return 'ADMIN_RESET';
  return `HTTP_${m}`;
}

function shouldAudit(request) {
  const url = new URL(request.url);
  const p = url.pathname;
  if (!p.startsWith('/api/')) return false;
  if (p === '/api/auth/login') return false;
  if (p === '/api/auth/token-login') return false;
  if (p === '/api/audit') return false;
  if (p === '/api/presence/ping') return false;
  if (p === '/api/presence') return false;
  return true;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    const headers = new Headers();
    const allowed = getAllowedOrigin(request, env);
    if (allowed) {
      headers.set('Access-Control-Allow-Origin', allowed);
      headers.set('Vary', 'Origin');
      headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      headers.set('Access-Control-Max-Age', '86400');
    }
    return new Response(null, { status: 204, headers });
  }

  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies.gma_session;

  const bearer = parseBearerToken(request.headers.get('Authorization'));

  context.data.user = null;

  const secret = env.SESSION_SECRET;
  if (secret) {
    const sessionToken = bearer || token;
    if (sessionToken) {
      const payload = await verifySession(secret, sessionToken);
      if (payload && payload.sub) {
        context.data.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          technicianName: payload.technicianName || ''
        };
      }
    }
  }

  const res = await context.next();

  if (shouldAudit(request)) {
    try {
      const url = new URL(request.url);
      await writeAuditLog(env, context.data, {
        action: actionForRequest(request),
        request,
        status: res?.status,
        metadata: {
          ok: res?.ok === true,
          query: url.searchParams ? Object.fromEntries(url.searchParams.entries()) : null
        }
      });
    } catch {
      // ignore
    }
  }

  return withCors(res, request, env);
}
