/**
 * Лидерборд: запись партий и чтение агрегата из Supabase.
 * Данные: таблица games (insert) и view leaderboard (select), доступ ограничен RLS.
 */
(function (global) {
  'use strict';

  const PLAYER_KEY = 'agent-ru-player';
  const ANON_KEY = 'agent-ru-anon-id';
  const CACHE_KEY = 'agent-ru-leaderboard';
  // Поднимать при смене набора колонок во вьюхе leaderboard
  const CACHE_VERSION = 1;
  const PLAYER_MAX = 24;
  // Ник по умолчанию, если игрок отказался вводить свой
  const ANON_PREFIX = 'Аноним-';
  const TOP_LIMIT = 50;
  const TIMEOUT_MS = 8000;
  const ORDER = 'win_rate.desc,avg_attempts.asc.nullslast,games.desc';

  const config = global.AgentConfig || {};
  const baseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const apiKey = String(config.supabaseKey || '');

  function isConfigured() {
    return Boolean(baseUrl) && Boolean(apiKey) && apiKey.indexOf('PASTE_') !== 0;
  }

  function signal() {
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      return AbortSignal.timeout(TIMEOUT_MS);
    }
    return undefined;
  }

  async function request(path, options, label) {
    const opts = options || {};

    try {
      const res = await fetch(baseUrl + '/rest/v1/' + path, {
        method: opts.method,
        body: opts.body,
        headers: Object.assign(
          { apikey: apiKey, Authorization: 'Bearer ' + apiKey },
          opts.headers || {},
        ),
        signal: signal(),
      });

      if (!res.ok) {
        console.warn(label, res.status, await res.text());
        return { ok: false, reason: 'http-' + res.status };
      }
      return { ok: true, res: res };
    } catch (err) {
      console.warn(label, err);
      return { ok: false, reason: 'network' };
    }
  }

  function normalizePlayer(raw) {
    return String(raw || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, PLAYER_MAX);
  }

  function getPlayer() {
    try {
      return normalizePlayer(localStorage.getItem(PLAYER_KEY));
    } catch (err) {
      return '';
    }
  }

  function setPlayer(raw) {
    const name = normalizePlayer(raw);
    if (!name) return '';
    try {
      localStorage.setItem(PLAYER_KEY, name);
    } catch (err) {
      console.warn('Не удалось сохранить ник', err);
    }
    return name;
  }

  function randomId() {
    const bytes = new Uint8Array(3);
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Ник для тех, кто отказался представляться. Суффикс постоянен для устройства,
   * чтобы партии разных анонимов не сливались в одну строку таблицы.
   */
  function anonPlayer() {
    try {
      let id = localStorage.getItem(ANON_KEY);
      if (!id) {
        id = randomId();
        localStorage.setItem(ANON_KEY, id);
      }
      return ANON_PREFIX + id;
    } catch (err) {
      return ANON_PREFIX + randomId();
    }
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== CACHE_VERSION) return null;
      if (!Array.isArray(parsed.rows)) return null;
      return parsed.rows;
    } catch (err) {
      return null;
    }
  }

  function writeCache(rows) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_VERSION, rows: rows }));
    } catch (err) {
      console.warn('Кеш лидерборда не сохранён', err);
    }
  }

  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (err) {
      /* приватный режим — кеша просто не будет */
    }
  }

  async function submitGame(game) {
    if (!isConfigured()) return { ok: false, reason: 'not-configured' };

    const player = getPlayer();
    if (!player) return { ok: false, reason: 'no-player' };

    const payload = {
      player: player,
      word: String(game.word || '').toUpperCase(),
      attempts: game.won ? game.attempts : null,
      won: Boolean(game.won),
      duration_ms: Number.isFinite(game.durationMs) ? Math.round(game.durationMs) : null,
    };

    const result = await request(
      'games',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(payload),
      },
      'Партия не записана',
    );

    if (!result.ok) return { ok: false, reason: result.reason };

    clearCache();
    return { ok: true };
  }

  async function fetchLeaderboard() {
    if (!isConfigured()) return { ok: false, reason: 'not-configured', rows: [] };

    const query = '?select=*&order=' + ORDER + '&limit=' + TOP_LIMIT;
    const result = await request('leaderboard' + query, null, 'Лидерборд не загружен');

    if (!result.ok) return { ok: false, reason: result.reason, rows: [] };

    const rows = await result.res.json();
    writeCache(rows);
    return { ok: true, rows: rows };
  }

  global.AgentScore = {
    PLAYER_MAX: PLAYER_MAX,
    anonPlayer: anonPlayer,
    isConfigured: isConfigured,
    normalizePlayer: normalizePlayer,
    getPlayer: getPlayer,
    setPlayer: setPlayer,
    submitGame: submitGame,
    fetchLeaderboard: fetchLeaderboard,
    getCachedLeaderboard: readCache,
  };
})(window);
