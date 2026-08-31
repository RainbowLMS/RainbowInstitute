# Rainbow Restoration Learning Management System

A ready-to-run, multi-user learning management application for **Rainbow Restoration of Greater Virginia**. The application is modeled after the supplied Water Mitigation New-Hire and Respiratory Protection interactive modules and extends that design into a central LMS with employee accounts, administrator controls, assignments, certificates, task approvals, audit history, and daily/weekly/monthly/yearly leaderboards.

## What is included

- Individual employee and administrator logins
- Secure scrypt password hashing, persistent database sessions, CSRF protection, login throttling, and role-based access control
- Administrator account creation, employee account creation, deactivation/reactivation, role updates, and password resets
- Bulk course assignment to one or many employees
- Role-based automatic assignment of required-by-default courses
- 96-course launch catalog with 376 native lessons and 470 assessment questions
- Two supplied full interactive courses embedded into the LMS:
  - Water Mitigation New-Hire Fundamentals
  - Respiratory Protection Interactive Training
- Account-isolated progress for each embedded interactive course
- Native LMS course player with lesson completion, knowledge assessment, critical-question gating, scores, and retraining cycles
- Operational and competency task creation, assignment, recurrence, evidence notes, approvals, rejection/correction workflow, and points
- Daily, weekly, monthly, and yearly completion leaderboards
- Certificates of completion with unique IDs, scores, issue dates, expiration dates, and printable PDF workflow
- Administrator dashboards, employee compliance summaries, completion reports, certificate registers, CSV exports, and audit logs
- Custom micro-course builder for company-specific subjects
- SQLite persistence with no third-party application dependencies
- Windows launcher, Linux/macOS launcher, Dockerfile, Docker Compose configuration, automated tests, and database backup script

## Quick start on Windows

1. Install **Node.js 22 or newer**.
2. Extract the application folder to a permanent location.
3. Double-click `start-lms.bat`.
4. Open `http://127.0.0.1:8787` if the browser does not open automatically.
5. Sign in with a first-run account below.

## Quick start from a terminal

```bash
cd rainbow_lms_app
npm start
```

Then open:

```text
http://127.0.0.1:8787
```

No `npm install` step is required. The application uses only modules included with Node.js 22.

## First-run accounts

| Account | Username | Password |
|---|---|---|
| Administrator | `admin` | `RainbowAdmin!2026` |
| Demonstration employee | `employee` | `RainbowEmployee!2026` |

**Change both default passwords before operational deployment.** The administrator can deactivate the demonstration employee after creating real employee accounts.

The database is created automatically at:

```text
data/rainbow-lms.sqlite
```

The application seeds default accounts only when the database contains no users.

## Administrator workflow

1. Open **Employees & Admins** and create an individual account for each employee.
2. Select the employee’s actual work roles: water, fire, mold, contents, asbestos, project manager, driver, respirator user, forklift operator, aerial-lift operator, supervisor, or administrator.
3. Leave **Automatically assign required-by-default courses** checked when appropriate.
4. Open **Course Assignments** to assign additional courses and due dates in bulk.
5. Open **Task Manager** to create field tasks, competency demonstrations, recurring inspections, and supervisor approval assignments.
6. Use **Reports & Records** to monitor completion, overdue items, expiration, certificates, and exportable records.
7. Use **Audit Log** to review account, assignment, completion, approval, and security actions.

See [ADMIN_GUIDE.md](ADMIN_GUIDE.md) for the detailed workflow.

## Employee workflow

Employees sign in using their own accounts and can:

- See assigned training and task priorities on the dashboard
- Continue courses from saved progress
- Complete native lessons and assessments
- Complete the supplied full interactive modules inside the LMS
- Submit field task notes and evidence references
- Review approval status or correction requests
- View current leaderboard standing
- Open and print completion certificates
- Change their password and review assigned training roles

## Course catalog

| Category | Courses |
|---|---:|
| Water Mitigation | 14 |
| Systems & Documentation | 3 |
| Fire & Smoke | 9 |
| Mold Remediation | 8 |
| Contents Restoration | 11 |
| Asbestos | 11 |
| OSHA & Safety | 35 |
| Leadership & Compliance | 5 |
| **Total** | **96** |

The full list is in [COURSE_CATALOG.md](COURSE_CATALOG.md).

## Leaderboard rules

The leaderboard counts completion events within the selected local period:

- **Daily:** current calendar day
- **Weekly:** Monday through Sunday
- **Monthly:** current calendar month
- **Yearly:** current calendar year

Each row shows completed courses, completed/approved tasks, total completions, and points. A course awards its configured point value only after successful completion. A task awards points only after it reaches completed status; approval-required tasks do not award points while merely submitted.

Leaderboard points never override stop-work authority, safe work practices, quality standards, authorization limits, or licensing requirements.

## Embedded interactive modules

The two supplied HTML modules are copied into `public/courseware/` and patched only for LMS integration:

- Their original course navigation, activities, examinations, practical evaluations, and certificates remain intact.
- Browser progress is separated by LMS user and assignment cycle.
- When the employee finalizes a course, the embedded module sends the score and its internal completion ID to the central LMS.
- The LMS then creates a central completion event and certificate record.

## Data and security

- User data, assignments, scores, tasks, completion events, certificates, sessions, and audit history are stored in SQLite.
- Passwords are never stored in plain text.
- Sessions are stored server-side and identified by an HttpOnly cookie.
- All state-changing requests require a CSRF token.
- Login attempts are rate-limited in memory.
- Dynamic pages include restrictive browser security headers.
- Completed course and task records cannot be deleted through the normal interface.
- Deactivating an account terminates its active sessions but retains attributable history.
- The final active administrator cannot be deactivated or converted into an employee account.

For production hardening, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Backup

Run:

```bash
npm run backup
```

A transactionally consistent SQLite backup is written to `backups/` using SQLite `VACUUM INTO`.

To use another backup directory:

```bash
BACKUP_DIR=/secure/backups npm run backup
```

Back up the database routinely and test restoration on a separate system.

## Automated tests

Run:

```bash
npm test
```

The included test suite verifies:

- First-run catalog and account seeding
- Role-based assignment creation
- Native course completion and certificate generation
- Task completion and approval point controls
- Leaderboard calculation
- Database operation
- HTTP health, login, dashboard, and static asset delivery

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | Network interface to bind |
| `PORT` | `8787` | HTTP port |
| `DATA_DIR` | `./data` | Persistent data directory |
| `DB_PATH` | `DATA_DIR/rainbow-lms.sqlite` | Explicit database path |
| `TIME_ZONE` | `America/New_York` | Leaderboard and due-date time zone |
| `SESSION_HOURS` | `12` | Session lifetime |
| `COOKIE_SECURE` | `false` | Set `true` when served through HTTPS |
| `ADMIN_USERNAME` | `admin` | First-run administrator username |
| `ADMIN_PASSWORD` | `RainbowAdmin!2026` | First-run administrator password |
| `DEMO_EMPLOYEE_USERNAME` | `employee` | First-run demo username |
| `DEMO_EMPLOYEE_PASSWORD` | `RainbowEmployee!2026` | First-run demo password |
| `NODE_ENV` | not set | Set `production` to suppress internal error details |
| `SHOW_DEMO_CREDENTIALS` | `true` outside production | Show or hide the first-run credentials panel on the sign-in page |

First-run credential variables are read only while creating a new database. They do not reset existing accounts.

## Compliance scope

This application is a **training-management system**, not a legal determination that every course applies to every employee. OSHA/VOSH applicability depends on the work, hazards, exposures, equipment, written programs, competent-person decisions, and jurisdiction. Several subjects also require hands-on evaluation, medical clearance, fit testing, exposure assessment, state licensing, accredited training, third-party certification, or task-specific authorization beyond an LMS course.

Review [COMPLIANCE_SCOPE.md](COMPLIANCE_SCOPE.md) before using the catalog as a formal training matrix.

## Deployment model and limits

This release is designed as a dependable **single-server, small-to-medium business or intranet LMS**. It does not include hosted email delivery, SMS, SSO, payroll/HRIS synchronization, or multi-datacenter failover. Those integrations can be added later through a dedicated deployment project. Use one running application process per SQLite database.
