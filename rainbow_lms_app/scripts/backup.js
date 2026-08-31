'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(dataDir, 'rainbow-lms.sqlite');
const backupDir = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(root, 'backups');

if (!fs.existsSync(dbPath)) {
  console.error(`No LMS database found at ${dbPath}`);
  process.exit(1);
}
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `rainbow-lms-${stamp}.sqlite`);
const quoted = backupPath.replaceAll("'", "''");
const db = new DatabaseSync(dbPath, { readOnly: false });
try {
  db.exec(`VACUUM INTO '${quoted}'`);
  console.log(`Backup created: ${backupPath}`);
} finally {
  db.close();
}
