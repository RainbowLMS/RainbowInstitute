# Rainbow Restoration LMS Administrator Guide

## 1. First operational setup

1. Sign in with the first-run administrator account.
2. Open **My Profile** and change the default administrator password.
3. Open **Employees & Admins** and create a second named administrator account.
4. Sign in with the second administrator to verify access.
5. Create named employee accounts.
6. Deactivate the demonstration employee when it is no longer needed.
7. Confirm the organization time zone and deployment security settings.
8. Create a backup after the initial roster and assignment matrix are configured.

## 2. Account types

### Employee

Employees can access their own training, tasks, leaderboard, certificates, compliance center, and profile. They cannot see another employee’s individual assignment records or administrative reports.

### Administrator

Administrators can create and maintain accounts, assign training, create tasks, approve task evidence, manage the course catalog, view all certificate and completion records, export CSV reports, and inspect the audit log.

Use administrator access only for employees who perform LMS, training, compliance, or management duties.

## 3. Training roles

Training roles drive automatic required-course assignment. They are not licenses or field authorizations.

- Water Mitigation
- Fire & Smoke
- Mold Remediation
- Contents Restoration
- Asbestos Work
- Project Manager
- Supervisor / Competent Person
- Company Driver
- Respirator User
- Forklift Operator
- Aerial Lift Operator
- LMS / Program Administrator

Select only roles that reflect actual or planned duties. When roles change, use **Assign any missing required-by-default courses** on the employee record. Existing completion history remains intact.

## 4. Creating an employee

1. Open **Employees & Admins**.
2. Enter the employee’s full name and unique username.
3. Add employee number, department, job title, email, and hire date when available.
4. Select **Employee** as the account type.
5. Generate or enter a strong temporary password.
6. Select applicable training roles.
7. Leave automatic required-course assignment selected when appropriate.
8. Create the account.
9. Deliver the temporary password through an approved secure channel.

The employee will be required to change a temporary password on first sign-in.

## 5. Creating another administrator

Follow the employee workflow but select **Administrator** as the account type and include the LMS / Program Administrator role. Administrators are not automatically assigned employee courses, but courses can be assigned to them manually.

Maintain at least two named active administrators. The application prevents deactivation or role removal of the final active administrator.

## 6. Assigning courses

Open **Course Assignments**.

- Select one or many active employees.
- Select one or many active courses.
- Choose a due date.
- Mark whether the assignment is required.
- Submit the assignment.

Existing employee-course records are retained rather than duplicated. Open assignments may be removed. Completed records cannot be deleted through the interface.

### Retraining or renewal

Use **Reset** on a course assignment to begin a new training cycle. Resetting:

- Preserves prior certificates and completion events
- Increments the assignment cycle
- Clears current lesson/assessment progress
- Allows a new score and certificate to be recorded

## 7. Creating and assigning tasks

Open **Task Manager**.

A task can represent:

- Daily vehicle/equipment inspection
- Weekly safety meeting acknowledgment
- Field demonstration
- Job documentation audit
- Coaching assignment
- Quality-control inspection
- Supervisor observation
- Company procedure review

Set:

- Title and description
- Category
- Point value
- One-time or recurring schedule
- Due date
- Assigned employees
- Whether administrator approval is required

### Approval-required tasks

The employee submits notes and an evidence/job reference. The task remains **Submitted** and awards no points until an administrator approves it. An administrator may return it with a correction note.

### Recurring tasks

When a recurring task is completed or approved, the LMS creates the next assignment for the same employee. Supported intervals are daily, weekly, monthly, and yearly.

## 8. Leaderboards

Employees and administrators can view daily, weekly, monthly, and yearly leaderboards. Ranking is ordered by:

1. Points
2. Total completions
3. Course completions
4. Completion timing and employee name as stable tie-breakers

Use point values that reward meaningful learning and operational accountability. Do not create incentives to rush, bypass controls, or record completion without verification.

## 9. Course management

The launch catalog is synchronized from `data/course_catalog.json` each time the application starts. Administrators can activate/deactivate catalog courses and create company-specific micro-courses.

A custom micro-course supports:

- Title, category, and description
- Estimated time and point value
- Passing score and renewal interval
- One lesson with multiple learning points
- Safety/authorization callout
- Optional multiple-choice assessment and critical-question flag

For larger regulatory or technical course development, validate content with a qualified subject-matter expert before deployment.

## 10. Certificates

The LMS creates a unique central certificate after successful course completion. The certificate includes:

- Employee name and employee number
- Course title/category
- Completion date
- Expiration date when configured
- Score
- Assigned-by name
- Central certificate ID
- Embedded-module completion ID when applicable

Employees may print or save the certificate as PDF through the browser. Certificates document internal training completion and do not replace external licensing, certification, medical clearance, fit testing, or task-specific authorization.

## 11. Reports

**Reports & Records** provides:

- Current employee course completion percentage
- Overdue course count
- Expired course count
- Completion event history
- Certificate register
- Completions CSV export
- Compliance summary CSV export

CSV files can be opened in Excel or imported into another record-management system.

## 12. Audit log

The audit log records actions such as:

- Login success/failure and logout
- Account creation/update/deactivation/reactivation
- Password resets and employee password changes
- Course assignment, reset, and removal
- Lesson and assessment activity
- Course completion
- Task creation, assignment, submission, approval, rejection, and removal
- Course creation/activation/deactivation

Treat the audit log as an internal accountability record. Restrict administrator access and preserve database backups.

## 13. Recommended recurring administrator review

### Daily

- Pending task approvals
- Overdue high-priority assignments
- Account lockout or failed-login concerns

### Weekly

- New employee assignment matrix
- Upcoming due dates
- Field competency tasks
- Recent completion quality spot-check

### Monthly

- Employee compliance percentages
- Certificate expirations
- Inactive accounts
- Audit log review
- Database backup verification

### Annually or when standards/programs change

- Course content and regulatory basis
- Role-to-course assignment rules
- Passing standards and renewal intervals
- Written program alignment
- Trainer/evaluator qualifications
- State and local requirements
