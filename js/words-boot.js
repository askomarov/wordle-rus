/**
 * Boot dictionary UI when present on the page.
 */
(function () {
  'use strict';
  if (window.AgentWordsSearch) {
    window.AgentWordsSearch.boot({
      locale: 'ru',
      letterRe: /^[А-ЯЁ]$/,
      labels: { found: 'Найдено: ', total: 'Всего слов: ' },
    });
  }
})();
