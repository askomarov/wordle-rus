/**
 * UI: словарь + поиск по маске (OTP-слоты).
 * Данные — window.AgentWords.validGuesses.
 */
(function () {
  'use strict';

  const LETTER_RE = /^[А-ЯЁ]$/;
  const WORD_LEN = 5;

  const words = Array.from(window.AgentWords.validGuesses).sort(function (a, b) {
    return a.localeCompare(b, 'ru');
  });

  const slots = Array.from(document.querySelectorAll('.pattern-slot'));
  const listEl = document.getElementById('words-list');
  const countEl = document.getElementById('words-count');

  function normalizeSlot(raw) {
    const ch = String(raw || '').toUpperCase();
    if (!ch || ch === ' ' || ch === '_') return '';
    if (LETTER_RE.test(ch)) return ch;
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
      ? 'Найдено: ' + filtered.length
      : 'Всего слов: ' + filtered.length;

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
        if (LETTER_RE.test(ch)) {
          setSlotValue(slots[writeIndex], ch);
          writeIndex += 1;
        }
      }
      focusSlot(Math.min(writeIndex, WORD_LEN - 1));
      render();
    });
  });

  render();
})();
