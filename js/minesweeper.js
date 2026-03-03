
//Creo abreviatura
let $ = (sel) => document.querySelector(sel);
//Enlazo a los ids
let difficultyEl = $("#difficulty");
let rowsEl = $("#rows");
let colsEl = $("#cols");
let minesEl = $("#mines");
let btnNew = $("#btnNew");
let boardEl = $("#board");
let msgEl = $("#message");
let minesTotalEl = $("#minesTotal");
let flagsCountEl = $("#flagsCount");
let timeEl = $("#time");
let bestTimeEl = $("#bestTime");
//Estado global de la partida y el timer
let game = null;
let timerId = null;

//Creo la funcion para crear la partida 
function createGame(rows, cols, mines) {
  let maxMines = rows * cols - 1; 
  let safeMines = Math.max(1, Math.min(mines, maxMines)); //
  //Creo el panel (matriz) como un grid
  let grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      r, c, 
      mine: false, 
      adjacent: 0, 
      revealed: false,
      flagged: false, 
    }))
  );

  // Colocar minas aleatorias
  let positions = [];
  for (let i = 0; i < rows * cols; i++) positions.push(i); 
  shuffleInPlace(positions); 

  for (let i = 0; i < safeMines; i++) { 
    let idx = positions[i]; 
    let r = Math.floor(idx / cols); 
    let c = idx % cols;
    grid[r][c].mine = true; 
  }
  //para cada celda que no sea mina calcula adjacent
  for (let r = 0; r < rows; r++) { 
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].mine) continue;
      grid[r][c].adjacent = countAdjacentMines(grid, rows, cols, r, c);
    }
  }
  //Devolver objeto partida
  return {
    rows,
    cols,
    mines: safeMines,
    grid,
    flagsCount: 0,
    revealedSafeCount: 0, 
    startedAt: null,
    ended: false,
    won: false,
  };
}
//Mezclar el array
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
//Comprueba si las coordenadas estan dentro 
function inBounds(rows, cols, r, c) {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}
//Devuelve las 8 posiciones vecinas
function neighbors(r, c) {
  return [
    [r - 1, c - 1], [r - 1, c], [r - 1, c + 1],
    [r, c - 1],               [r, c + 1],
    [r + 1, c - 1], [r + 1, c], [r + 1, c + 1],
  ];
}
//Recorre vecinos y cuenta minas
function countAdjacentMines(grid, rows, cols, r, c) {
  let count = 0;
  for (const [nr, nc] of neighbors(r, c)) {
    if (inBounds(rows, cols, nr, nc) && grid[nr][nc].mine) count++;
  }
  return count;
}
//Solo arrancar una vez
function startTimerIfNeeded() {
  if (game.startedAt !== null) return;
  game.startedAt = Date.now();
  stopTimer();
  timerId = setInterval(() => {
    timeEl.textContent = String(getElapsedSeconds());
  }, 250);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function getElapsedSeconds() {
  if (!game.startedAt) return 0;
  let end = game.ended ? game.endedAt : Date.now();
  return Math.max(0, Math.floor((end - game.startedAt) / 1000));
}
//Mensajes ganar/perder
function setMessage(text, type = "info") {
  if (type === "win") msgEl.innerHTML = `✅ <b>Victoria</b> — ${text}`;
  else if (type === "lose") msgEl.innerHTML = `💥 <b>Game Over</b> — ${text}`;
  else msgEl.innerHTML = text;
}

function bestKey(rows, cols, mines) {
  return `cb_minesweeper_best_${rows}x${cols}_${mines}`;
}

function loadBest(rows, cols, mines) {
  let raw = localStorage.getItem(bestKey(rows, cols, mines));
  let n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function saveBest(rows, cols, mines, seconds) {
  localStorage.setItem(bestKey(rows, cols, mines), String(seconds));
}
//Para refrescarminas, banderas, tiempo actual y mejor tiempo
function updateTopUI() {
  minesTotalEl.textContent = String(game.mines);
  flagsCountEl.textContent = String(game.flagsCount);
  timeEl.textContent = String(getElapsedSeconds());

  let best = loadBest(game.rows, game.cols, game.mines);
  bestTimeEl.textContent = best === null ? "—" : `${best}s`;
}

function renderBoard() {
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${game.cols}, 34px)`;

  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      let cell = game.grid[r][c];
      let btn = document.createElement("button");
      btn.className = "cell";
      btn.type = "button";
      btn.dataset.r = String(r);
      btn.dataset.c = String(c);
      btn.setAttribute("aria-label", `Celda ${r + 1},${c + 1}`);

      paintCell(btn, cell);

      // Click izquierdo
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        onLeftClick(r, c);
      });

      // Click derecho (bandera)
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        onRightClick(r, c);
      });

      boardEl.appendChild(btn);
    }
  }
}
//Establecer iconos 
function paintCell(btn, cell) {
  btn.classList.toggle("revealed", cell.revealed);
  btn.classList.toggle("flagged", cell.flagged);
  btn.classList.toggle("mine", cell.mine);

  if (!cell.revealed) {
    btn.textContent = cell.flagged ? "🚩" : "";
    return;
  }

  if (cell.mine) {
    btn.textContent = "💣";
    return;
  }

  if (cell.adjacent === 0) {
    btn.textContent = "";
    return;
  }

  btn.textContent = String(cell.adjacent);
}

function getCellButton(r, c) {
  return boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function revealAllMines() {
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      let cell = game.grid[r][c];
      if (cell.mine) {
        cell.revealed = true;
        let btn = getCellButton(r, c);
        if (btn) paintCell(btn, cell);
      }
    }
  }
}

function onLeftClick(r, c) {
  if (!game || game.ended) return;

  let cell = game.grid[r][c];
  if (cell.revealed || cell.flagged) return;

  startTimerIfNeeded();

  if (cell.mine) {
    // Game Over
    cell.revealed = true;
    paintCell(getCellButton(r, c), cell);

    game.ended = true;
    game.won = false;
    game.endedAt = Date.now();
    revealAllMines();
    stopTimer();

    setMessage(`Has explotado en ${getElapsedSeconds()}s. Pulsa "Crear / Reiniciar" para volver a jugar.`, "lose");
    updateTopUI();
    return;
  }

  // Revelar celda + cascada si 0
  revealSafeCell(r, c);

  // ¿Victoria?
  let totalSafe = game.rows * game.cols - game.mines;
  if (game.revealedSafeCount >= totalSafe) {
    game.ended = true;
    game.won = true;
    game.endedAt = Date.now();
    stopTimer();

    let secs = getElapsedSeconds();
    let currentBest = loadBest(game.rows, game.cols, game.mines);
    if (currentBest === null || secs < currentBest) {
      saveBest(game.rows, game.cols, game.mines, secs);
    }

    setMessage(`Has completado el tablero en ${secs}s.`, "win");
    updateTopUI();
  }
}

function revealSafeCell(r, c) {
  let queue = [[r, c]];

  while (queue.length) {
    let [cr, cc] = queue.shift();
    let current = game.grid[cr][cc];

    if (current.revealed || current.flagged) continue;
    if (current.mine) continue; 

    current.revealed = true;
    game.revealedSafeCount++;

    let btn = getCellButton(cr, cc);
    if (btn) paintCell(btn, current);

    if (current.adjacent === 0) {
      for (let [nr, nc] of neighbors(cr, cc)) {
        if (!inBounds(game.rows, game.cols, nr, nc)) continue;
        let ncell = game.grid[nr][nc];
        if (!ncell.revealed && !ncell.flagged && !ncell.mine) {
          queue.push([nr, nc]);
        }
      }
    }
  }
}

function onRightClick(r, c) {
  if (!game || game.ended) return;

  let cell = game.grid[r][c];
  if (cell.revealed) return;

  // No arrancamos el timer con click derecho (decisión típica y cómoda para entrega)
  cell.flagged = !cell.flagged;
  game.flagsCount += cell.flagged ? 1 : -1;

  paintCell(getCellButton(r, c), cell);
  updateTopUI();
}

function applyDifficultyPreset(value) {
  let presets = {
    easy:   { rows: 8,  cols: 8,  mines: 10 },
    medium: { rows: 12, cols: 12, mines: 30 },
    hard:   { rows: 16, cols: 16, mines: 50 },
  };

  if (!presets[value]) return;

  rowsEl.value = String(presets[value].rows);
  colsEl.value = String(presets[value].cols);
  minesEl.value = String(presets[value].mines);
}

function clampInputs() {
  let rows = Math.max(4, Math.min(40, Number(rowsEl.value || 8)));
  let cols = Math.max(4, Math.min(60, Number(colsEl.value || 8)));
  let maxMines = rows * cols - 1;

  let mines = Number(minesEl.value || 10);
  mines = Math.max(1, Math.min(maxMines, mines));

  rowsEl.value = String(rows);
  colsEl.value = String(cols);
  minesEl.value = String(mines);

  return { rows, cols, mines };
}

function newGame() {
  stopTimer();

  let { rows, cols, mines } = clampInputs();
  game = createGame(rows, cols, mines);

  setMessage(`Tablero creado: <b>${rows}×${cols}</b> con <b>${game.mines}</b> minas.`, "info");
  renderBoard();
  updateTopUI();
}

difficultyEl.addEventListener("change", (e) => {
  let val = e.target.value;
  if (val !== "custom") {
    applyDifficultyPreset(val);
    newGame();
  }
});

[rowsEl, colsEl, minesEl].forEach((el) => {
  el.addEventListener("input", () => {
    difficultyEl.value = "custom";
  });
});

btnNew.addEventListener("click", () => {
  newGame();
});

// Arranque inicial
newGame();