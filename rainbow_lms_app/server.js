'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const {
  generateTemporaryPassword,
  randomToken,
  tokenHash,
  validatePassword,
  verifyPassword,
} = require('./src/security');
const { openDatabase } = require('./src/database');
const {
  csvEscape,
  normalizeDueDate,
  nowIso,
  toArray,
} = require('./src/utils');
const views = require('./src/views');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(DATA_DIR, 'rainbow-lms.sqlite');
const CATALOG_PATH = path.join(ROOT, 'data', 'course_catalog.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
const SESSION_COOKIE = 'rr_lms_session';
const LOGIN_CSRF_COOKIE = 'rr_lms_login_csrf';
const SESSION_HOURS = Math.max(1, Number(process.env.SESSION_HOURS || 12));
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const TIME_ZONE = process.env.TIME_ZONE || 'America/New_York';
const SHOW_DEMO_CREDENTIALS = String(process.env.SHOW_DEMO_CREDENTIALS ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')).toLowerCase() === 'true';
const DEMO_ACCOUNTS = {
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'RainbowAdmin!2026',
  employeeUsername: process.env.DEMO_EMPLOYEE_USERNAME || 'employee',
  employeePassword: process.env.DEMO_EMPLOYEE_PASSWORD || 'RainbowEmployee!2026',
};

const db = openDatabase({ dbPath: DB_PATH, catalogPath: CATALOG_PATH, timeZone: TIME_ZONE });
const loginAttempts = new Map();

function securityHeaders(res, { legacy = false } = {}) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', legacy ? 'SAMEORIGIN' : 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', legacy ? 'same-origin-allow-popups' : 'same-origin');
  if (legacy) {
    res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' blob:; connect-src 'self'; frame-ancestors 'self'; form-action 'self';");
  } else {
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src 'self'; connect-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none';");
  }
}

function sendHtml(res, html, status = 200) {
  securityHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
}

function sendJson(res, data, status = 200) {
  securityHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function sendText(res, text, contentType = 'text/plain; charset=utf-8', status = 200, filename = null) {
  securityHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  if (filename) res.setHeader('Content-Disposition', `attachment; filename="${filename.replaceAll('"', '')}"`);
  res.end(text);
}

function redirect(res, location, status = 303) {
  res.statusCode = status;
  res.setHeader('Location', location);
  res.end();
}

function redirectMessage(res, pathname, text, type = 'success') {
  const separator = pathname.includes('?') ? '&' : '?';
  redirect(res, `${pathname}${separator}msg=${encodeURIComponent(text)}&type=${encodeURIComponent(type)}`);
}

function parseCookies(req) {
  const result = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach(pair => {
    const index = pair.indexOf('=');
    if (index < 0) return;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    try { result[key] = decodeURIComponent(value); } catch { result[key] = value; }
  });
  return result;
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || '/'}`, `SameSite=${options.sameSite || 'Lax'}`];
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (COOKIE_SECURE || options.secure) parts.push('Secure');
  if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  const prior = res.getHeader('Set-Cookie');
  const next = prior ? (Array.isArray(prior) ? [...prior, parts.join('; ')] : [prior, parts.join('; ')]) : parts.join('; ');
  res.setHeader('Set-Cookie', next);
}

function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0, expires: new Date(0) });
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || '';
}

async function parseBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (contentType === 'application/json') {
    try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error('Invalid JSON request.'); }
  }
  const params = new URLSearchParams(raw);
  const output = {};
  for (const [key, value] of params.entries()) {
    if (Object.prototype.hasOwnProperty.call(output, key)) {
      output[key] = Array.isArray(output[key]) ? [...output[key], value] : [output[key], value];
    } else output[key] = value;
  }
  return output;
}

function getMessage(url) {
  const text = url.searchParams.get('msg');
  if (!text) return null;
  return { text: text.slice(0, 600), type: url.searchParams.get('type') || 'info' };
}

function authenticate(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = db.getSession(tokenHash(token));
  return session ? { ...session, rawToken: token } : null;
}

function requireAuth(req, res, url) {
  const session = authenticate(req);
  if (!session) {
    const next = `${url.pathname}${url.search}`;
    redirect(res, `/login?next=${encodeURIComponent(next)}`);
    return null;
  }
  if (session.user.must_change_password && !['/profile', '/profile/password', '/logout'].includes(url.pathname)) {
    redirectMessage(res, '/profile', 'Change the temporary password before continuing.', 'warning');
    return null;
  }
  return session;
}

function requireAdmin(req, res, url) {
  const session = requireAuth(req, res, url);
  if (!session) return null;
  if (session.user.account_role !== 'admin') {
    renderError(res, session, url, 403, 'Administrator Access Required', 'This page is limited to active LMS administrators.');
    return null;
  }
  return session;
}

function validCsrf(req, session, body) {
  const supplied = req.headers['x-csrf-token'] || body?.csrf;
  return typeof supplied === 'string' && supplied.length > 10 && supplied === session.csrfToken;
}

function navCounts(user) {
  const learning = db.listCourseAssignments({ userId: user.id }).filter(a => a.status !== 'completed').length;
  const tasks = db.listTaskAssignments({ userId: user.id }).filter(t => t.status !== 'completed').length;
  const counts = { learning: learning || '', tasks: tasks || '' };
  if (user.account_role === 'admin') {
    const dashboard = db.getAdminDashboard();
    counts.overdue = n(dashboard.courses.overdue) + n(dashboard.tasks.overdue) || '';
    counts.approvals = n(dashboard.tasks.pending_approval) || '';
  }
  return counts;
}

function n(value) { return Number(value || 0); }

function renderPage(res, session, url, title, body, options = {}) {
  sendHtml(res, views.layout({
    title,
    user: session.user,
    csrfToken: session.csrfToken,
    pathname: url.pathname,
    body,
    message: options.message || getMessage(url),
    navCounts: navCounts(session.user),
    subtitle: options.subtitle || '',
    printable: options.printable || false,
  }), options.status || 200);
}

function renderError(res, session, url, status, title, message) {
  const body = views.errorPage({ status, title, message });
  if (session) renderPage(res, session, url, title, body, { status });
  else renderLogin(res, { message: { text: message, type: 'error' } }, status);
}

function serveStatic(req, res, pathname) {
  const aliases = { '/app.css': 'app.css', '/app.js': 'app.js' };
  let relative;
  if (aliases[pathname]) relative = aliases[pathname];
  else if (pathname.startsWith('/assets/')) relative = pathname.slice(1);
  else if (pathname.startsWith('/courseware/')) relative = pathname.slice(1);
  else return false;
  let decoded;
  try { decoded = decodeURIComponent(relative); } catch { return false; }
  const filePath = path.resolve(PUBLIC_DIR, decoded);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    sendText(res, 'Forbidden', 'text/plain; charset=utf-8', 403);
    return true;
  }
  let stat;
  try { stat = fs.statSync(filePath); } catch { sendText(res, 'Not found', 'text/plain; charset=utf-8', 404); return true; }
  if (!stat.isFile()) { sendText(res, 'Not found', 'text/plain; charset=utf-8', 404); return true; }
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  }[ext] || 'application/octet-stream';
  securityHeaders(res, { legacy: pathname.startsWith('/courseware/') });
  res.statusCode = 200;
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Cache-Control', pathname.startsWith('/courseware/') ? 'no-store' : 'public, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function checkLoginRateLimit(req, username) {
  const key = `${clientIp(req)}:${String(username || '').toLowerCase()}`;
  const now = Date.now();
  const prior = loginAttempts.get(key) || { attempts: [], lockedUntil: 0 };
  prior.attempts = prior.attempts.filter(time => now - time < 15 * 60 * 1000);
  if (prior.lockedUntil > now) return { allowed: false, retrySeconds: Math.ceil((prior.lockedUntil - now) / 1000), key, prior };
  return { allowed: true, key, prior };
}

function recordLoginFailure(rate) {
  const now = Date.now();
  rate.prior.attempts.push(now);
  if (rate.prior.attempts.length >= 7) rate.prior.lockedUntil = now + 15 * 60 * 1000;
  loginAttempts.set(rate.key, rate.prior);
}

function clearLoginFailures(rate) { loginAttempts.delete(rate.key); }

function renderLogin(res, options = {}, status = 200) {
  return sendHtml(res, views.loginPage({
    ...options,
    showDemoCredentials: SHOW_DEMO_CREDENTIALS,
    demoAccounts: DEMO_ACCOUNTS,
  }), status);
}

async function handleLogin(req, res, url) {
  if (req.method === 'GET') {
    if (authenticate(req)) return redirect(res, '/dashboard');
    const csrf = randomToken(24);
    setCookie(res, LOGIN_CSRF_COOKIE, csrf, { maxAge: 30 * 60, sameSite: 'Lax' });
    return renderLogin(res, { message: getMessage(url), csrfToken: csrf });
  }
  if (req.method !== 'POST') return sendText(res, 'Method not allowed', 'text/plain; charset=utf-8', 405);
  const body = await parseBody(req);
  const cookies = parseCookies(req);
  if (!body.csrf || !cookies[LOGIN_CSRF_COOKIE] || body.csrf !== cookies[LOGIN_CSRF_COOKIE]) {
    return renderLogin(res, { message: { text: 'The sign-in form expired. Reload the page and try again.', type: 'error' } }, 403);
  }
  const username = String(body.username || '').trim().toLowerCase();
  const rate = checkLoginRateLimit(req, username);
  if (!rate.allowed) {
    db.audit(null, 'login.rate_limited', 'user', username, { retrySeconds: rate.retrySeconds }, clientIp(req));
    return renderLogin(res, { message: { text: 'Too many sign-in attempts. Try again after the lockout period.', type: 'error' }, csrfToken: body.csrf }, 429);
  }
  const user = db.getUserByUsername(username);
  if (!user || !user.active || !verifyPassword(body.password, user.password_hash)) {
    recordLoginFailure(rate);
    db.audit(user?.id || null, 'login.failed', 'user', username, { active: Boolean(user?.active) }, clientIp(req));
    return renderLogin(res, { message: { text: 'The username or password is incorrect.', type: 'error' }, csrfToken: body.csrf }, 401);
  }
  clearLoginFailures(rate);
  const token = randomToken(32);
  const csrf = randomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  db.createSession(user.id, tokenHash(token), csrf, expiresAt.toISOString(), { ipAddress: clientIp(req), userAgent: req.headers['user-agent'] || '' });
  db.recordLogin(user.id);
  db.audit(user.id, 'login.succeeded', 'user', user.id, {}, clientIp(req));
  setCookie(res, SESSION_COOKIE, token, { maxAge: SESSION_HOURS * 60 * 60, sameSite: 'Lax' });
  clearCookie(res, LOGIN_CSRF_COOKIE);
  const requested = String(url.searchParams.get('next') || '');
  const destination = user.must_change_password ? '/profile?msg=Change%20your%20temporary%20password%20before%20continuing.&type=warning' : requested.startsWith('/') && !requested.startsWith('//') ? requested : user.account_role === 'admin' ? '/admin' : '/dashboard';
  return redirect(res, destination);
}

async function handleAuthenticated(req, res, url, session) {
  const pathname = url.pathname;

  if (pathname === '/logout' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    db.deleteSession(tokenHash(session.rawToken));
    db.audit(session.user.id, 'logout', 'user', session.user.id, {}, clientIp(req));
    clearCookie(res, SESSION_COOKIE);
    return redirectMessage(res, '/login', 'You have been signed out.', 'success');
  }

  if (pathname === '/' && req.method === 'GET') return redirect(res, session.user.account_role === 'admin' ? '/admin' : '/dashboard');

  if (pathname === '/dashboard' && req.method === 'GET') {
    if (session.user.account_role === 'admin') return redirect(res, '/admin');
    const dashboard = db.getEmployeeDashboard(session.user.id);
    const monthlyLeaderboard = db.getLeaderboard('monthly', 100);
    return renderPage(res, session, url, 'Dashboard', views.employeeDashboardPage({ user: session.user, dashboard, monthlyLeaderboard, csrfToken: session.csrfToken }));
  }

  if (pathname === '/learning' && req.method === 'GET') {
    const assignments = db.listCourseAssignments({ userId: session.user.id });
    return renderPage(res, session, url, 'My Learning', views.learningPage({ assignments }));
  }

  if (pathname === '/library' && req.method === 'GET') {
    const courses = db.listCourses({ activeOnly: true });
    const assignments = db.listCourseAssignments({ userId: session.user.id });
    const categories = db.getCategories();
    return renderPage(res, session, url, 'Course Library', views.libraryPage({ courses, assignments, categories, isAdmin: session.user.account_role === 'admin' }));
  }

  const learnMatch = pathname.match(/^\/learn\/(\d+)$/);
  if (learnMatch && req.method === 'GET') {
    const assignmentId = Number(learnMatch[1]);
    let assignment = db.getCourseAssignment(assignmentId, session.user.id);
    if (!assignment) return renderError(res, session, url, 404, 'Course Not Found', 'This course is not assigned to your account.');
    assignment = db.startCourseAssignment(assignmentId, session.user.id);
    const certificate = assignment.status === 'completed' ? db.getCertificateByAssignment(assignment.id, assignment.cycle) : null;
    const body = assignment.delivery_type === 'legacy'
      ? views.legacyCoursePage({ assignment, user: session.user, csrfToken: session.csrfToken, certificate })
      : views.nativeCoursePage({ assignment, csrfToken: session.csrfToken, certificate });
    return renderPage(res, session, url, assignment.title, body, { subtitle: `${assignment.category} • ${assignment.estimated_minutes} minutes` });
  }

  const lessonMatch = pathname.match(/^\/learn\/(\d+)\/lesson\/(\d+)$/);
  if (lessonMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    try {
      db.completeLesson(Number(lessonMatch[1]), session.user.id, Number(lessonMatch[2]));
      return redirectMessage(res, `/learn/${lessonMatch[1]}#lesson-${Number(lessonMatch[2]) + 1}`, 'Lesson marked complete.', 'success');
    } catch (error) { return redirectMessage(res, `/learn/${lessonMatch[1]}`, error.message, 'error'); }
  }

  const quizMatch = pathname.match(/^\/learn\/(\d+)\/quiz$/);
  if (quizMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    const answers = {};
    for (const [key, value] of Object.entries(body)) if (/^q_\d+$/.test(key)) answers[Number(key.slice(2))] = value;
    try {
      const result = db.gradeNativeCourse(Number(quizMatch[1]), session.user.id, answers);
      if (result.passed) return redirectMessage(res, `/certificate/${result.certificate.id}`, `Course completed with a score of ${result.score}%.`, 'success');
      return redirectMessage(res, `/learn/${quizMatch[1]}#assessment`, `Assessment score ${result.score}%. Review is required before another attempt.`, 'error');
    } catch (error) { return redirectMessage(res, `/learn/${quizMatch[1]}#assessment`, error.message, 'error'); }
  }

  const legacyMatch = pathname.match(/^\/api\/legacy-complete\/(\d+)$/);
  if (legacyMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return sendJson(res, { error: 'Security token is missing or expired.' }, 403);
    try {
      const assignment = db.getCourseAssignment(Number(legacyMatch[1]), session.user.id);
      if (!assignment || assignment.delivery_type !== 'legacy') return sendJson(res, { error: 'Interactive course assignment not found.' }, 404);
      const score = Math.max(assignment.passing_score, Math.min(100, Number(body.score || assignment.passing_score)));
      const externalId = String(body.certificateId || body.completionId || '').slice(0, 120) || null;
      const result = db.completeCourseAssignment(assignment.id, session.user.id, score, externalId, {
        source: 'supplied-interactive-module',
        moduleCourse: String(body.course || ''),
        moduleCompletionDate: String(body.completionDate || ''),
        moduleExpirationDate: String(body.expirationDate || ''),
      });
      return sendJson(res, { ok: true, redirect: `/certificate/${result.certificate.id}` });
    } catch (error) { return sendJson(res, { error: error.message }, 400); }
  }

  if (pathname === '/tasks' && req.method === 'GET') {
    const assignments = db.listTaskAssignments({ userId: session.user.id });
    return renderPage(res, session, url, 'My Tasks', views.tasksPage({ assignments, csrfToken: session.csrfToken }));
  }

  const taskCompleteMatch = pathname.match(/^\/tasks\/(\d+)\/complete$/);
  if (taskCompleteMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    try {
      const task = db.submitTask(Number(taskCompleteMatch[1]), session.user.id, { notes: body.notes, evidence: body.evidence });
      return redirectMessage(res, '/tasks', task.status === 'submitted' ? 'Task submitted for administrator approval.' : 'Task completed and points recorded.', 'success');
    } catch (error) { return redirectMessage(res, '/tasks', error.message, 'error'); }
  }

  if (pathname === '/leaderboard' && req.method === 'GET') {
    const period = ['daily', 'weekly', 'monthly', 'yearly'].includes(url.searchParams.get('period')) ? url.searchParams.get('period') : 'daily';
    const leaderboard = db.getLeaderboard(period, 250);
    return renderPage(res, session, url, 'Leaderboard', views.leaderboardPage({ leaderboard, user: session.user }));
  }

  if (pathname === '/certificates' && req.method === 'GET') {
    const certificates = db.listCertificates({ userId: session.user.account_role === 'admin' && url.searchParams.get('all') === '1' ? null : session.user.id });
    return renderPage(res, session, url, 'Certificates', views.certificatesPage({ certificates }));
  }

  const certificateMatch = pathname.match(/^\/certificate\/(\d+)$/);
  if (certificateMatch && req.method === 'GET') {
    const certificate = db.getCertificate(Number(certificateMatch[1]));
    if (!certificate || (session.user.account_role !== 'admin' && certificate.user_id !== session.user.id)) return renderError(res, session, url, 404, 'Certificate Not Found', 'This certificate is unavailable to your account.');
    return renderPage(res, session, url, 'Certificate of Completion', views.certificatePage({ certificate }), { printable: true });
  }

  if (pathname === '/profile' && req.method === 'GET') {
    const current = db.getUser(session.user.id);
    return renderPage(res, { ...session, user: current }, url, 'My Profile', views.profilePage({ user: current, csrfToken: session.csrfToken }));
  }

  if (pathname === '/profile/password' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    const current = db.getUser(session.user.id);
    if (!verifyPassword(body.current_password, current.password_hash)) return redirectMessage(res, '/profile', 'The current password is incorrect.', 'error');
    if (body.new_password !== body.confirm_password) return redirectMessage(res, '/profile', 'The new passwords do not match.', 'error');
    const validation = validatePassword(body.new_password);
    if (!validation.valid) return redirectMessage(res, '/profile', `The new password needs ${validation.errors.join(', ')}.`, 'error');
    db.changePassword(current.id, body.new_password);
    clearCookie(res, SESSION_COOKIE);
    return redirectMessage(res, '/login', 'Password updated. Sign in with the new password.', 'success');
  }

  if (pathname === '/compliance' && req.method === 'GET') {
    const courses = db.listCourses({ activeOnly: true });
    const categories = db.getCategories();
    const reviewedOn = db.getSetting('catalog_reviewed_on', '2026-08-31');
    return renderPage(res, session, url, 'Safety & Compliance', views.compliancePage({ courses, categories, reviewedOn }));
  }

  return false;
}

async function handleAdmin(req, res, url, session) {
  const pathname = url.pathname;

  if (pathname === '/admin' && req.method === 'GET') {
    const dashboard = db.getAdminDashboard();
    const catalogStats = db.getCatalogStats();
    return renderPage(res, session, url, 'Admin Overview', views.adminDashboardPage({ dashboard, catalogStats }));
  }

  if (pathname === '/admin/users' && req.method === 'GET') {
    const users = db.listUsers({ includeInactive: true });
    return renderPage(res, session, url, 'Employees & Administrators', views.adminUsersPage({ users, csrfToken: session.csrfToken }));
  }

  if (pathname === '/admin/users' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    const validation = validatePassword(body.password);
    if (!validation.valid) return redirectMessage(res, '/admin/users', `Temporary password needs ${validation.errors.join(', ')}.`, 'error');
    try {
      db.createUser({
        username: body.username,
        password: body.password,
        fullName: body.full_name,
        email: body.email,
        employeeNumber: body.employee_number,
        department: body.department,
        jobTitle: body.job_title,
        accountRole: body.account_role,
        trainingRoles: toArray(body.training_roles),
        hireDate: body.hire_date,
        mustChangePassword: true,
        autoAssign: Boolean(body.auto_assign),
        actorId: session.user.id,
      });
      return redirectMessage(res, '/admin/users', `Account created for ${body.full_name}. Provide the temporary password through an approved secure channel.`, 'success');
    } catch (error) { return redirectMessage(res, '/admin/users', error.message, 'error'); }
  }

  const userMatch = pathname.match(/^\/admin\/users\/(\d+)$/);
  if (userMatch && req.method === 'GET') {
    const employee = db.getUser(Number(userMatch[1]));
    if (!employee) return renderError(res, session, url, 404, 'Account Not Found', 'The requested account does not exist.');
    const managers = db.listUsers({ includeInactive: false });
    const assignments = db.listCourseAssignments({ userId: employee.id, includeInactiveUsers: true });
    const tasks = db.listTaskAssignments({ userId: employee.id, includeInactiveUsers: true });
    return renderPage(res, session, url, `Manage ${employee.full_name}`, views.adminUserEditPage({ employee, managers, csrfToken: session.csrfToken, assignments, tasks }));
  }

  if (userMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    try {
      db.updateUser(Number(userMatch[1]), {
        username: body.username,
        fullName: body.full_name,
        email: body.email,
        employeeNumber: body.employee_number,
        department: body.department,
        jobTitle: body.job_title,
        accountRole: body.account_role,
        trainingRoles: toArray(body.training_roles),
        hireDate: body.hire_date,
        managerId: body.manager_id,
        assignRequired: Boolean(body.assign_required),
      }, session.user.id);
      return redirectMessage(res, pathname, 'Account profile updated.', 'success');
    } catch (error) { return redirectMessage(res, pathname, error.message, 'error'); }
  }

  const resetPasswordMatch = pathname.match(/^\/admin\/users\/(\d+)\/reset-password$/);
  if (resetPasswordMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    const validation = validatePassword(body.password);
    if (!validation.valid) return redirectMessage(res, `/admin/users/${resetPasswordMatch[1]}`, `Temporary password needs ${validation.errors.join(', ')}.`, 'error');
    try {
      db.resetPassword(Number(resetPasswordMatch[1]), body.password, session.user.id, Boolean(body.must_change));
      return redirectMessage(res, `/admin/users/${resetPasswordMatch[1]}`, 'Password reset and active sessions terminated.', 'success');
    } catch (error) { return redirectMessage(res, `/admin/users/${resetPasswordMatch[1]}`, error.message, 'error'); }
  }

  const toggleUserMatch = pathname.match(/^\/admin\/users\/(\d+)\/toggle$/);
  if (toggleUserMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    if (Number(toggleUserMatch[1]) === session.user.id && body.active !== '1') return redirectMessage(res, `/admin/users/${toggleUserMatch[1]}`, 'You cannot deactivate your own current account.', 'error');
    try {
      db.setUserActive(Number(toggleUserMatch[1]), body.active === '1', session.user.id);
      return redirectMessage(res, `/admin/users/${toggleUserMatch[1]}`, body.active === '1' ? 'Account reactivated.' : 'Account deactivated and sessions terminated.', 'success');
    } catch (error) { return redirectMessage(res, `/admin/users/${toggleUserMatch[1]}`, error.message, 'error'); }
  }

  if (pathname === '/admin/assignments' && req.method === 'GET') {
    const users = db.listUsers({ includeInactive: false });
    const courses = db.listCourses({ activeOnly: true });
    const assignments = db.listCourseAssignments({ includeInactiveUsers: true });
    return renderPage(res, session, url, 'Course Assignments', views.adminAssignmentsPage({ users, courses, assignments, csrfToken: session.csrfToken }));
  }

  if (pathname === '/admin/assignments' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    const userIds = toArray(body.user_ids).map(Number).filter(Number.isInteger);
    const courseIds = toArray(body.course_ids).map(Number).filter(Number.isInteger);
    if (!userIds.length || !courseIds.length) return redirectMessage(res, '/admin/assignments', 'Select at least one employee and one course.', 'error');
    try {
      const result = db.bulkAssignCourses({ userIds, courseIds, assignedBy: session.user.id, dueAt: normalizeDueDate(body.due_date, TIME_ZONE), required: Boolean(body.required) });
      return redirectMessage(res, '/admin/assignments', `${result.created} new assignment(s) created; ${result.existing} existing assignment(s) retained.`, 'success');
    } catch (error) { return redirectMessage(res, '/admin/assignments', error.message, 'error'); }
  }

  const resetAssignmentMatch = pathname.match(/^\/admin\/assignments\/(\d+)\/reset$/);
  if (resetAssignmentMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    try { db.resetCourseAssignment(Number(resetAssignmentMatch[1]), session.user.id); return redirectMessage(res, '/admin/assignments', 'Assignment reset for a new training cycle.', 'success'); }
    catch (error) { return redirectMessage(res, '/admin/assignments', error.message, 'error'); }
  }

  const deleteAssignmentMatch = pathname.match(/^\/admin\/assignments\/(\d+)\/delete$/);
  if (deleteAssignmentMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    try { db.deleteCourseAssignment(Number(deleteAssignmentMatch[1]), session.user.id); return redirectMessage(res, '/admin/assignments', 'Open assignment removed.', 'success'); }
    catch (error) { return redirectMessage(res, '/admin/assignments', error.message, 'error'); }
  }

  if (pathname === '/admin/tasks' && req.method === 'GET') {
    const users = db.listUsers({ includeInactive: false });
    const templates = db.listTaskTemplates({ activeOnly: false });
    const assignments = db.listTaskAssignments({ includeInactiveUsers: true });
    return renderPage(res, session, url, 'Task Manager', views.adminTasksPage({ users, templates, assignments, csrfToken: session.csrfToken }));
  }

  if (pathname === '/admin/tasks/create' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    const userIds = toArray(body.user_ids).map(Number).filter(Number.isInteger);
    if (!userIds.length) return redirectMessage(res, '/admin/tasks', 'Select at least one employee.', 'error');
    try {
      const taskId = db.createTaskTemplate({ title: body.title, description: body.description, category: body.category, points: body.points, recurrence: body.recurrence, requiresApproval: Boolean(body.requires_approval) }, session.user.id);
      db.bulkAssignTask({ taskId, userIds, assignedBy: session.user.id, dueAt: normalizeDueDate(body.due_date, TIME_ZONE) });
      return redirectMessage(res, '/admin/tasks', `Task created and assigned to ${userIds.length} employee(s).`, 'success');
    } catch (error) { return redirectMessage(res, '/admin/tasks', error.message, 'error'); }
  }

  if (pathname === '/admin/tasks/assign' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    const userIds = toArray(body.user_ids).map(Number).filter(Number.isInteger);
    try {
      db.bulkAssignTask({ taskId: Number(body.task_id), userIds, assignedBy: session.user.id, dueAt: normalizeDueDate(body.due_date, TIME_ZONE) });
      return redirectMessage(res, '/admin/tasks', `Task assigned to ${userIds.length} employee(s).`, 'success');
    } catch (error) { return redirectMessage(res, '/admin/tasks', error.message, 'error'); }
  }

  const approveTaskMatch = pathname.match(/^\/admin\/tasks\/(\d+)\/approve$/);
  if (approveTaskMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    try { db.approveTask(Number(approveTaskMatch[1]), session.user.id); return redirectMessage(res, '/admin/tasks', 'Task approved and points recorded.', 'success'); }
    catch (error) { return redirectMessage(res, '/admin/tasks', error.message, 'error'); }
  }

  const rejectTaskMatch = pathname.match(/^\/admin\/tasks\/(\d+)\/reject$/);
  if (rejectTaskMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    try { db.rejectTask(Number(rejectTaskMatch[1]), session.user.id, body.note); return redirectMessage(res, '/admin/tasks', 'Task returned to the employee for correction.', 'success'); }
    catch (error) { return redirectMessage(res, '/admin/tasks', error.message, 'error'); }
  }

  const deleteTaskMatch = pathname.match(/^\/admin\/tasks\/(\d+)\/delete$/);
  if (deleteTaskMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    try { db.deleteTaskAssignment(Number(deleteTaskMatch[1]), session.user.id); return redirectMessage(res, '/admin/tasks', 'Open task assignment removed.', 'success'); }
    catch (error) { return redirectMessage(res, '/admin/tasks', error.message, 'error'); }
  }

  if (pathname === '/admin/courses' && req.method === 'GET') {
    const courses = db.listCourses({ activeOnly: false });
    const categories = db.getCategories();
    return renderPage(res, session, url, 'Course Management', views.adminCoursesPage({ courses, categories, csrfToken: session.csrfToken }));
  }

  if (pathname === '/admin/courses/create' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    try {
      const options = [body.option_0, body.option_1, body.option_2, body.option_3].map(v => String(v || '').trim()).filter(Boolean);
      db.createCustomCourse({
        title: body.title,
        category: body.category,
        description: body.description,
        estimatedMinutes: body.estimated_minutes,
        points: body.points,
        passingScore: body.passing_score,
        renewalMonths: body.renewal_months,
        lessonTitle: body.lesson_title,
        lessonBody: body.lesson_body,
        callout: body.callout,
        question: body.question,
        options,
        answer: body.answer,
        critical: Boolean(body.critical),
        regulatoryBasis: body.regulatory_basis,
      }, session.user.id);
      return redirectMessage(res, '/admin/courses', 'Custom course created and added to the assignment catalog.', 'success');
    } catch (error) { return redirectMessage(res, '/admin/courses', error.message, 'error'); }
  }

  const toggleCourseMatch = pathname.match(/^\/admin\/courses\/(\d+)\/toggle$/);
  if (toggleCourseMatch && req.method === 'POST') {
    const body = await parseBody(req);
    if (!validCsrf(req, session, body)) return renderError(res, session, url, 403, 'Request Rejected', 'The security token is missing or expired.');
    try { db.setCourseActive(Number(toggleCourseMatch[1]), body.active === '1', session.user.id); return redirectMessage(res, '/admin/courses', body.active === '1' ? 'Course activated.' : 'Course deactivated.', 'success'); }
    catch (error) { return redirectMessage(res, '/admin/courses', error.message, 'error'); }
  }

  if (pathname === '/admin/reports' && req.method === 'GET') {
    const complianceRows = db.getComplianceRows();
    const completions = db.getCompletionReport({});
    const certificates = db.listCertificates({});
    return renderPage(res, session, url, 'Reports & Records', views.adminReportsPage({ complianceRows, completions, certificates }));
  }

  if (pathname === '/admin/reports/completions.csv' && req.method === 'GET') {
    const rows = db.getCompletionReport({});
    const header = ['Completed At','Employee','Username','Employee Number','Department','Job Title','Type','Title','Category','Score','Points'];
    const lines = [header, ...rows.map(row => [row.completed_at,row.full_name,row.username,row.employee_number,row.department,row.job_title,row.item_type,row.title,row.category,row.score,row.points])];
    return sendText(res, lines.map(row => row.map(csvEscape).join(',')).join('\r\n'), 'text/csv; charset=utf-8', 200, `rainbow-lms-completions-${nowIso().slice(0,10)}.csv`);
  }

  if (pathname === '/admin/reports/compliance.csv' && req.method === 'GET') {
    const rows = db.getComplianceRows();
    const header = ['Employee','Employee Number','Department','Job Title','Assigned Courses','Current Completed','Overdue','Expired'];
    const lines = [header, ...rows.map(row => [row.full_name,row.employee_number,row.department,row.job_title,row.assigned,row.current_completed,row.overdue,row.expired])];
    return sendText(res, lines.map(row => row.map(csvEscape).join(',')).join('\r\n'), 'text/csv; charset=utf-8', 200, `rainbow-lms-compliance-${nowIso().slice(0,10)}.csv`);
  }

  if (pathname === '/admin/audit' && req.method === 'GET') {
    return renderPage(res, session, url, 'Audit Log', views.auditPage({ rows: db.listAudit(500) }));
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  try {
    if (serveStatic(req, res, url.pathname)) return;
    if (url.pathname === '/healthz') return sendJson(res, { ok: true, application: 'Rainbow Restoration LMS', database: path.basename(DB_PATH), time: nowIso() });
    if (url.pathname === '/login') return await handleLogin(req, res, url);

    const session = requireAuth(req, res, url);
    if (!session) return;

    if (url.pathname.startsWith('/admin')) {
      if (session.user.account_role !== 'admin') return renderError(res, session, url, 403, 'Administrator Access Required', 'This page is limited to active LMS administrators.');
      const handled = await handleAdmin(req, res, url, session);
      if (handled !== false) return;
    }

    const handled = await handleAuthenticated(req, res, url, session);
    if (handled !== false) return;
    return renderError(res, session, url, 404, 'Page Not Found', 'The requested LMS page does not exist.');
  } catch (error) {
    console.error(`[${new Date().toISOString()}]`, req.method, url.pathname, error.stack || error);
    const session = authenticate(req);
    return renderError(res, session, url, 500, 'Application Error', process.env.NODE_ENV === 'production' ? 'The request could not be completed.' : error.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Rainbow Restoration LMS running at http://${HOST}:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

function shutdown(signal) {
  console.log(`\n${signal} received. Closing Rainbow Restoration LMS.`);
  server.close(() => {
    try { db.close(); } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
