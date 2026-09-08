/**
 * Таблица лидеров. Рендер без знания о сети — данные приходят из window.AgentScore.
 */
(function (global) {
  'use strict';

  // motion.css: delay = --i × 24ms. Потолок держит стаггер в пределах 200ms
  const STAGGER_MAX = 8;

  const MESSAGES = {
    loading: 'Загружаем…',
    empty: 'Пока ни одной партии. Сыграй — и попадёшь в таблицу.',
    error: 'Не удалось загрузить таблицу. Проверь соединение.',
    offline: 'Таблица недоступна: база не подключена.',
  };

  function formatAttempts(value) {
    if (value === null || value === undefined || value === '') return '—';
    const num = Number(value);
    if (!Number.isFinite(num)) return '—';
    return num.toFixed(1).replace('.', ',');
  }

  // Порядок должен совпадать с <thead> в score.html
  const COLUMNS = [
    { cls: 'score-table__cell--rank', value: (row, i) => String(i + 1) },
    { cls: 'score-table__cell--player', value: (row) => row.player },
    { cls: 'score-table__cell--num', value: (row) => String(row.games) },
    { cls: 'score-table__cell--num', value: (row) => String(row.wins) },
    { cls: 'score-table__cell--rate', value: (row) => String(row.win_rate) + '%' },
    {
      cls: 'score-table__cell--num score-table__cell--attempts',
      value: (row) => formatAttempts(row.avg_attempts),
    },
  ];

  function buildRow(row, index, me) {
    const tr = document.createElement('tr');
    tr.className = 'score-table__row';
    tr.style.setProperty('--i', String(Math.min(index, STAGGER_MAX)));
    if (me && row.player === me) tr.classList.add('is-me');

    for (const column of COLUMNS) {
      const td = document.createElement('td');
      td.className = 'score-table__cell ' + column.cls;
      td.textContent = column.value(row, index);
      tr.appendChild(td);
    }

    return tr;
  }

  function mount(root) {
    if (!root || !global.AgentScore) return null;

    const bodyEl = root.querySelector('[data-score-body]');
    const statusEl = root.querySelector('[data-score-status]');
    const tableEl = root.querySelector('[data-score-table]');
    const nickEl = root.querySelector('[data-score-nick]');
    const nickEditEl = root.querySelector('[data-score-nick-edit]');
    if (!bodyEl || !statusEl || !tableEl) return null;

    let rendered = '';
    let loadToken = 0;

    function setStatus(text) {
      statusEl.textContent = text || '';
      statusEl.hidden = !text;
    }

    function renderNick() {
      if (!nickEl) return;
      const player = global.AgentScore.getPlayer();
      nickEl.textContent = player ? 'Ты играешь как ' + player : 'Ник пока не задан';
    }

    async function onNickEdit() {
      const name = global.AgentScore.setPlayer(
        await global.AgentNick.ask({ prefill: global.AgentScore.getPlayer() }),
      );
      if (!name) return;

      renderNick();
      // подсветка своей строки зависит от ника, данные могли не измениться
      rendered = '';
      load();
    }

    function showTable(visible) {
      tableEl.hidden = !visible;
    }

    function renderRows(rows) {
      const me = global.AgentScore.getPlayer();
      const frag = document.createDocumentFragment();
      rows.forEach(function (row, index) {
        frag.appendChild(buildRow(row, index, me));
      });
      bodyEl.replaceChildren(frag);
      setStatus('');
      showTable(true);
    }

    async function load() {
      const token = ++loadToken;

      if (!global.AgentScore.isConfigured()) {
        setStatus(MESSAGES.offline);
        showTable(false);
        return;
      }

      const cached = global.AgentScore.getCachedLeaderboard();
      if (cached && cached.length) {
        renderRows(cached);
        rendered = JSON.stringify(cached);
      } else {
        setStatus(MESSAGES.loading);
        showTable(false);
      }

      const result = await global.AgentScore.fetchLeaderboard();
      if (token !== loadToken) return;

      if (!result.ok) {
        if (!rendered) setStatus(MESSAGES.error);
        return;
      }
      if (!result.rows.length) {
        rendered = '';
        bodyEl.replaceChildren();
        setStatus(MESSAGES.empty);
        showTable(false);
        return;
      }

      const fresh = JSON.stringify(result.rows);
      if (fresh === rendered) return;

      rendered = fresh;
      renderRows(result.rows);
    }

    if (nickEditEl && global.AgentNick) {
      nickEditEl.addEventListener('click', onNickEdit);
    }

    renderNick();
    load();
    return { load: load };
  }

  global.AgentScorePage = { mount: mount };
})(window);
