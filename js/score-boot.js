/**
 * Boot leaderboard UI when present on the page.
 */
(function () {
  'use strict';
  const root = document.querySelector('[data-score]');
  if (root && window.AgentScorePage) {
    window.AgentScorePage.mount(root);
  }
})();
