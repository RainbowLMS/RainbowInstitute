'use strict';

function nowIso() {
  return new Date().toISOString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function jsonParse(value, fallback) {
  try {
    return value === null || value === undefined || value === '' ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, Number(number) || 0));
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: options.timeZone || 'America/New_York',
    year: 'numeric',
    month: options.short ? 'short' : 'long',
    day: 'numeric',
  }).format(date);
}

function formatDateTime(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: options.timeZone || 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function addMonthsIso(value, months) {
  if (!months) return null;
  const date = new Date(value);
  date.setUTCMonth(date.getUTCMonth() + Number(months));
  return date.toISOString();
}

function addRecurrenceIso(value, recurrence) {
  const date = new Date(value || nowIso());
  if (recurrence === 'daily') date.setUTCDate(date.getUTCDate() + 1);
  else if (recurrence === 'weekly') date.setUTCDate(date.getUTCDate() + 7);
  else if (recurrence === 'monthly') date.setUTCMonth(date.getUTCMonth() + 1);
  else if (recurrence === 'yearly') date.setUTCFullYear(date.getUTCFullYear() + 1);
  else return null;
  return date.toISOString();
}

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const result = {};
  for (const part of parts) {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
  }
  return result;
}

function zonedDateTimeToUtc(parts, timeZone) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0);
  let guess = target;
  for (let i = 0; i < 3; i += 1) {
    const rendered = getZonedParts(new Date(guess), timeZone);
    const renderedAsUtc = Date.UTC(rendered.year, rendered.month - 1, rendered.day, rendered.hour, rendered.minute, rendered.second);
    guess += target - renderedAsUtc;
  }
  return new Date(guess);
}

function calendarShift(parts, { days = 0, months = 0, years = 0 } = {}) {
  const date = new Date(Date.UTC(parts.year + years, parts.month - 1 + months, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  };
}

function getPeriodRange(period, timeZone = 'America/New_York', now = new Date()) {
  const current = getZonedParts(now, timeZone);
  let startParts = { year: current.year, month: current.month, day: current.day, hour: 0, minute: 0, second: 0 };
  let endParts;
  if (period === 'weekly') {
    const date = new Date(Date.UTC(current.year, current.month - 1, current.day));
    const day = date.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    startParts = calendarShift(startParts, { days: mondayOffset });
    endParts = calendarShift(startParts, { days: 7 });
  } else if (period === 'monthly') {
    startParts = { year: current.year, month: current.month, day: 1, hour: 0, minute: 0, second: 0 };
    endParts = calendarShift(startParts, { months: 1 });
  } else if (period === 'yearly') {
    startParts = { year: current.year, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
    endParts = calendarShift(startParts, { years: 1 });
  } else {
    endParts = calendarShift(startParts, { days: 1 });
  }
  return {
    period: ['daily', 'weekly', 'monthly', 'yearly'].includes(period) ? period : 'daily',
    start: zonedDateTimeToUtc(startParts, timeZone).toISOString(),
    end: zonedDateTimeToUtc(endParts, timeZone).toISOString(),
  };
}

function normalizeDueDate(value, timeZone = 'America/New_York') {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split('-').map(Number);
  return zonedDateTimeToUtc({ year, month, day, hour: 23, minute: 59, second: 59 }, timeZone).toISOString();
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

module.exports = {
  addMonthsIso,
  addRecurrenceIso,
  calendarShift,
  clamp,
  csvEscape,
  escapeHtml,
  formatDate,
  formatDateTime,
  getPeriodRange,
  getZonedParts,
  jsonParse,
  normalizeDueDate,
  nowIso,
  slugify,
  toArray,
  zonedDateTimeToUtc,
};
