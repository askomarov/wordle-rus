/**
 * Словарь + OTP-маска. Работает на странице и в <dialog>.
 * Данные: window.AgentWords.validGuesses
 */
(function (global) {
  'use strict';

  const WORD_LEN = 5;
  const DEFAULTS = {
    letterRe: /^[А-ЯЁ]$/,
    locale: 'ru',
    labels: {
      found: 'Найдено: ',
      total: 'Всего слов: ',
    },
  };

  function sortedWords(locale) {
    const list = Array.from(global.AgentWords.validGuesses);
    if (locale === 'ru') {
      return list.sort(function (a, b) {
        return a.localeCompare(b, 'ru');
      });
    }
    return list.sort();
  }

  function mount(root, options) {
    if (!root || !global.AgentWords) return null;

    const opts = Object.assign({}, DEFAULTS, options || {});
    const letterRe = opts.letterRe;
    const labels = opts.labels;
    const words = sortedWords(opts.locale);

    const slots = Array.from(root.querySelectorAll('.pattern-slot'));
    const listEl = root.querySelector('[data-words-list]');
    const countEl = root.querySelector('[data-words-count]');
    if (!slots.length || !listEl || !countEl) return null;

    function normalizeSlot(raw) {
      const ch = String(raw || '').toUpperCase();
      if (!ch || ch === ' ' || ch === '_') return '';
      if (letterRe.test(ch)) return ch;
      return null;
    }

    function getPattern() {
      return slots.map(function (slot) {
        return normalizeSlot(slot.value) || '';
      });
    }

    function matchesPattern(word, pattern) {
      for (let i = 0; i < WORD_LEN; i++) {
        const p = pattern[i];
        if (p && word[i] !== p) return false;
      }
      return true;
    }

    function render() {
      const pattern = getPattern();
      const filtered = words.filter(function (w) {
        return matchesPattern(w, pattern);
      });

      const hasConstraint = pattern.some(Boolean);
      countEl.textContent = hasConstraint
        ? labels.found + filtered.length
        : labels.total + filtered.length;

      const frag = document.createDocumentFragment();
      for (let i = 0; i < filtered.length; i++) {
        const li = document.createElement('li');
        li.className = 'words-list-item';
        li.textContent = filtered[i];
        frag.appendChild(li);
      }
      listEl.replaceChildren(frag);
    }

    function focusSlot(index) {
      const slot = slots[index];
      if (slot) slot.focus();
    }

    function setSlotValue(slot, value) {
      slot.value = value;
      slot.classList.toggle('is-filled', Boolean(value));
    }

    slots.forEach(function (slot, index) {
      slot.addEventListener('input', function () {
        const normalized = normalizeSlot(slot.value);
        if (normalized === null) {
          setSlotValue(slot, '');
          return;
        }
        setSlotValue(slot, normalized);
        if (normalized && index < WORD_LEN - 1) {
          focusSlot(index + 1);
        }
        render();
      });

      slot.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace') {
          if (slot.value) {
            setSlotValue(slot, '');
            render();
          } else if (index > 0) {
            e.preventDefault();
            setSlotValue(slots[index - 1], '');
            focusSlot(index - 1);
            render();
          }
          return;
        }

        if (e.key === 'ArrowLeft' && index > 0) {
          e.preventDefault();
          focusSlot(index - 1);
          return;
        }

        if (e.key === 'ArrowRight' && index < WORD_LEN - 1) {
          e.preventDefault();
          focusSlot(index + 1);
          return;
        }

        if (e.key === ' ' || e.key === '_') {
          e.preventDefault();
          setSlotValue(slot, '');
          if (index < WORD_LEN - 1) focusSlot(index + 1);
          render();
        }
      });

      slot.addEventListener('focus', function () {
        slot.select();
      });

      slot.addEventListener('paste', function (e) {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text') || '';
        const chars = text.toUpperCase().replace(/\s+/g, '');
        let writeIndex = index;
        for (let i = 0; i < chars.length && writeIndex < WORD_LEN; i++) {
          const ch = chars[i];
          if (ch === '_') {
            setSlotValue(slots[writeIndex], '');
            writeIndex += 1;
            continue;
          }
          if (letterRe.test(ch)) {
            setSlotValue(slots[writeIndex], ch);
            writeIndex += 1;
          }
        }
        focusSlot(Math.min(writeIndex, WORD_LEN - 1));
        render();
      });
    });

    render();
    return { render: render, focusFirst: function () { focusSlot(0); } };
  }

  function wireLightDismissFallback(dialog) {
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;
    dialog.addEventListener('click', function (event) {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (inside) return;
      dialog.close();
    });
  }

  function wireDialog(dialog, openButtons, searchApi) {
    if (!dialog) return;

    wireLightDismissFallback(dialog);

    Array.from(openButtons || []).forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function () {
        const helpDialog = document.getElementById('help-dialog');
        if (helpDialog && helpDialog.open) {
          helpDialog.close();
        }

        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
        if (searchApi && searchApi.focusFirst) {
          requestAnimationFrame(function () {
            searchApi.focusFirst();
          });
        }
      });
    });
  }

  function boot(options) {
    const opts = options || {};
    const roots = document.querySelectorAll('[data-words-search]');
    const apis = [];
    roots.forEach(function (root) {
      apis.push(mount(root, opts));
    });

    const dialog = document.getElementById('dict-dialog');
    const openButtons = document.querySelectorAll('[data-open-dict]');
    const dialogRoot = dialog && dialog.querySelector('[data-words-search]');
    let dialogApi = null;
    if (dialogRoot) {
      const idx = Array.from(roots).indexOf(dialogRoot);
      dialogApi = idx >= 0 ? apis[idx] : null;
    }
    wireDialog(dialog, openButtons, dialogApi);
    wireLightDismissFallback(document.getElementById('help-dialog'));
  }

  global.AgentWordsSearch = { mount: mount, boot: boot };
})(window);
