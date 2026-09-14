const SESSION_COOKIE = 'sid';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 dias, mesmo TTL do sessionService

// Sem dependencia externa (cookie-parser etc.) de proposito, na mesma linha do
// resto do projeto: o parsing de "Cookie: a=1; b=2" e simples o bastante para
// nao justificar mais uma dependencia a ser auditada.
function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;

  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function setSessionCookie(res, sessionId) {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS};${secure}`
  );
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0;${secure}`);
}

function getSessionIdFromRequest(req) {
  return parseCookies(req)[SESSION_COOKIE];
}

function createAuthMiddleware(sessionService) {
  function requireAuth(req, res, next) {
    const sessionId = getSessionIdFromRequest(req);
    const user = sessionService.getSessionUser(sessionId);
    if (!user) {
      return res.status(401).json({ error: 'Nao autenticado.' });
    }
    req.user = user;
    req.sessionId = sessionId;
    next();
  }

  function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }
    next();
  }

  return { requireAuth, requireAdmin };
}

export { createAuthMiddleware, setSessionCookie, clearSessionCookie, getSessionIdFromRequest };
