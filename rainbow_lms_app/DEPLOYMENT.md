# Rainbow Restoration LMS Deployment Guide

## Supported deployment modes

1. **Single Windows workstation or office server**
2. **Linux server or virtual machine**
3. **Docker / Docker Compose**
4. **Internal network behind an HTTPS reverse proxy**

The LMS is a single-process Node.js application backed by SQLite. Run only one application process against a given database file.

## Local-only deployment

The default binding is:

```text
HOST=127.0.0.1
PORT=8787
```

Only the local computer can connect. This is suitable for evaluation, course development, or a dedicated kiosk used by one person at a time.

## Internal network deployment

Set:

```text
HOST=0.0.0.0
PORT=8787
NODE_ENV=production
SHOW_DEMO_CREDENTIALS=false
DATA_DIR=/path/to/persistent/data
```

Then permit the selected port only from trusted internal networks. For operational deployment, place the application behind an HTTPS reverse proxy and set:

```text
COOKIE_SECURE=true
```

Do not expose the application directly to the public internet over unencrypted HTTP.

## First-run credential variables

Before the database is first created, set strong values:

```text
ADMIN_USERNAME=your.admin.username
ADMIN_PASSWORD=use-a-long-unique-password
DEMO_EMPLOYEE_USERNAME=employee.demo
DEMO_EMPLOYEE_PASSWORD=another-long-unique-password
```

These values are used only while seeding an empty database. They do not modify an existing account.

After first sign-in:

- Create a second named administrator.
- Change the initial administrator password.
- Deactivate or repurpose the demonstration employee.

## Windows startup

For interactive use, run `start-lms.bat`.

For unattended service operation, use an approved Windows service manager and configure:

- Working directory: application folder
- Executable: Node.js
- Arguments: `--no-warnings server.js`
- Environment: production variables above
- Restart on failure
- Service account access to the application and data directories

Restrict filesystem access to the service account and authorized administrators.

## Docker Compose

Build and start:

```bash
docker compose up -d --build
```

Open:

```text
http://server-address:8787
```

The included Compose file stores the SQLite database in the `rainbow_lms_data` named volume.

For HTTPS, place a reverse proxy in front of the container, set `COOKIE_SECURE=true`, and restrict direct access to port 8787.

## Reverse proxy requirements

The proxy should:

- Terminate TLS using a valid certificate
- Forward the original host and client IP
- Preserve normal HTTP methods and request bodies
- Set an appropriate maximum body size
- Use timeouts long enough for course pages and CSV downloads
- Restrict access to approved networks or identity controls where possible

The application reads `X-Forwarded-For` for audit IP display. Trust that header only when requests arrive through a controlled proxy.

## Persistent data

The application database is normally:

```text
data/rainbow-lms.sqlite
```

With `DATA_DIR=/data`, it is:

```text
/data/rainbow-lms.sqlite
```

Protect this file as a confidential personnel/training record. It contains account identifiers, assignments, scores, completion events, certificates, task notes, and audit history.

## Backup and restoration

Create a consistent backup:

```bash
npm run backup
```

Backups are written to `backups/` unless `BACKUP_DIR` is set.

Recommended practice:

- Daily automated backup
- Additional backup before software/catalog upgrades
- Encrypted off-system copy
- Retention schedule approved by company leadership
- Periodic test restoration

### Restoration

1. Stop the LMS process.
2. Preserve the current database file separately.
3. Copy the selected backup to the configured database path.
4. Confirm file ownership and permissions.
5. Start the LMS.
6. Verify `/healthz`, sign-in, recent records, and reports.

## Security checklist

- [ ] HTTPS is enabled for network use.
- [ ] `COOKIE_SECURE=true` is set behind HTTPS.
- [ ] Default passwords have been changed.
- [ ] At least two named administrators exist.
- [ ] Demonstration accounts are deactivated if not needed.
- [ ] The data directory is access-controlled.
- [ ] The application port is firewalled.
- [ ] Backups are encrypted and tested.
- [ ] Node.js security updates are applied.
- [ ] Administrator and audit access is reviewed regularly.
- [ ] Employees use individual accounts and do not share credentials.
- [ ] Task notes avoid protected medical data and unnecessary customer information.

## Updating course content

`data/course_catalog.json` is synchronized into the database at startup. Catalog-course content and metadata are refreshed while employee assignment/completion records remain in the database.

Before replacing the catalog:

1. Back up the database.
2. Validate JSON syntax.
3. Preserve unique course slugs when updating an existing course.
4. Use a new slug when a materially different course must be tracked separately.
5. Review regulatory basis, warnings, passing score, role targets, and renewal interval.
6. Run `npm test`.

## Health monitoring

The application exposes:

```text
GET /healthz
```

A successful response returns HTTP 200 and JSON identifying the application, database filename, and current timestamp.

## Scaling and integration limits

This release is intended for one application instance and a small-to-medium employee population. For requirements such as SSO, SCORM/xAPI, email reminders, HRIS synchronization, public cloud high availability, multiple branches with tenant isolation, or enterprise analytics, plan a separate integration and database migration project rather than running multiple processes against the SQLite file.
