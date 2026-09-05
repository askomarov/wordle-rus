/**
 * UI layer — DOM, animations, input wiring.
 */
(function (global) {
  'use strict';

  const {
    WORD_LENGTH,
    MAX_GUESSES,
    STATUS,
    LETTER,
    createGame,
    runSelfChecks,
  } = global.AgentGame;

  const HOW_TO_KEY = 'agent-ru-how-to-play-seen';
  const REVEAL_MS = 320;
  // 4 gaps × 90ms = 360ms total stagger (<500ms motion guideline)
  const REVEAL_STAGGER = 90;
  const TOAST_ERROR_MS = 1800;
  // Hold pressed long enough for down (60ms), release eases over ~100ms
  const PRESS_MS = 100;
  const SHAKE_MS = 340;
  const WIN_BOUNCE_MS = 440 + 240;

  // ≥375: classic 3-row ЙЦУКЕН. <375: letters only in 3 rows, ⌫/↵ on a 4th row.
  const KEY_ROWS_WIDE = [
    ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ'],
    ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
    ['Backspace', 'Ё', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', 'Enter'],
  ];

  const KEY_ROWS_NARROW = [
    ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ'],
    ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
    ['Ё', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю'],
    ['Backspace', 'Enter'],
  ];

  const NARROW_MQ = '(max-width: 374px)';

  function boot() {
    const checks = runSelfChecks();
    const failed = checks.filter((c) => !c.pass);
    if (failed.length) {
      console.error('Self-checks failed', failed);
    }

    const els = {
      board: document.getElementById('board'),
      keyboard: document.getElementById('keyboard'),
      toast: document.getElementById('toast'),
      newGameBtn: document.getElementById('new-game-btn'),
      helpBtn: document.getElementById('help-btn'),
      helpDialog: document.getElementById('help-dialog'),
      errorBanner: document.getElementById('error-banner'),
    };

    const game = createGame();
    let toastTimer = null;
    let persistentToast = false;
    let rowEls = [];
    let tileEls = [];
    const keyEls = new Map();
    const narrowMq = window.matchMedia(NARROW_MQ);
    let narrowLayout = narrowMq.matches;

    buildBoard();
    buildKeyboard();

    const state0 = game.startRound();
    if (state0.error) {
      els.errorBanner.hidden = false;
      els.errorBanner.textContent = state0.error;
      return;
    }

    renderBoard(state0, { instant: true });
    renderKeyboard(state0);
    updateCta(state0);

    // Expose for manual browser testing
    global.__AGENT__ = {
      getAnswer: () => game.getAnswer(),
      getState: () => game.getState(),
      game,
    };

    if (!localStorage.getItem(HOW_TO_KEY)) {
      openHelp();
    }

    els.newGameBtn.addEventListener('click', () => onNewGame());
    els.helpBtn.addEventListener('click', () => openHelp());
    els.helpDialog.addEventListener('close', () => {
      localStorage.setItem(HOW_TO_KEY, '1');
    });

    window.addEventListener('keydown', onKeyDown);

    const onNarrowChange = () => {
      if (narrowMq.matches === narrowLayout) return;
      narrowLayout = narrowMq.matches;
      buildKeyboard();
      renderKeyboard(game.getState());
    };
    if (typeof narrowMq.addEventListener === 'function') {
      narrowMq.addEventListener('change', onNarrowChange);
    } else {
      narrowMq.addListener(onNarrowChange);
    }

    function buildBoard() {
      els.board.innerHTML = '';
      rowEls = [];
      tileEls = [];

      for (let r = 0; r < MAX_GUESSES; r++) {
        const row = document.createElement('div');
        row.className = 'row';
        row.dataset.row = String(r);
        const tiles = [];
        for (let c = 0; c < WORD_LENGTH; c++) {
          const tile = document.createElement('div');
          tile.className = 'tile';
          tile.dataset.row = String(r);
          tile.dataset.col = String(c);
          const face = document.createElement('div');
          face.className = 'tile-face';
          tile.appendChild(face);
          row.appendChild(tile);
          tiles.push(tile);
        }
        els.board.appendChild(row);
        rowEls.push(row);
        tileEls.push(tiles);
      }
    }

    function buildKeyboard() {
      els.keyboard.innerHTML = '';
      keyEls.clear();
      els.keyboard.classList.toggle('keyboard--narrow', narrowLayout);

      const rows = narrowLayout ? KEY_ROWS_NARROW : KEY_ROWS_WIDE;
      for (const row of rows) {
        const rowEl = document.createElement('div');
        rowEl.className = 'keyboard-row';
        if (row.length === 2 && row[0] === 'Backspace' && row[1] === 'Enter') {
          rowEl.classList.add('keyboard-row--actions');
        }
        for (const key of row) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'key';
          btn.dataset.key = key;
          if (key === 'Enter') {
            btn.classList.add('key--wide');
            btn.innerHTML =
              '<svg class="key-icon" viewBox="0 0 24 24" aria-hidden="true">' +
              '<path fill="currentColor" d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z"/>' +
              '</svg>';
            btn.setAttribute('aria-label', 'Ввод');
          } else if (key === 'Backspace') {
            btn.classList.add('key--wide');
            btn.innerHTML =
              '<svg class="key-icon" viewBox="0 0 24 24" aria-hidden="true">' +
              '<path fill="currentColor" d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89H22c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/>' +
              '</svg>';
            btn.setAttribute('aria-label', 'Стереть');
          } else {
            btn.textContent = key;
            btn.setAttribute('aria-label', key);
          }
          btn.addEventListener('click', () => {
            flashKey(key);
            handleAction(key);
          });
          rowEl.appendChild(btn);
          keyEls.set(key, btn);
        }
        els.keyboard.appendChild(rowEl);
      }
    }

    function tileStateClass(state) {
      if (state === LETTER.EMPTY) return '';
      return `tile--${state}`;
    }

    function renderBoard(state, { instant = false } = {}) {
      for (let r = 0; r < MAX_GUESSES; r++) {
        for (let c = 0; c < WORD_LENGTH; c++) {
          const cell = state.board[r][c];
          const tile = tileEls[r][c];
          const face = tile.querySelector('.tile-face');
          const prevLetter = face.textContent;
          face.textContent = cell.letter;

          tile.className = 'tile';
          const cls = tileStateClass(cell.state);
          if (cls) tile.classList.add(cls);

          if (
            !instant &&
            cell.state === LETTER.FILLED &&
            cell.letter &&
            prevLetter !== cell.letter
          ) {
            face.style.animation = 'none';
            void face.offsetWidth;
            face.style.animation = '';
          }
        }
      }
    }

    function renderKeyboard(state) {
      const disabled =
        state.status !== STATUS.PLAYING || state.revealing || Boolean(state.error);

      els.keyboard.classList.toggle('is-disabled', disabled);

      for (const [key, btn] of keyEls) {
        btn.disabled = disabled;
        btn.classList.remove('key--correct', 'key--present', 'key--absent');
        if (key.length === 1) {
          const ks = state.keyboard[key];
          if (ks && ks !== 'unused') {
            btn.classList.add(`key--${ks}`);
          }
        }
      }
    }

    function updateCta(state) {
      const btn = els.newGameBtn;
      btn.classList.remove('is-primary', 'is-win');
      if (state.status === STATUS.WON) {
        btn.textContent = 'Ещё раз';
        btn.classList.add('is-win');
      } else if (state.status === STATUS.LOST) {
        btn.textContent = 'Ещё раз';
        btn.classList.add('is-primary');
      } else {
        btn.textContent = 'Новая игра';
      }
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function resultToastHtml(kicker, titleHtml) {
      return (
        `<div class="toast-kicker">${escapeHtml(kicker)}</div>` +
        `<div class="toast-title">${titleHtml}</div>`
      );
    }

    function applyToastKind(kind) {
      els.toast.classList.remove('is-win', 'is-lose');
      if (kind === 'win') els.toast.classList.add('is-win');
      if (kind === 'lose') els.toast.classList.add('is-lose');
    }

    function showToast(message, { persistent = false, html = false, kind } = {}) {
      if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
      persistentToast = persistent;
      els.toast.hidden = false;
      applyToastKind(kind);
      if (html) {
        els.toast.innerHTML = message;
      } else {
        els.toast.textContent = message;
      }
      els.toast.classList.remove('is-leaving');
      void els.toast.offsetWidth;
      els.toast.classList.add('is-visible');

      if (!persistent) {
        toastTimer = setTimeout(() => hideToast(), TOAST_ERROR_MS);
      }
    }

    function hideToast() {
      if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
      persistentToast = false;
      els.toast.classList.add('is-leaving');
      els.toast.classList.remove('is-visible', 'is-win', 'is-lose');
      setTimeout(() => {
        if (!els.toast.classList.contains('is-visible')) {
          els.toast.hidden = true;
          els.toast.textContent = '';
          els.toast.classList.remove('is-leaving', 'is-win', 'is-lose');
        }
      }, 220);
    }

    function shakeRow(rowIndex) {
      const row = rowEls[rowIndex];
      row.classList.remove('is-invalid');
      void row.offsetWidth;
      row.classList.add('is-invalid');
      setTimeout(() => row.classList.remove('is-invalid'), SHAKE_MS);
    }

    function flashKey(key) {
      const btn = keyEls.get(key);
      if (!btn || btn.disabled) return;
      btn.classList.add('is-pressed');
      setTimeout(() => btn.classList.remove('is-pressed'), PRESS_MS);
    }

    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function prefersReducedMotion() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    async function revealRow(rowIndex, evaluation, keyboardAfter) {
      const reduced = prefersReducedMotion();
      const stagger = reduced ? 40 : REVEAL_STAGGER;
      const duration = reduced ? 150 : REVEAL_MS;

      for (let c = 0; c < WORD_LENGTH; c++) {
        const tile = tileEls[rowIndex][c];
        const face = tile.querySelector('.tile-face');
        const state = evaluation[c];
        const letter = face.textContent;

        if (reduced) {
          tile.className = `tile tile--${state}`;
        } else {
          tile.classList.add('is-flipping');
          await sleep(duration / 2);
          tile.className = `tile tile--${state} is-flipping`;
          face.textContent = letter;
          await sleep(duration / 2);
          tile.classList.remove('is-flipping');
        }

        const ch = letter;
        const btn = keyEls.get(ch);
        if (btn && keyboardAfter[ch]) {
          btn.classList.remove('key--correct', 'key--present', 'key--absent');
          if (keyboardAfter[ch] !== 'unused') {
            btn.classList.add(`key--${keyboardAfter[ch]}`);
          }
        }

        if (c < WORD_LENGTH - 1) await sleep(stagger);
      }
    }

    async function bounceWinRow(rowIndex) {
      if (prefersReducedMotion()) return;
      const row = rowEls[rowIndex];
      row.classList.add('is-win-bounce');
      await sleep(WIN_BOUNCE_MS);
      row.classList.remove('is-win-bounce');
    }

    async function onNewGame() {
      hideToast();
      for (const row of tileEls) {
        for (const tile of row) {
          tile.classList.add('is-resetting');
        }
      }
      await sleep(prefersReducedMotion() ? 80 : 220);

      const state = game.newGame();
      for (const row of tileEls) {
        for (const tile of row) {
          tile.classList.remove('is-resetting');
        }
      }
      renderBoard(state, { instant: true });
      renderKeyboard(state);
      updateCta(state);
    }

    function openHelp() {
      if (!els.helpDialog || els.helpDialog.open) return;
      if (typeof els.helpDialog.showModal === 'function') {
        els.helpDialog.showModal();
      } else {
        els.helpDialog.setAttribute('open', '');
      }
    }

    function onKeyDown(e) {
      const dictDialog = document.getElementById('dict-dialog');
      if (dictDialog && dictDialog.open) return;
      if (els.helpDialog && els.helpDialog.open) return;

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        flashKey('Enter');
        handleAction('Enter');
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        flashKey('Backspace');
        handleAction('Backspace');
        return;
      }
      if (/^[а-яёА-ЯЁ]$/.test(e.key)) {
        const key = e.key.toUpperCase();
        flashKey(key);
        handleAction(key);
      }
    }

    async function handleAction(action) {
      const state = game.getState();
      if (state.revealing) return;
      if (state.status !== STATUS.PLAYING) return;

      if (action === 'Enter') {
        await onSubmit();
        return;
      }
      if (action === 'Backspace') {
        if (!persistentToast) hideToast();
        const res = game.backspace();
        if (res.ok) renderBoard(res.state);
        return;
      }
      if (/^[А-ЯЁ]$/.test(action)) {
        if (!persistentToast) hideToast();
        const res = game.addLetter(action);
        if (res.ok) renderBoard(res.state);
      }
    }

    async function onSubmit() {
      const before = game.getState();
      const result = game.submit();

      if (!result.ok) {
        if (result.message) {
          showToast(result.message);
          shakeRow(before.currentRow);
        }
        return;
      }

      hideToast();
      game.setRevealing(true);
      renderKeyboard(game.getState());

      await revealRow(result.submittedRow, result.evaluation, result.state.keyboard);

      game.setRevealing(false);
      const after = game.getState();
      renderKeyboard(after);
      updateCta(after);

      if (result.won) {
        await sleep(120);
        await bounceWinRow(result.submittedRow);
        showToast(resultToastHtml('Угадал!', escapeHtml(result.winMessage)), {
          persistent: true,
          html: true,
          kind: 'win',
        });
      } else if (result.lost) {
        const answerHtml =
          `Слово: <span class="answer-word">${escapeHtml(result.answer)}</span>`;
        showToast(resultToastHtml('Попытки кончились', answerHtml), {
          persistent: true,
          html: true,
          kind: 'lose',
        });
      }
    }
  }

  global.AgentUI = { boot };
})(window);
