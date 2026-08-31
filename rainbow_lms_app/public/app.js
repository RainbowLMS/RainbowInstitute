'use strict';

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || '';
  }

  function showToast(message) {
    let toast = $('#appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function initializeProgressBars() {
    $$('[data-progress]').forEach(element => {
      const value = Math.max(0, Math.min(100, Number(element.dataset.progress || 0)));
      element.style.width = `${value}%`;
      element.setAttribute('aria-valuenow', String(value));
    });
  }

  function initializeMobileNavigation() {
    const button = $('[data-mobile-menu]');
    const sidebar = $('#sidebar');
    if (!button || !sidebar) return;
    button.addEventListener('click', () => {
      const open = sidebar.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', event => {
      if (window.innerWidth > 820 || !sidebar.classList.contains('open')) return;
      if (!sidebar.contains(event.target) && event.target !== button) {
        sidebar.classList.remove('open');
        button.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function initializeConfirmations() {
    document.addEventListener('submit', event => {
      const form = event.target.closest('form[data-confirm]');
      if (!form) return;
      if (!window.confirm(form.dataset.confirm || 'Are you sure?')) event.preventDefault();
    });
    document.addEventListener('click', event => {
      const link = event.target.closest('a[data-confirm]');
      if (link && !window.confirm(link.dataset.confirm || 'Are you sure?')) event.preventDefault();
    });
  }

  function initializeSelectAll() {
    $$('[data-select-all]').forEach(button => {
      button.addEventListener('click', () => {
        const target = document.querySelector(button.dataset.selectAll);
        if (!target) return;
        [...target.options].forEach(option => { option.selected = true; });
        target.focus();
      });
    });
    $$('[data-clear-selection]').forEach(button => {
      button.addEventListener('click', () => {
        const target = document.querySelector(button.dataset.clearSelection);
        if (!target) return;
        [...target.options].forEach(option => { option.selected = false; });
        target.focus();
      });
    });
  }

  function initializeDialogs() {
    $$('[data-dialog-open]').forEach(button => {
      button.addEventListener('click', () => document.getElementById(button.dataset.dialogOpen)?.showModal());
    });
    $$('[data-dialog-close]').forEach(button => {
      button.addEventListener('click', () => button.closest('dialog')?.close());
    });
    $$('dialog').forEach(dialog => {
      dialog.addEventListener('click', event => {
        const rect = dialog.getBoundingClientRect();
        const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside) dialog.close();
      });
    });
  }

  function initializeFilters() {
    $$('[data-table-filter]').forEach(input => {
      const table = document.querySelector(input.dataset.tableFilter);
      if (!table) return;
      input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        $$('tbody tr', table).forEach(row => {
          row.hidden = query && !row.textContent.toLowerCase().includes(query);
        });
      });
    });

    const courseSearch = $('#courseSearch');
    const categoryFilter = $('#categoryFilter');
    const courseCards = $$('.course-card[data-search]');
    const filterCourses = () => {
      const query = (courseSearch?.value || '').trim().toLowerCase();
      const category = categoryFilter?.value || '';
      courseCards.forEach(card => {
        const matchesText = !query || card.dataset.search.includes(query);
        const matchesCategory = !category || card.dataset.category === category;
        card.hidden = !(matchesText && matchesCategory);
      });
      const visible = courseCards.filter(card => !card.hidden).length;
      const counter = $('#courseResultCount');
      if (counter) counter.textContent = `${visible} course${visible === 1 ? '' : 's'}`;
    };
    courseSearch?.addEventListener('input', filterCourses);
    categoryFilter?.addEventListener('change', filterCourses);
  }

  function initializePasswordControls() {
    $$('[data-toggle-password]').forEach(button => {
      button.addEventListener('click', () => {
        const input = document.querySelector(button.dataset.togglePassword);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        button.textContent = input.type === 'password' ? 'Show' : 'Hide';
      });
    });
    const generator = $('[data-generate-password]');
    if (generator) {
      generator.addEventListener('click', () => {
        const target = document.querySelector(generator.dataset.generatePassword);
        if (!target) return;
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
        const values = new Uint32Array(18);
        crypto.getRandomValues(values);
        target.value = [...values].map(value => chars[value % chars.length]).join('');
        target.type = 'text';
        target.focus();
      });
    }
  }

  function initializeLegacyCourseBridge() {
    const frame = $('#legacyCourseFrame');
    if (!frame) return;
    const endpoint = frame.dataset.completionEndpoint;
    let submitted = false;
    window.addEventListener('message', async event => {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      const data = event.data || {};
      if (data.type !== 'RAINBOW_LMS_COMPLETE' || submitted) return;
      submitted = true;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken(),
          },
          body: JSON.stringify(data),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to record completion.');
        showToast('Course completion recorded in the LMS.');
        window.setTimeout(() => { window.location.href = result.redirect || '/certificates'; }, 900);
      } catch (error) {
        submitted = false;
        showToast(error.message || 'Course completion could not be recorded.');
      }
    });
  }

  function initializePrintButtons() {
    $$('[data-print]').forEach(button => button.addEventListener('click', () => window.print()));
  }

  function initializeAutoSubmit() {
    $$('[data-auto-submit]').forEach(element => {
      element.addEventListener('change', () => element.form?.submit());
    });
  }

  function initializeDueDates() {
    $$('input[type="date"][data-default-days]').forEach(input => {
      if (input.value) return;
      const date = new Date();
      date.setDate(date.getDate() + Number(input.dataset.defaultDays || 0));
      input.value = date.toISOString().slice(0, 10);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initializeProgressBars();
    initializeMobileNavigation();
    initializeConfirmations();
    initializeSelectAll();
    initializeDialogs();
    initializeFilters();
    initializePasswordControls();
    initializeLegacyCourseBridge();
    initializePrintButtons();
    initializeAutoSubmit();
    initializeDueDates();
  });
})();
