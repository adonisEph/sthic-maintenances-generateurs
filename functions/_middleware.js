import { parseCookies, verifySession } from './_utils/auth.js';

export async function onRequest(context) {
  const { request, env } = context;

  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies.gma_session;

  context.data.user = null;

  const secret = env.SESSION_SECRET;
  if (secret && token) {
    const payload = await verifySession(secret, token);
    if (payload && payload.sub) {
      context.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        technicianName: payload.technicianName || ''
      };
    }
  }

  return context.next();
}
