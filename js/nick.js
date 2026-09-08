/**
 * Диалог ввода ника. Общий для игры и страницы лидеров.
 * Хранением ника не занимается — сохраняет вызывающая сторона.
 */
(function (global) {
  'use strict';

  /**
   * @returns {Promise<string>} введённое значение или '' при отказе
   */
  function ask(options) {
    const opts = options || {};
    const dialog = document.getElementById('nick-dialog');
    const input = document.getElementById('nick-input');
    const skip = document.getElementById('nick-skip');

    if (!dialog || !input || dialog.open) return Promise.resolve('');

    return new Promise(function (resolve) {
      let confirmed = false;

      function onSubmit() {
        confirmed = true;
      }

      function onSkip() {
        confirmed = false;
        dialog.close();
      }

      function onClose() {
        dialog.removeEventListener('submit', onSubmit);
        dialog.removeEventListener('close', onClose);
        if (skip) skip.removeEventListener('click', onSkip);
        resolve(confirmed ? input.value : '');
      }

      dialog.addEventListener('submit', onSubmit);
      dialog.addEventListener('close', onClose);
      if (skip) skip.addEventListener('click', onSkip);

      input.value = opts.prefill || '';
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      requestAnimationFrame(function () {
        input.focus();
        input.select();
      });
    });
  }

  global.AgentNick = { ask: ask };
})(window);
