'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../src/database');

function makeDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rainbow-lms-db-'));
  const db = openDatabase({
    dbPath: path.join(dir, 'test.sqlite'),
    catalogPath: path.join(__dirname, '..', 'data', 'course_catalog.json'),
  });
  return { db, dir };
}

test('seeds catalog, accounts, assignments, and tasks', () => {
  const { db, dir } = makeDatabase();
  try {
    assert.equal(db.listCourses().length, 96);
    assert.equal(db.listUsers().length, 2);
    const employee = db.getUserByUsername('employee');
    assert.ok(employee);
    assert.equal(db.listCourseAssignments({ userId: employee.id }).length, 17);
    assert.equal(db.listTaskAssignments({ userId: employee.id }).length, 4);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('records native course completion, certificate, task points, and leaderboard rank', () => {
  const { db, dir } = makeDatabase();
  try {
    const employee = db.getUserByUsername('employee');
    const assignment = db.listCourseAssignments({ userId: employee.id }).find(row => row.slug === 'asbestos-awareness');
    assert.ok(assignment);
    assignment.lessons.forEach((_, index) => db.completeLesson(assignment.id, employee.id, index));
    const answers = {};
    assignment.quiz.forEach((question, index) => { answers[index] = question.answer; });
    const result = db.gradeNativeCourse(assignment.id, employee.id, answers);
    assert.equal(result.passed, true);
    assert.equal(result.score, 100);
    assert.ok(result.certificate.certificate_number.startsWith('RR-LMS-'));

    const task = db.listTaskAssignments({ userId: employee.id }).find(row => !row.requires_approval);
    assert.ok(task);
    const completedTask = db.submitTask(task.id, employee.id, { notes: 'Inspection complete', evidence: 'TEST' });
    assert.equal(completedTask.status, 'completed');

    const leaderboard = db.getLeaderboard('daily');
    assert.equal(leaderboard.rows[0].id, employee.id);
    assert.ok(leaderboard.rows[0].points >= assignment.points + task.points);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('requires approval for controlled tasks before awarding points', () => {
  const { db, dir } = makeDatabase();
  try {
    const admin = db.getUserByUsername('admin');
    const employee = db.getUserByUsername('employee');
    const task = db.listTaskAssignments({ userId: employee.id }).find(row => row.requires_approval);
    assert.ok(task);
    const submitted = db.submitTask(task.id, employee.id, { notes: 'Demonstrated', evidence: 'Supervisor observed' });
    assert.equal(submitted.status, 'submitted');
    const before = db.getUserPoints(employee.id, 'yearly').points;
    db.approveTask(task.id, admin.id);
    const after = db.getUserPoints(employee.id, 'yearly').points;
    assert.equal(after - before, task.points);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
