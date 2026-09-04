/**
 * Pure game logic — no DOM.
 */
(function (global) {
  'use strict';

  const { solutions, validGuesses } = global.AgentWords;

  const WORD_LENGTH = 5;
  const MAX_GUESSES = 5;

  const CYRILLIC = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';

  const STATUS = {
    PLAYING: 'playing',
    WON: 'won',
    LOST: 'lost',
  };

  const LETTER = {
    EMPTY: 'empty',
    FILLED: 'filled',
    CORRECT: 'correct',
    PRESENT: 'present',
    ABSENT: 'absent',
  };

  const KEY = {
    UNUSED: 'unused',
    CORRECT: 'correct',
    PRESENT: 'present',
    ABSENT: 'absent',
  };

  const KEY_RANK = {
    [KEY.UNUSED]: 0,
    [KEY.ABSENT]: 1,
    [KEY.PRESENT]: 2,
    [KEY.CORRECT]: 3,
  };

  const WIN_MESSAGES = {
    1: 'Гений',
    2: 'Великолепно',
    3: 'Впечатляет',
    4: 'Отлично',
    5: 'На грани',
  };

  function isCyrillicLetter(ch) {
    return typeof ch === 'string' && ch.length === 1 && CYRILLIC.includes(ch);
  }

  function evaluateGuess(guess, answer) {
    const result = Array(WORD_LENGTH).fill(LETTER.ABSENT);
    const answerChars = answer.split('');
    const reserved = Array(WORD_LENGTH).fill(false);

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guess[i] === answerChars[i]) {
        result[i] = LETTER.CORRECT;
        reserved[i] = true;
      }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === LETTER.CORRECT) continue;
      const idx = answerChars.findIndex((ch, j) => ch === guess[i] && !reserved[j]);
      if (idx !== -1) {
        result[i] = LETTER.PRESENT;
        reserved[idx] = true;
      }
    }

    return result;
  }

  function strongerKeyState(current, next) {
    return KEY_RANK[next] > KEY_RANK[current] ? next : current;
  }

  function emptyBoard() {
    return Array.from({ length: MAX_GUESSES }, () =>
      Array.from({ length: WORD_LENGTH }, () => ({
        letter: '',
        state: LETTER.EMPTY,
      })),
    );
  }

  function emptyKeyboard() {
    const keys = {};
    for (const ch of CYRILLIC) {
      keys[ch] = KEY.UNUSED;
    }
    return keys;
  }

  function pickAnswer(exclude) {
    if (solutions.length === 0) return null;
    if (solutions.length === 1) return solutions[0];

    let word;
    do {
      word = solutions[Math.floor(Math.random() * solutions.length)];
    } while (word === exclude);
    return word;
  }

  function createGame() {
    let answer = null;
    let previousAnswer = null;
    let board = emptyBoard();
    let keyboard = emptyKeyboard();
    let currentRow = 0;
    let currentCol = 0;
    let status = STATUS.PLAYING;
    let revealing = false;
    let error = null;

    function snapshot() {
      return {
        answer,
        board: board.map((row) => row.map((cell) => ({ ...cell }))),
        keyboard: { ...keyboard },
        currentRow,
        currentCol,
        status,
        revealing,
        error,
        currentGuess: board[currentRow]
          ? board[currentRow].map((c) => c.letter).join('')
          : '',
      };
    }

    function startRound() {
      const next = pickAnswer(previousAnswer);
      if (!next) {
        error = 'Нет слов в словаре';
        status = STATUS.LOST;
        answer = null;
        return snapshot();
      }

      previousAnswer = answer;
      answer = next;
      board = emptyBoard();
      keyboard = emptyKeyboard();
      currentRow = 0;
      currentCol = 0;
      status = STATUS.PLAYING;
      revealing = false;
      error = null;
      return snapshot();
    }

    function canAcceptInput() {
      return status === STATUS.PLAYING && !revealing && !error;
    }

    function addLetter(letter) {
      const ch = String(letter).toUpperCase();
      if (!isCyrillicLetter(ch)) return { ok: false, reason: 'ignored', state: snapshot() };
      if (!canAcceptInput()) return { ok: false, reason: 'blocked', state: snapshot() };
      if (currentCol >= WORD_LENGTH) return { ok: false, reason: 'full', state: snapshot() };

      board[currentRow][currentCol] = { letter: ch, state: LETTER.FILLED };
      currentCol += 1;
      return { ok: true, state: snapshot() };
    }

    function backspace() {
      if (!canAcceptInput()) return { ok: false, reason: 'blocked', state: snapshot() };
      if (currentCol <= 0) return { ok: false, reason: 'empty', state: snapshot() };

      currentCol -= 1;
      board[currentRow][currentCol] = { letter: '', state: LETTER.EMPTY };
      return { ok: true, state: snapshot() };
    }

    function submit() {
      if (!canAcceptInput()) return { ok: false, reason: 'blocked', state: snapshot() };

      if (currentCol < WORD_LENGTH) {
        return {
          ok: false,
          reason: 'too-short',
          message: 'Мало букв',
          state: snapshot(),
        };
      }

      const guess = board[currentRow].map((c) => c.letter).join('');
      if (!validGuesses.has(guess)) {
        return {
          ok: false,
          reason: 'invalid',
          message: 'Нет в словаре',
          state: snapshot(),
        };
      }

      const evaluation = evaluateGuess(guess, answer);
      const submittedRow = currentRow;

      for (let i = 0; i < WORD_LENGTH; i++) {
        board[currentRow][i] = {
          letter: guess[i],
          state: evaluation[i],
        };
        keyboard[guess[i]] = strongerKeyState(keyboard[guess[i]], evaluation[i]);
      }

      const won = evaluation.every((s) => s === LETTER.CORRECT);
      let lost = false;

      if (won) {
        status = STATUS.WON;
      } else if (currentRow >= MAX_GUESSES - 1) {
        status = STATUS.LOST;
        lost = true;
      } else {
        currentRow += 1;
        currentCol = 0;
      }

      return {
        ok: true,
        evaluation,
        submittedRow,
        attempt: submittedRow + 1,
        won,
        lost,
        winMessage: won ? WIN_MESSAGES[submittedRow + 1] : null,
        answer,
        state: snapshot(),
      };
    }

    function setRevealing(value) {
      revealing = Boolean(value);
      return snapshot();
    }

    return {
      startRound,
      newGame: startRound,
      addLetter,
      backspace,
      submit,
      setRevealing,
      getState: snapshot,
      getAnswer: () => answer,
      solutionsCount: solutions.length,
    };
  }

  function runSelfChecks() {
    return [
      {
        name: 'КОКОС vs СОКОЛ',
        pass:
          evaluateGuess('КОКОС', 'СОКОЛ').join(',') ===
          'absent,correct,correct,correct,present',
      },
      {
        name: 'ППППП vs КНИГА',
        pass: evaluateGuess('ППППП', 'КНИГА').every((s) => s === 'absent'),
      },
      {
        name: 'exact match',
        pass: evaluateGuess('СЛОВО', 'СЛОВО').every((s) => s === 'correct'),
      },
      {
        name: 'Ё distinct from Е',
        pass: evaluateGuess('ЁРШИК', 'ЕРШИК').join(',') === 'absent,correct,correct,correct,correct',
      },
    ];
  }

  global.AgentGame = {
    WORD_LENGTH,
    MAX_GUESSES,
    STATUS,
    LETTER,
    KEY,
    WIN_MESSAGES,
    evaluateGuess,
    createGame,
    runSelfChecks,
  };
})(window);
