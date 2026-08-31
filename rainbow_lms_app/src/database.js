'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword, randomToken } = require('./security');
const {
  addMonthsIso,
  addRecurrenceIso,
  getPeriodRange,
  jsonParse,
  nowIso,
} = require('./utils');

const DEFAULT_TIME_ZONE = 'America/New_York';

function normalizeUser(row) {
  if (!row) return null;
  return {
    ...row,
    active: Boolean(row.active),
    must_change_password: Boolean(row.must_change_password),
    training_roles: jsonParse(row.training_roles_json, []),
  };
}

function normalizeCourse(row) {
  if (!row) return null;
  const content = jsonParse(row.content_json, {});
  return {
    ...row,
    active: Boolean(row.active),
    required_by_default: Boolean(row.required_by_default),
    required_roles: jsonParse(row.required_roles_json, []),
    tags: jsonParse(row.tags_json, []),
    objectives: content.objectives || [],
    lessons: content.lessons || [],
    quiz: content.quiz || [],
  };
}

function normalizeAssignment(row) {
  if (!row) return null;
  return {
    ...row,
    required: Boolean(row.required),
    progress: jsonParse(row.progress_json, { lessons: [] }),
  };
}

class LMSDatabase {
  constructor(dbPath, catalogPath, options = {}) {
    this.dbPath = dbPath;
    this.catalogPath = catalogPath;
    this.timeZone = options.timeZone || DEFAULT_TIME_ZONE;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.migrate();
    this.syncCatalog();
    this.seed(options);
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        employee_number TEXT,
        department TEXT,
        job_title TEXT,
        account_role TEXT NOT NULL CHECK(account_role IN ('admin','employee')),
        training_roles_json TEXT NOT NULL DEFAULT '[]',
        hire_date TEXT,
        manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT NOT NULL UNIQUE,
        csrf_token TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT
      );

      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        estimated_minutes INTEGER NOT NULL DEFAULT 30,
        passing_score INTEGER NOT NULL DEFAULT 80,
        renewal_months INTEGER NOT NULL DEFAULT 0,
        points INTEGER NOT NULL DEFAULT 50,
        required_by_default INTEGER NOT NULL DEFAULT 0,
        required_roles_json TEXT NOT NULL DEFAULT '[]',
        regulatory_basis TEXT,
        credential_warning TEXT,
        reviewed_on TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        delivery_type TEXT NOT NULL DEFAULT 'native' CHECK(delivery_type IN ('native','legacy')),
        legacy_path TEXT,
        content_json TEXT NOT NULL DEFAULT '{}',
        source TEXT NOT NULL DEFAULT 'catalog',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS course_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TEXT NOT NULL,
        due_at TEXT,
        required INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','in_progress','completed')),
        progress_json TEXT NOT NULL DEFAULT '{"lessons":[]}',
        score INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        started_at TEXT,
        completed_at TEXT,
        expires_at TEXT,
        last_activity_at TEXT,
        cycle INTEGER NOT NULL DEFAULT 1,
        UNIQUE(user_id, course_id)
      );

      CREATE TABLE IF NOT EXISTS task_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'General',
        points INTEGER NOT NULL DEFAULT 10,
        recurrence TEXT NOT NULL DEFAULT 'none' CHECK(recurrence IN ('none','daily','weekly','monthly','yearly')),
        requires_approval INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TEXT NOT NULL,
        due_at TEXT,
        status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','in_progress','submitted','completed','rejected')),
        employee_notes TEXT,
        evidence_reference TEXT,
        submitted_at TEXT,
        completed_at TEXT,
        approved_at TEXT,
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        rejection_note TEXT,
        recurrence_parent_id INTEGER REFERENCES task_assignments(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS completion_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL CHECK(item_type IN ('course','task')),
        item_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT,
        points INTEGER NOT NULL DEFAULT 0,
        score INTEGER,
        completed_at TEXT NOT NULL,
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        certificate_number TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        assignment_id INTEGER NOT NULL REFERENCES course_assignments(id) ON DELETE CASCADE,
        cycle INTEGER NOT NULL,
        score INTEGER NOT NULL,
        issued_at TEXT NOT NULL,
        expires_at TEXT,
        external_certificate_number TEXT,
        revoked_at TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        details_json TEXT NOT NULL DEFAULT '{}',
        ip_address TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_course_assignments_user ON course_assignments(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_course_assignments_due ON course_assignments(due_at);
      CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_task_assignments_due ON task_assignments(due_at);
      CREATE INDEX IF NOT EXISTS idx_completion_events_period ON completion_events(completed_at, user_id);
      CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id, issued_at);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
    `);
  }

  syncCatalog() {
    const catalog = JSON.parse(fs.readFileSync(this.catalogPath, 'utf8'));
    const courses = Array.isArray(catalog) ? catalog : catalog.courses;
    const now = nowIso();
    const upsert = this.db.prepare(`
      INSERT INTO courses (
        slug,title,category,description,estimated_minutes,passing_score,renewal_months,points,
        required_by_default,required_roles_json,regulatory_basis,credential_warning,reviewed_on,
        tags_json,delivery_type,legacy_path,content_json,source,active,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'catalog',?,?,?)
      ON CONFLICT(slug) DO UPDATE SET
        title=excluded.title,
        category=excluded.category,
        description=excluded.description,
        estimated_minutes=excluded.estimated_minutes,
        passing_score=excluded.passing_score,
        renewal_months=excluded.renewal_months,
        points=excluded.points,
        required_by_default=excluded.required_by_default,
        required_roles_json=excluded.required_roles_json,
        regulatory_basis=excluded.regulatory_basis,
        credential_warning=excluded.credential_warning,
        reviewed_on=excluded.reviewed_on,
        tags_json=excluded.tags_json,
        delivery_type=excluded.delivery_type,
        legacy_path=excluded.legacy_path,
        content_json=excluded.content_json,
        active=excluded.active,
        updated_at=excluded.updated_at
    `);
    this.transaction(() => {
      for (const course of courses) {
        upsert.run(
          course.slug,
          course.title,
          course.category,
          course.description,
          Number(course.estimatedMinutes || 30),
          Number(course.passingScore || 80),
          Number(course.renewalMonths || 0),
          Number(course.points || 50),
          course.requiredByDefault ? 1 : 0,
          JSON.stringify(course.requiredRoles || []),
          course.regulatoryBasis || '',
          course.credentialWarning || '',
          course.reviewedOn || catalog.reviewedOn || '',
          JSON.stringify(course.tags || []),
          course.deliveryType || 'native',
          course.legacyPath || null,
          JSON.stringify({
            objectives: course.objectives || [],
            lessons: course.lessons || [],
            quiz: course.quiz || [],
          }),
          course.active === false ? 0 : 1,
          now,
          now,
        );
      }
    });
    this.setSetting('catalog_reviewed_on', catalog.reviewedOn || '');
  }

  seed(options = {}) {
    const existing = this.db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    if (existing > 0) return;
    const adminUsername = options.adminUsername || process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = options.adminPassword || process.env.ADMIN_PASSWORD || 'RainbowAdmin!2026';
    const employeeUsername = options.employeeUsername || process.env.DEMO_EMPLOYEE_USERNAME || 'employee';
    const employeePassword = options.employeePassword || process.env.DEMO_EMPLOYEE_PASSWORD || 'RainbowEmployee!2026';

    const admin = this.createUser({
      username: adminUsername,
      password: adminPassword,
      fullName: 'Rainbow LMS Administrator',
      email: '',
      employeeNumber: 'ADMIN-001',
      department: 'Administration',
      jobTitle: 'Program Administrator',
      accountRole: 'admin',
      trainingRoles: ['admin', 'supervisor'],
      mustChangePassword: false,
      autoAssign: false,
      actorId: null,
    });

    const employee = this.createUser({
      username: employeeUsername,
      password: employeePassword,
      fullName: 'Demo Restoration Technician',
      email: '',
      employeeNumber: 'DEMO-001',
      department: 'Mitigation',
      jobTitle: 'Restoration Technician',
      accountRole: 'employee',
      trainingRoles: ['water', 'fire', 'mold', 'contents', 'driver', 'respirator'],
      mustChangePassword: false,
      autoAssign: true,
      actorId: admin.id,
    });

    const templates = [
      ['Daily vehicle and equipment inspection', 'Complete and document the pre-trip vehicle and restoration equipment inspection before dispatch.', 'Daily Operations', 10, 'daily', 0],
      ['Moisture meter field demonstration', 'Demonstrate correct pin, non-invasive, reference-reading, and documentation technique to a supervisor.', 'Competency', 25, 'none', 1],
      ['Weekly safety meeting acknowledgment', 'Review the weekly safety topic and acknowledge participation.', 'Safety', 15, 'weekly', 0],
      ['Upload complete daily job documentation', 'Confirm daily photos, moisture readings, equipment changes, and notes are uploaded to the approved job systems.', 'Documentation', 15, 'none', 0],
    ];
    const templateIds = [];
    for (const [title, description, category, points, recurrence, requiresApproval] of templates) {
      const result = this.db.prepare(`
        INSERT INTO task_templates(title,description,category,points,recurrence,requires_approval,created_by,active,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,1,?,?)
      `).run(title, description, category, points, recurrence, requiresApproval, admin.id, nowIso(), nowIso());
      templateIds.push(Number(result.lastInsertRowid));
    }
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const week = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    this.assignTask({ taskId: templateIds[0], userId: employee.id, assignedBy: admin.id, dueAt: tomorrow });
    this.assignTask({ taskId: templateIds[1], userId: employee.id, assignedBy: admin.id, dueAt: week });
    this.assignTask({ taskId: templateIds[2], userId: employee.id, assignedBy: admin.id, dueAt: week });
    this.assignTask({ taskId: templateIds[3], userId: employee.id, assignedBy: admin.id, dueAt: tomorrow });

    this.audit(admin.id, 'system.seeded', 'system', 'initial', {
      adminUsername,
      employeeUsername,
      courseCount: this.db.prepare('SELECT COUNT(*) AS count FROM courses').get().count,
    });
  }

  transaction(callback) {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const value = callback();
      this.db.exec('COMMIT;');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  close() {
    this.db.close();
  }

  setSetting(key, value) {
    this.db.prepare(`
      INSERT INTO settings(key,value,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `).run(key, String(value ?? ''), nowIso());
  }

  getSetting(key, fallback = '') {
    const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key);
    return row ? row.value : fallback;
  }

  audit(actorId, action, targetType, targetId, details = {}, ipAddress = '') {
    this.db.prepare(`
      INSERT INTO audit_log(actor_user_id,action,target_type,target_id,details_json,ip_address,created_at)
      VALUES(?,?,?,?,?,?,?)
    `).run(actorId || null, action, targetType || null, targetId === undefined ? null : String(targetId), JSON.stringify(details || {}), ipAddress || null, nowIso());
  }

  listAudit(limit = 250) {
    return this.db.prepare(`
      SELECT a.*, u.full_name AS actor_name, u.username AS actor_username
      FROM audit_log a LEFT JOIN users u ON u.id=a.actor_user_id
      ORDER BY a.created_at DESC LIMIT ?
    `).all(Number(limit));
  }

  createUser(input) {
    const timestamp = nowIso();
    const username = String(input.username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('Username must be 3–40 characters and use only letters, numbers, periods, underscores, or hyphens.');
    if (!String(input.fullName || '').trim()) throw new Error('Full name is required.');
    const role = input.accountRole === 'admin' ? 'admin' : 'employee';
    if (this.getUserByUsername(username)) throw new Error('That username is already in use.');
    const trainingRoles = [...new Set((input.trainingRoles || []).map(String).filter(Boolean))];
    const result = this.db.prepare(`
      INSERT INTO users(
        username,password_hash,full_name,email,employee_number,department,job_title,account_role,
        training_roles_json,hire_date,manager_id,active,must_change_password,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      username,
      hashPassword(input.password),
      String(input.fullName).trim(),
      String(input.email || '').trim() || null,
      String(input.employeeNumber || '').trim() || null,
      String(input.department || '').trim() || null,
      String(input.jobTitle || '').trim() || null,
      role,
      JSON.stringify(trainingRoles),
      String(input.hireDate || '').trim() || null,
      input.managerId ? Number(input.managerId) : null,
      input.active === false ? 0 : 1,
      input.mustChangePassword === false ? 0 : 1,
      timestamp,
      timestamp,
    );
    const user = this.getUser(Number(result.lastInsertRowid));
    if (input.autoAssign !== false && role === 'employee') this.assignRequiredCoursesForUser(user.id, input.actorId || null);
    this.audit(input.actorId || null, 'user.created', 'user', user.id, { username, accountRole: role, trainingRoles });
    return user;
  }

  updateUser(id, input, actorId) {
    const current = this.getUser(id);
    if (!current) throw new Error('Employee account not found.');
    const username = String(input.username ?? current.username).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('Username must be 3–40 characters and use only letters, numbers, periods, underscores, or hyphens.');
    const role = input.accountRole === 'admin' ? 'admin' : 'employee';
    if (!String(input.fullName || '').trim()) throw new Error('Full name is required.');
    const duplicate = this.getUserByUsername(username);
    if (duplicate && duplicate.id !== Number(id)) throw new Error('That username is already in use.');
    if (current.account_role === 'admin' && role !== 'admin' && current.active) {
      const activeAdmins = this.db.prepare("SELECT COUNT(*) AS count FROM users WHERE account_role='admin' AND active=1").get().count;
      if (activeAdmins <= 1) throw new Error('The final active administrator cannot be changed to an employee account.');
    }
    const trainingRoles = [...new Set((input.trainingRoles || []).map(String).filter(Boolean))];
    this.db.prepare(`
      UPDATE users SET username=?,full_name=?,email=?,employee_number=?,department=?,job_title=?,account_role=?,
        training_roles_json=?,hire_date=?,manager_id=?,updated_at=? WHERE id=?
    `).run(
      username,
      String(input.fullName || '').trim(),
      String(input.email || '').trim() || null,
      String(input.employeeNumber || '').trim() || null,
      String(input.department || '').trim() || null,
      String(input.jobTitle || '').trim() || null,
      role,
      JSON.stringify(trainingRoles),
      String(input.hireDate || '').trim() || null,
      input.managerId ? Number(input.managerId) : null,
      nowIso(),
      Number(id),
    );
    if (input.assignRequired) this.assignRequiredCoursesForUser(Number(id), actorId);
    this.audit(actorId, 'user.updated', 'user', id, { username, role, trainingRoles });
    return this.getUser(id);
  }

  getUser(id) {
    return normalizeUser(this.db.prepare('SELECT * FROM users WHERE id=?').get(Number(id)));
  }

  getUserByUsername(username) {
    return normalizeUser(this.db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').get(String(username || '').trim()));
  }

  listUsers({ includeInactive = true, accountRole = null } = {}) {
    const where = [];
    const args = [];
    if (!includeInactive) where.push('u.active=1');
    if (accountRole) { where.push('u.account_role=?'); args.push(accountRole); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.prepare(`
      SELECT u.*,
        (SELECT COUNT(*) FROM course_assignments ca WHERE ca.user_id=u.id) AS assigned_courses,
        (SELECT COUNT(*) FROM course_assignments ca WHERE ca.user_id=u.id AND ca.status='completed') AS completed_courses,
        (SELECT COUNT(*) FROM task_assignments ta WHERE ta.user_id=u.id AND ta.status IN ('assigned','in_progress','submitted','rejected')) AS open_tasks
      FROM users u ${clause}
      ORDER BY u.active DESC, u.full_name COLLATE NOCASE
    `).all(...args).map(normalizeUser);
  }

  setUserActive(id, active, actorId) {
    const user = this.getUser(id);
    if (!user) throw new Error('Account not found.');
    if (!active && user.account_role === 'admin') {
      const activeAdmins = this.db.prepare("SELECT COUNT(*) AS count FROM users WHERE account_role='admin' AND active=1").get().count;
      if (activeAdmins <= 1) throw new Error('The final active administrator cannot be deactivated.');
    }
    this.db.prepare('UPDATE users SET active=?,updated_at=? WHERE id=?').run(active ? 1 : 0, nowIso(), Number(id));
    if (!active) this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(Number(id));
    this.audit(actorId, active ? 'user.activated' : 'user.deactivated', 'user', id, { username: user.username });
  }

  resetPassword(id, password, actorId, mustChange = true) {
    const user = this.getUser(id);
    if (!user) throw new Error('Account not found.');
    this.db.prepare('UPDATE users SET password_hash=?,must_change_password=?,updated_at=? WHERE id=?')
      .run(hashPassword(password), mustChange ? 1 : 0, nowIso(), Number(id));
    this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(Number(id));
    this.audit(actorId, 'user.password_reset', 'user', id, { username: user.username, mustChange });
  }

  changePassword(id, password) {
    this.db.prepare('UPDATE users SET password_hash=?,must_change_password=0,updated_at=? WHERE id=?')
      .run(hashPassword(password), nowIso(), Number(id));
    this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(Number(id));
    this.audit(id, 'user.password_changed', 'user', id, {});
  }

  createSession(userId, tokenHash, csrfToken, expiresAt, metadata = {}) {
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO sessions(token_hash,csrf_token,user_id,created_at,expires_at,last_seen_at,ip_address,user_agent)
      VALUES(?,?,?,?,?,?,?,?)
    `).run(tokenHash, csrfToken, Number(userId), timestamp, expiresAt, timestamp, metadata.ipAddress || null, metadata.userAgent || null);
  }

  getSession(tokenHash) {
    const row = this.db.prepare(`
      SELECT s.id AS session_id,s.csrf_token,s.expires_at,s.last_seen_at,
        u.*
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at>? AND u.active=1
    `).get(tokenHash, nowIso());
    if (!row) return null;
    if (Date.now() - new Date(row.last_seen_at).getTime() > 5 * 60 * 1000) {
      this.db.prepare('UPDATE sessions SET last_seen_at=? WHERE id=?').run(nowIso(), row.session_id);
    }
    return { sessionId: row.session_id, csrfToken: row.csrf_token, expiresAt: row.expires_at, user: normalizeUser(row) };
  }

  deleteSession(tokenHash) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);
  }

  cleanupSessions() {
    this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(nowIso());
  }

  recordLogin(userId) {
    this.db.prepare('UPDATE users SET last_login_at=?,updated_at=? WHERE id=?').run(nowIso(), nowIso(), Number(userId));
  }

  listCourses({ category = null, search = '', activeOnly = true } = {}) {
    const where = [];
    const args = [];
    if (activeOnly) where.push('c.active=1');
    if (category) { where.push('c.category=?'); args.push(category); }
    if (search) { where.push('(c.title LIKE ? OR c.description LIKE ? OR c.tags_json LIKE ?)'); const q = `%${search}%`; args.push(q, q, q); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.prepare(`SELECT c.* FROM courses c ${clause} ORDER BY c.category,c.title COLLATE NOCASE`).all(...args).map(normalizeCourse);
  }

  getCourse(idOrSlug) {
    const isNumeric = /^\d+$/.test(String(idOrSlug));
    const row = isNumeric
      ? this.db.prepare('SELECT * FROM courses WHERE id=?').get(Number(idOrSlug))
      : this.db.prepare('SELECT * FROM courses WHERE slug=?').get(String(idOrSlug));
    return normalizeCourse(row);
  }

  getCategories() {
    return this.db.prepare('SELECT category,COUNT(*) AS course_count FROM courses WHERE active=1 GROUP BY category ORDER BY category').all();
  }

  createCustomCourse(input, actorId) {
    const timestamp = nowIso();
    if (!String(input.title || '').trim()) throw new Error('Course title is required.');
    if (!String(input.description || '').trim()) throw new Error('Course description is required.');
    const slugBase = String(input.slug || input.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || `custom-${Date.now()}`;
    let slug = slugBase;
    let suffix = 2;
    while (this.getCourse(slug)) { slug = `${slugBase}-${suffix}`; suffix += 1; }
    const options = (input.options || []).map(String).filter(Boolean).slice(0, 6);
    const answer = Math.max(0, Math.min(options.length - 1, Number(input.answer || 0)));
    const lessons = [{
      title: String(input.lessonTitle || 'Course Content').trim(),
      summary: String(input.description || '').trim(),
      bullets: String(input.lessonBody || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean),
      callout: String(input.callout || '').trim(),
    }];
    const quiz = options.length >= 2 && input.question ? [{
      question: String(input.question).trim(),
      options,
      answer,
      rationale: String(input.rationale || '').trim(),
      critical: Boolean(input.critical),
    }] : [];
    const result = this.db.prepare(`
      INSERT INTO courses(slug,title,category,description,estimated_minutes,passing_score,renewal_months,points,
        required_by_default,required_roles_json,regulatory_basis,credential_warning,reviewed_on,tags_json,
        delivery_type,legacy_path,content_json,source,active,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,0,?,?,?,?,?,'native',NULL,?,'custom',1,?,?)
    `).run(
      slug,
      String(input.title || '').trim(),
      String(input.category || 'Company Training').trim(),
      String(input.description || '').trim(),
      Number(input.estimatedMinutes || 30),
      Number(input.passingScore || 80),
      Number(input.renewalMonths || 0),
      Number(input.points || 25),
      JSON.stringify(input.requiredRoles || []),
      String(input.regulatoryBasis || '').trim(),
      String(input.credentialWarning || 'Internal company training.').trim(),
      timestamp.slice(0, 10),
      JSON.stringify(['custom']),
      JSON.stringify({ objectives: [], lessons, quiz }),
      timestamp,
      timestamp,
    );
    this.audit(actorId, 'course.created', 'course', result.lastInsertRowid, { slug, title: input.title });
    return this.getCourse(Number(result.lastInsertRowid));
  }

  setCourseActive(courseId, active, actorId) {
    this.db.prepare('UPDATE courses SET active=?,updated_at=? WHERE id=?').run(active ? 1 : 0, nowIso(), Number(courseId));
    this.audit(actorId, active ? 'course.activated' : 'course.deactivated', 'course', courseId, {});
  }

  assignRequiredCoursesForUser(userId, assignedBy = null) {
    const user = this.getUser(userId);
    if (!user || user.account_role !== 'employee') return 0;
    const courses = this.listCourses().filter(course => {
      if (!course.required_by_default) return false;
      const roles = course.required_roles;
      return roles.includes('all') || roles.some(role => user.training_roles.includes(role));
    });
    let count = 0;
    const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    for (const course of courses) {
      const result = this.assignCourse({ userId, courseId: course.id, assignedBy, dueAt: due, required: true, preserveExisting: true });
      if (result.created) count += 1;
    }
    return count;
  }

  assignCourse({ userId, courseId, assignedBy = null, dueAt = null, required = true, preserveExisting = true }) {
    const user = this.getUser(userId);
    const course = this.getCourse(courseId);
    if (!user || !course) throw new Error('Employee or course not found.');
    const existing = this.db.prepare('SELECT * FROM course_assignments WHERE user_id=? AND course_id=?').get(Number(userId), Number(courseId));
    if (existing) {
      if (!preserveExisting || existing.status !== 'completed') {
        this.db.prepare('UPDATE course_assignments SET due_at=COALESCE(?,due_at),required=?,assigned_by=COALESCE(?,assigned_by),last_activity_at=? WHERE id=?')
          .run(dueAt, required ? 1 : 0, assignedBy, nowIso(), existing.id);
      }
      return { created: false, assignment: this.getCourseAssignment(existing.id) };
    }
    const timestamp = nowIso();
    const result = this.db.prepare(`
      INSERT INTO course_assignments(user_id,course_id,assigned_by,assigned_at,due_at,required,status,progress_json,last_activity_at)
      VALUES(?,?,?,?,?,?,'assigned','{"lessons":[]}',?)
    `).run(Number(userId), Number(courseId), assignedBy || null, timestamp, dueAt || null, required ? 1 : 0, timestamp);
    this.audit(assignedBy, 'course.assigned', 'course_assignment', result.lastInsertRowid, { userId, courseId, dueAt, required });
    return { created: true, assignment: this.getCourseAssignment(Number(result.lastInsertRowid)) };
  }

  bulkAssignCourses({ userIds, courseIds, assignedBy, dueAt = null, required = true }) {
    let created = 0;
    let existing = 0;
    this.transaction(() => {
      for (const userId of userIds) {
        for (const courseId of courseIds) {
          const result = this.assignCourse({ userId, courseId, assignedBy, dueAt, required, preserveExisting: true });
          if (result.created) created += 1; else existing += 1;
        }
      }
    });
    return { created, existing };
  }

  getCourseAssignment(id, userId = null) {
    const args = [Number(id)];
    let userFilter = '';
    if (userId) { userFilter = ' AND ca.user_id=?'; args.push(Number(userId)); }
    const row = this.db.prepare(`
      SELECT ca.*,c.slug,c.title,c.category,c.description,c.estimated_minutes,c.passing_score,c.renewal_months,c.points,
        c.regulatory_basis,c.credential_warning,c.delivery_type,c.legacy_path,c.content_json,c.reviewed_on,
        u.full_name AS employee_name,u.username AS employee_username,u.employee_number,
        a.full_name AS assigned_by_name
      FROM course_assignments ca
      JOIN courses c ON c.id=ca.course_id
      JOIN users u ON u.id=ca.user_id
      LEFT JOIN users a ON a.id=ca.assigned_by
      WHERE ca.id=?${userFilter}
    `).get(...args);
    if (!row) return null;
    const course = normalizeCourse(row);
    return { ...normalizeAssignment(row), ...course, assignment_id: row.id, course_id: row.course_id, id: row.id };
  }

  listCourseAssignments({ userId = null, status = null, includeInactiveUsers = false, search = '' } = {}) {
    const where = [];
    const args = [];
    if (userId) { where.push('ca.user_id=?'); args.push(Number(userId)); }
    if (status) { where.push('ca.status=?'); args.push(status); }
    if (!includeInactiveUsers) where.push('u.active=1');
    if (search) { const q = `%${search}%`; where.push('(u.full_name LIKE ? OR u.username LIKE ? OR c.title LIKE ?)'); args.push(q, q, q); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.prepare(`
      SELECT ca.*,c.title,c.slug,c.category,c.description,c.estimated_minutes,c.passing_score,c.points,c.delivery_type,c.renewal_months,
        c.content_json,c.regulatory_basis,c.credential_warning,c.reviewed_on,
        u.full_name AS employee_name,u.username AS employee_username,u.employee_number,
        a.full_name AS assigned_by_name
      FROM course_assignments ca
      JOIN courses c ON c.id=ca.course_id
      JOIN users u ON u.id=ca.user_id
      LEFT JOIN users a ON a.id=ca.assigned_by
      ${clause}
      ORDER BY CASE ca.status WHEN 'in_progress' THEN 0 WHEN 'assigned' THEN 1 ELSE 2 END,
        COALESCE(ca.due_at,'9999-12-31'),c.title
    `).all(...args).map(row => {
      const content = jsonParse(row.content_json, {});
      return { ...normalizeAssignment(row), objectives: content.objectives || [], lessons: content.lessons || [], quiz: content.quiz || [] };
    });
  }

  startCourseAssignment(id, userId) {
    const assignment = this.getCourseAssignment(id, userId);
    if (!assignment) throw new Error('Course assignment not found.');
    if (assignment.status === 'assigned') {
      this.db.prepare("UPDATE course_assignments SET status='in_progress',started_at=?,last_activity_at=? WHERE id=?")
        .run(nowIso(), nowIso(), Number(id));
    } else {
      this.db.prepare('UPDATE course_assignments SET last_activity_at=? WHERE id=?').run(nowIso(), Number(id));
    }
    return this.getCourseAssignment(id, userId);
  }

  completeLesson(assignmentId, userId, lessonIndex) {
    const assignment = this.startCourseAssignment(assignmentId, userId);
    if (assignment.delivery_type !== 'native') throw new Error('Lesson tracking is managed by the interactive course.');
    if (lessonIndex < 0 || lessonIndex >= assignment.lessons.length) throw new Error('Lesson not found.');
    const progress = assignment.progress || { lessons: [] };
    const completed = new Set((progress.lessons || []).map(Number));
    completed.add(Number(lessonIndex));
    progress.lessons = [...completed].sort((a, b) => a - b);
    this.db.prepare('UPDATE course_assignments SET progress_json=?,last_activity_at=? WHERE id=?')
      .run(JSON.stringify(progress), nowIso(), Number(assignmentId));
    this.audit(userId, 'course.lesson_completed', 'course_assignment', assignmentId, { lessonIndex });
    return this.getCourseAssignment(assignmentId, userId);
  }

  gradeNativeCourse(assignmentId, userId, answers) {
    const assignment = this.startCourseAssignment(assignmentId, userId);
    if (assignment.delivery_type !== 'native') throw new Error('This assessment is completed inside the interactive module.');
    const completedLessons = new Set((assignment.progress?.lessons || []).map(Number));
    if (assignment.lessons.some((_, index) => !completedLessons.has(index))) throw new Error('Complete every lesson before submitting the assessment.');
    const questions = assignment.quiz || [];
    if (!questions.length) {
      return this.completeCourseAssignment(assignmentId, userId, 100, null, { source: 'native-no-quiz' });
    }
    let correct = 0;
    let criticalMissed = 0;
    const results = [];
    questions.forEach((question, index) => {
      const selected = Number(answers[index]);
      const right = selected === Number(question.answer);
      if (right) correct += 1;
      if (question.critical && !right) criticalMissed += 1;
      results.push({ index, selected: Number.isFinite(selected) ? selected : null, correct: right });
    });
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= assignment.passing_score && criticalMissed === 0;
    const progress = assignment.progress || { lessons: [] };
    progress.lastQuiz = { score, correct, total: questions.length, criticalMissed, results, takenAt: nowIso() };
    this.db.prepare('UPDATE course_assignments SET progress_json=?,score=?,attempts=attempts+1,last_activity_at=? WHERE id=?')
      .run(JSON.stringify(progress), score, nowIso(), Number(assignmentId));
    this.audit(userId, 'course.assessment_submitted', 'course_assignment', assignmentId, { score, passed, criticalMissed });
    if (passed) return this.completeCourseAssignment(assignmentId, userId, score, null, { source: 'native' });
    return { passed: false, score, correct, total: questions.length, criticalMissed, assignment: this.getCourseAssignment(assignmentId, userId) };
  }

  makeCertificateNumber(assignment, issuedAt) {
    const date = issuedAt.slice(0, 10).replaceAll('-', '');
    const random = randomToken(5).replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase().padEnd(6, 'X');
    return `RR-LMS-${date}-${assignment.user_id}-${assignment.course_id}-${assignment.cycle}-${random}`;
  }

  completeCourseAssignment(assignmentId, userId, score, externalCertificateNumber = null, metadata = {}) {
    return this.transaction(() => {
      const assignment = this.getCourseAssignment(assignmentId, userId);
      if (!assignment) throw new Error('Course assignment not found.');
      if (assignment.status === 'completed') {
        const certificate = this.getCertificateByAssignment(assignmentId, assignment.cycle);
        return { passed: true, alreadyCompleted: true, score: assignment.score, assignment, certificate };
      }
      const normalizedScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
      if (normalizedScore < assignment.passing_score) throw new Error(`A score of at least ${assignment.passing_score}% is required.`);
      const issuedAt = nowIso();
      const expiresAt = addMonthsIso(issuedAt, assignment.renewal_months);
      this.db.prepare(`
        UPDATE course_assignments SET status='completed',score=?,completed_at=?,expires_at=?,last_activity_at=? WHERE id=?
      `).run(normalizedScore, issuedAt, expiresAt, issuedAt, Number(assignmentId));
      const certificateNumber = this.makeCertificateNumber(assignment, issuedAt);
      const certificateResult = this.db.prepare(`
        INSERT INTO certificates(certificate_number,user_id,course_id,assignment_id,cycle,score,issued_at,expires_at,external_certificate_number,metadata_json)
        VALUES(?,?,?,?,?,?,?,?,?,?)
      `).run(certificateNumber, assignment.user_id, assignment.course_id, assignment.id, assignment.cycle, normalizedScore, issuedAt, expiresAt, externalCertificateNumber || null, JSON.stringify(metadata || {}));
      this.db.prepare(`
        INSERT OR IGNORE INTO completion_events(event_key,user_id,item_type,item_id,title,category,points,score,completed_at)
        VALUES(?,?,'course',?,?,?,?,?,?)
      `).run(`course:${assignment.id}:${assignment.cycle}`, assignment.user_id, assignment.course_id, assignment.title, assignment.category, assignment.points, normalizedScore, issuedAt);
      this.audit(userId, 'course.completed', 'course_assignment', assignmentId, { score: normalizedScore, certificateNumber, source: metadata.source || 'unknown' });
      return {
        passed: true,
        score: normalizedScore,
        assignment: this.getCourseAssignment(assignmentId, userId),
        certificate: this.getCertificate(Number(certificateResult.lastInsertRowid)),
      };
    });
  }

  resetCourseAssignment(assignmentId, actorId) {
    const assignment = this.getCourseAssignment(assignmentId);
    if (!assignment) throw new Error('Course assignment not found.');
    this.db.prepare(`
      UPDATE course_assignments SET status='assigned',progress_json='{"lessons":[]}',score=NULL,attempts=0,
        started_at=NULL,completed_at=NULL,expires_at=NULL,last_activity_at=?,cycle=cycle+1 WHERE id=?
    `).run(nowIso(), Number(assignmentId));
    this.audit(actorId, 'course.assignment_reset', 'course_assignment', assignmentId, { userId: assignment.user_id, courseId: assignment.course_id, previousCycle: assignment.cycle });
  }

  deleteCourseAssignment(assignmentId, actorId) {
    const assignment = this.getCourseAssignment(assignmentId);
    if (!assignment) throw new Error('Course assignment not found.');
    if (assignment.status === 'completed') throw new Error('Completed training records cannot be deleted. Reset or retain the record.');
    this.db.prepare('DELETE FROM course_assignments WHERE id=?').run(Number(assignmentId));
    this.audit(actorId, 'course.assignment_deleted', 'course_assignment', assignmentId, { userId: assignment.user_id, courseId: assignment.course_id });
  }

  getCertificate(id) {
    return this.db.prepare(`
      SELECT cert.*,u.full_name AS employee_name,u.employee_number,u.job_title,u.department,
        c.title AS course_title,c.category,c.regulatory_basis,c.credential_warning,c.renewal_months,
        a.full_name AS assigned_by_name
      FROM certificates cert
      JOIN users u ON u.id=cert.user_id
      JOIN courses c ON c.id=cert.course_id
      JOIN course_assignments ca ON ca.id=cert.assignment_id
      LEFT JOIN users a ON a.id=ca.assigned_by
      WHERE cert.id=?
    `).get(Number(id));
  }

  getCertificateByAssignment(assignmentId, cycle = null) {
    const clause = cycle ? 'AND cert.cycle=?' : '';
    const args = cycle ? [Number(assignmentId), Number(cycle)] : [Number(assignmentId)];
    const row = this.db.prepare(`SELECT cert.id FROM certificates cert WHERE cert.assignment_id=? ${clause} ORDER BY cert.issued_at DESC LIMIT 1`).get(...args);
    return row ? this.getCertificate(row.id) : null;
  }

  listCertificates({ userId = null, includeRevoked = false } = {}) {
    const where = [];
    const args = [];
    if (userId) { where.push('cert.user_id=?'); args.push(Number(userId)); }
    if (!includeRevoked) where.push('cert.revoked_at IS NULL');
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.prepare(`
      SELECT cert.*,u.full_name AS employee_name,u.employee_number,c.title AS course_title,c.category
      FROM certificates cert JOIN users u ON u.id=cert.user_id JOIN courses c ON c.id=cert.course_id
      ${clause} ORDER BY cert.issued_at DESC
    `).all(...args);
  }

  createTaskTemplate(input, actorId) {
    const timestamp = nowIso();
    const title = String(input.title || '').trim();
    if (!title) throw new Error('Task title is required.');
    const recurrence = ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(input.recurrence) ? input.recurrence : 'none';
    const result = this.db.prepare(`
      INSERT INTO task_templates(title,description,category,points,recurrence,requires_approval,created_by,active,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,1,?,?)
    `).run(title, String(input.description || '').trim(), String(input.category || 'General').trim(), Math.max(0, Number(input.points || 0)), recurrence, input.requiresApproval ? 1 : 0, actorId || null, timestamp, timestamp);
    this.audit(actorId, 'task.created', 'task_template', result.lastInsertRowid, { title, recurrence });
    return Number(result.lastInsertRowid);
  }

  listTaskTemplates({ activeOnly = true } = {}) {
    return this.db.prepare(`
      SELECT tt.*,u.full_name AS created_by_name,
        (SELECT COUNT(*) FROM task_assignments ta WHERE ta.task_id=tt.id) AS assignment_count
      FROM task_templates tt LEFT JOIN users u ON u.id=tt.created_by
      ${activeOnly ? 'WHERE tt.active=1' : ''}
      ORDER BY tt.active DESC,tt.category,tt.title COLLATE NOCASE
    `).all().map(row => ({ ...row, active: Boolean(row.active), requires_approval: Boolean(row.requires_approval) }));
  }

  getTaskTemplate(id) {
    const row = this.db.prepare('SELECT * FROM task_templates WHERE id=?').get(Number(id));
    return row ? { ...row, active: Boolean(row.active), requires_approval: Boolean(row.requires_approval) } : null;
  }

  setTaskTemplateActive(id, active, actorId) {
    this.db.prepare('UPDATE task_templates SET active=?,updated_at=? WHERE id=?').run(active ? 1 : 0, nowIso(), Number(id));
    this.audit(actorId, active ? 'task.activated' : 'task.deactivated', 'task_template', id, {});
  }

  assignTask({ taskId, userId, assignedBy = null, dueAt = null, recurrenceParentId = null }) {
    const task = this.getTaskTemplate(taskId);
    const user = this.getUser(userId);
    if (!task || !user) throw new Error('Task or employee not found.');
    const result = this.db.prepare(`
      INSERT INTO task_assignments(task_id,user_id,assigned_by,assigned_at,due_at,status,recurrence_parent_id)
      VALUES(?,?,?,?,?,'assigned',?)
    `).run(Number(taskId), Number(userId), assignedBy || null, nowIso(), dueAt || null, recurrenceParentId || null);
    this.audit(assignedBy, 'task.assigned', 'task_assignment', result.lastInsertRowid, { taskId, userId, dueAt });
    return Number(result.lastInsertRowid);
  }

  bulkAssignTask({ taskId, userIds, assignedBy, dueAt = null }) {
    const ids = [];
    this.transaction(() => {
      for (const userId of userIds) ids.push(this.assignTask({ taskId, userId, assignedBy, dueAt }));
    });
    return ids;
  }

  getTaskAssignment(id, userId = null) {
    const args = [Number(id)];
    const userClause = userId ? 'AND ta.user_id=?' : '';
    if (userId) args.push(Number(userId));
    const row = this.db.prepare(`
      SELECT ta.*,tt.title,tt.description,tt.category,tt.points,tt.recurrence,tt.requires_approval,
        u.full_name AS employee_name,u.username AS employee_username,u.employee_number,
        a.full_name AS assigned_by_name,ap.full_name AS approved_by_name
      FROM task_assignments ta
      JOIN task_templates tt ON tt.id=ta.task_id
      JOIN users u ON u.id=ta.user_id
      LEFT JOIN users a ON a.id=ta.assigned_by
      LEFT JOIN users ap ON ap.id=ta.approved_by
      WHERE ta.id=? ${userClause}
    `).get(...args);
    return row ? { ...row, requires_approval: Boolean(row.requires_approval) } : null;
  }

  listTaskAssignments({ userId = null, status = null, includeInactiveUsers = false } = {}) {
    const where = [];
    const args = [];
    if (userId) { where.push('ta.user_id=?'); args.push(Number(userId)); }
    if (status) { where.push('ta.status=?'); args.push(status); }
    if (!includeInactiveUsers) where.push('u.active=1');
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.prepare(`
      SELECT ta.*,tt.title,tt.description,tt.category,tt.points,tt.recurrence,tt.requires_approval,
        u.full_name AS employee_name,u.username AS employee_username,u.employee_number,
        a.full_name AS assigned_by_name,ap.full_name AS approved_by_name
      FROM task_assignments ta
      JOIN task_templates tt ON tt.id=ta.task_id
      JOIN users u ON u.id=ta.user_id
      LEFT JOIN users a ON a.id=ta.assigned_by
      LEFT JOIN users ap ON ap.id=ta.approved_by
      ${clause}
      ORDER BY CASE ta.status WHEN 'submitted' THEN 0 WHEN 'rejected' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'assigned' THEN 3 ELSE 4 END,
        COALESCE(ta.due_at,'9999-12-31'),tt.title
    `).all(...args).map(row => ({ ...row, requires_approval: Boolean(row.requires_approval) }));
  }

  submitTask(assignmentId, userId, input = {}) {
    const assignment = this.getTaskAssignment(assignmentId, userId);
    if (!assignment) throw new Error('Task assignment not found.');
    if (assignment.status === 'completed') return assignment;
    const timestamp = nowIso();
    if (assignment.requires_approval) {
      this.db.prepare(`
        UPDATE task_assignments SET status='submitted',employee_notes=?,evidence_reference=?,submitted_at=?,rejection_note=NULL WHERE id=?
      `).run(String(input.notes || '').trim() || null, String(input.evidence || '').trim() || null, timestamp, Number(assignmentId));
      this.audit(userId, 'task.submitted', 'task_assignment', assignmentId, { title: assignment.title });
    } else {
      this.db.prepare(`
        UPDATE task_assignments SET status='completed',employee_notes=?,evidence_reference=?,submitted_at=?,completed_at=?,approved_at=? WHERE id=?
      `).run(String(input.notes || '').trim() || null, String(input.evidence || '').trim() || null, timestamp, timestamp, timestamp, Number(assignmentId));
      this.recordTaskCompletion(assignment, userId, timestamp);
      this.createRecurringTask(assignment, timestamp);
      this.audit(userId, 'task.completed', 'task_assignment', assignmentId, { title: assignment.title });
    }
    return this.getTaskAssignment(assignmentId, userId);
  }

  approveTask(assignmentId, actorId) {
    const assignment = this.getTaskAssignment(assignmentId);
    if (!assignment) throw new Error('Task assignment not found.');
    if (assignment.status !== 'submitted') throw new Error('Only submitted tasks can be approved.');
    const timestamp = nowIso();
    this.db.prepare(`
      UPDATE task_assignments SET status='completed',completed_at=?,approved_at=?,approved_by=?,rejection_note=NULL WHERE id=?
    `).run(timestamp, timestamp, Number(actorId), Number(assignmentId));
    this.recordTaskCompletion(assignment, actorId, timestamp);
    this.createRecurringTask(assignment, timestamp);
    this.audit(actorId, 'task.approved', 'task_assignment', assignmentId, { userId: assignment.user_id, title: assignment.title });
  }

  rejectTask(assignmentId, actorId, note) {
    const assignment = this.getTaskAssignment(assignmentId);
    if (!assignment) throw new Error('Task assignment not found.');
    if (assignment.status !== 'submitted') throw new Error('Only submitted tasks can be returned for correction.');
    this.db.prepare(`
      UPDATE task_assignments SET status='rejected',rejection_note=?,approved_by=?,approved_at=? WHERE id=?
    `).run(String(note || '').trim() || 'Additional information or correction is required.', Number(actorId), nowIso(), Number(assignmentId));
    this.audit(actorId, 'task.rejected', 'task_assignment', assignmentId, { userId: assignment.user_id, note });
  }

  recordTaskCompletion(assignment, approvedBy, timestamp) {
    this.db.prepare(`
      INSERT OR IGNORE INTO completion_events(event_key,user_id,item_type,item_id,title,category,points,completed_at,approved_by)
      VALUES(?,?,'task',?,?,?,?,?,?)
    `).run(`task:${assignment.id}`, assignment.user_id, assignment.task_id, assignment.title, assignment.category, assignment.points, timestamp, approvedBy || null);
  }

  createRecurringTask(assignment, completionTime) {
    if (!assignment.recurrence || assignment.recurrence === 'none') return null;
    const base = assignment.due_at || completionTime;
    const dueAt = addRecurrenceIso(base, assignment.recurrence);
    if (!dueAt) return null;
    const existing = this.db.prepare(`
      SELECT id FROM task_assignments WHERE task_id=? AND user_id=? AND due_at=? AND status!='completed'
    `).get(assignment.task_id, assignment.user_id, dueAt);
    if (existing) return existing.id;
    return this.assignTask({
      taskId: assignment.task_id,
      userId: assignment.user_id,
      assignedBy: assignment.assigned_by,
      dueAt,
      recurrenceParentId: assignment.id,
    });
  }

  deleteTaskAssignment(id, actorId) {
    const assignment = this.getTaskAssignment(id);
    if (!assignment) throw new Error('Task assignment not found.');
    if (assignment.status === 'completed') throw new Error('Completed task records cannot be deleted.');
    this.db.prepare('DELETE FROM task_assignments WHERE id=?').run(Number(id));
    this.audit(actorId, 'task.assignment_deleted', 'task_assignment', id, { userId: assignment.user_id, title: assignment.title });
  }

  getLeaderboard(period = 'daily', limit = 100) {
    const range = getPeriodRange(period, this.timeZone);
    const rows = this.db.prepare(`
      SELECT u.id,u.full_name,u.department,u.job_title,
        COUNT(ce.id) AS total_completed,
        SUM(CASE WHEN ce.item_type='course' THEN 1 ELSE 0 END) AS courses_completed,
        SUM(CASE WHEN ce.item_type='task' THEN 1 ELSE 0 END) AS tasks_completed,
        COALESCE(SUM(ce.points),0) AS points,
        MAX(ce.completed_at) AS latest_completion
      FROM users u
      LEFT JOIN completion_events ce ON ce.user_id=u.id AND ce.completed_at>=? AND ce.completed_at<?
      WHERE u.active=1 AND u.account_role='employee'
      GROUP BY u.id
      HAVING COUNT(ce.id)>0
      ORDER BY points DESC,total_completed DESC,courses_completed DESC,latest_completion ASC,u.full_name ASC
      LIMIT ?
    `).all(range.start, range.end, Number(limit));
    let rank = 0;
    let priorKey = null;
    rows.forEach((row, index) => {
      const key = `${row.points}:${row.total_completed}:${row.courses_completed}`;
      if (key !== priorKey) rank = index + 1;
      row.rank = rank;
      priorKey = key;
    });
    return { ...range, rows };
  }

  getUserPoints(userId, period = 'yearly') {
    const range = getPeriodRange(period, this.timeZone);
    return this.db.prepare(`
      SELECT COUNT(*) AS completed,COALESCE(SUM(points),0) AS points
      FROM completion_events WHERE user_id=? AND completed_at>=? AND completed_at<?
    `).get(Number(userId), range.start, range.end);
  }

  getEmployeeDashboard(userId) {
    const now = nowIso();
    const courseStats = this.db.prepare(`
      SELECT COUNT(*) AS assigned,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status!='completed' AND due_at IS NOT NULL AND due_at<? THEN 1 ELSE 0 END) AS overdue
      FROM course_assignments WHERE user_id=?
    `).get(now, Number(userId));
    const taskStats = this.db.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='submitted' THEN 1 ELSE 0 END) AS submitted,
        SUM(CASE WHEN status!='completed' AND due_at IS NOT NULL AND due_at<? THEN 1 ELSE 0 END) AS overdue,
        SUM(CASE WHEN status IN ('assigned','in_progress','submitted','rejected') THEN 1 ELSE 0 END) AS open
      FROM task_assignments WHERE user_id=?
    `).get(now, Number(userId));
    const nextCourses = this.listCourseAssignments({ userId }).filter(a => a.status !== 'completed').slice(0, 6);
    const nextTasks = this.listTaskAssignments({ userId }).filter(a => a.status !== 'completed').slice(0, 6);
    const certificates = this.listCertificates({ userId }).slice(0, 4);
    const points = this.getUserPoints(userId, 'yearly');
    return { courseStats, taskStats, nextCourses, nextTasks, certificates, points };
  }

  getAdminDashboard() {
    const now = nowIso();
    const users = this.db.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN account_role='employee' AND active=1 THEN 1 ELSE 0 END) AS active_employees,
        SUM(CASE WHEN account_role='admin' AND active=1 THEN 1 ELSE 0 END) AS active_admins
      FROM users
    `).get();
    const courses = this.db.prepare(`
      SELECT COUNT(*) AS assignments,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status!='completed' AND due_at IS NOT NULL AND due_at<? THEN 1 ELSE 0 END) AS overdue
      FROM course_assignments
    `).get(now);
    const tasks = this.db.prepare(`
      SELECT COUNT(*) AS assignments,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='submitted' THEN 1 ELSE 0 END) AS pending_approval,
        SUM(CASE WHEN status!='completed' AND due_at IS NOT NULL AND due_at<? THEN 1 ELSE 0 END) AS overdue
      FROM task_assignments
    `).get(now);
    const expiring = this.db.prepare(`
      SELECT cert.*,u.full_name AS employee_name,c.title AS course_title
      FROM certificates cert JOIN users u ON u.id=cert.user_id JOIN courses c ON c.id=cert.course_id
      WHERE cert.revoked_at IS NULL AND cert.expires_at IS NOT NULL AND cert.expires_at>=? AND cert.expires_at<=?
      ORDER BY cert.expires_at LIMIT 10
    `).all(now, new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString());
    const recent = this.db.prepare(`
      SELECT ce.*,u.full_name FROM completion_events ce JOIN users u ON u.id=ce.user_id
      ORDER BY ce.completed_at DESC LIMIT 12
    `).all();
    const byCategory = this.db.prepare(`
      SELECT c.category,COUNT(ca.id) AS assigned,SUM(CASE WHEN ca.status='completed' THEN 1 ELSE 0 END) AS completed
      FROM courses c LEFT JOIN course_assignments ca ON ca.course_id=c.id
      WHERE c.active=1 GROUP BY c.category ORDER BY c.category
    `).all();
    return { users, courses, tasks, expiring, recent, byCategory };
  }

  getComplianceRows() {
    return this.db.prepare(`
      SELECT u.id,u.full_name,u.employee_number,u.department,u.job_title,
        COUNT(ca.id) AS assigned,
        SUM(CASE WHEN ca.status='completed' AND (ca.expires_at IS NULL OR ca.expires_at>=?) THEN 1 ELSE 0 END) AS current_completed,
        SUM(CASE WHEN ca.status!='completed' AND ca.due_at IS NOT NULL AND ca.due_at<? THEN 1 ELSE 0 END) AS overdue,
        SUM(CASE WHEN ca.status='completed' AND ca.expires_at IS NOT NULL AND ca.expires_at<? THEN 1 ELSE 0 END) AS expired
      FROM users u LEFT JOIN course_assignments ca ON ca.user_id=u.id
      WHERE u.active=1 AND u.account_role='employee'
      GROUP BY u.id ORDER BY u.full_name
    `).all(nowIso(), nowIso(), nowIso());
  }

  getCompletionReport({ start = null, end = null } = {}) {
    const where = [];
    const args = [];
    if (start) { where.push('ce.completed_at>=?'); args.push(start); }
    if (end) { where.push('ce.completed_at<?'); args.push(end); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.prepare(`
      SELECT ce.*,u.full_name,u.username,u.employee_number,u.department,u.job_title
      FROM completion_events ce JOIN users u ON u.id=ce.user_id
      ${clause} ORDER BY ce.completed_at DESC
    `).all(...args);
  }

  getCatalogStats() {
    return this.db.prepare(`
      SELECT COUNT(*) AS courses,COUNT(DISTINCT category) AS categories,
        SUM(CASE WHEN delivery_type='legacy' THEN 1 ELSE 0 END) AS interactive_legacy,
        SUM(CASE WHEN delivery_type='native' THEN 1 ELSE 0 END) AS native_courses
      FROM courses WHERE active=1
    `).get();
  }
}

function openDatabase({ dbPath, catalogPath, ...options }) {
  return new LMSDatabase(dbPath, catalogPath, options);
}

module.exports = { LMSDatabase, openDatabase, normalizeAssignment, normalizeCourse, normalizeUser };
