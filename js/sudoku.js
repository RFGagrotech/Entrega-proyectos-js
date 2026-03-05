let $ = (sel) => document.querySelector(sel);

let modeEl = $("#sudokuMode");
let btnLoad = $("#sudokuBtnLoad");
let btnClear = $("#sudokuBtnClear");
let btnValidate = $("#sudokuBtnValidate");
let btnSolve = $("#sudokuBtnSolve");
let sudokuEl = $("#sudokuBoard");
let msgEl = $("#sudokuMessage");
let statsEl = $("#sudokuStats");

// Ejemplo típico (0 = vacío)
let EXAMPLE = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],

  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],

  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

let LS_KEY = "cb_sudoku_state_v2"; // cambio key para no mezclar con estados previos

let givenMask = makeEmptyMask(); // true si la celda es "fija"
let solving = false;

function makeEmptyBoard() {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0));
}

function makeEmptyMask() {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => false));
}

function deepCopyBoard(board) {
  return board.map((row) => row.slice());
}

function setMessage(text, type = "info") {
  let icon = type === "ok" ? "✅" : type === "error" ? "⚠️" : "ℹ️";
  msgEl.innerHTML = `${icon} ${text}`;
}

function qCell(r, c) {
  return sudokuEl.querySelector(`.sudokuCell[data-r="${r}"][data-c="${c}"]`);
}

function buildGrid() {
  sudokuEl.innerHTML = "";

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      let input = document.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.maxLength = 1;

      input.className = "sudokuCell";
      input.dataset.r = String(r);
      input.dataset.c = String(c);
      input.setAttribute("aria-label", `Celda ${r + 1},${c + 1}`);

      if (c === 2 || c === 5) input.classList.add("bR");
      if (r === 2 || r === 5) input.classList.add("bB");

      input.addEventListener("input", (e) => {
        if (solving) return;
        let v = e.target.value.trim();

        if (v === "") {
          e.target.value = "";
          e.target.classList.remove("invalid");
          persist();
          updateStats();
          return;
        }

        // Solo dígitos 1-9
        if (!/^[1-9]$/.test(v)) {
          e.target.value = "";
          persist();
          updateStats();
          return;
        }

        // Si es "given", no se cambia.
        if (givenMask[r][c]) {
          e.target.value = String(getBoardFromUI()[r][c] || "");
          return;
        }

        e.target.value = v;
        e.target.classList.remove("invalid");
        persist();
        updateStats();
      });

      // Navegación con flechas.
      input.addEventListener("keydown", (e) => {
        let key = e.key;
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) return;

        e.preventDefault();
        let nr = r + (key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0);
        let nc = c + (key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0);
        if (nr < 0 || nr > 8 || nc < 0 || nc > 8) return;

        let next = qCell(nr, nc);
        if (next) next.focus();
      });

      sudokuEl.appendChild(input);
    }
  }
}

function renderBoard(board, mask = makeEmptyMask()) {
  givenMask = mask;

  // limpiar invalid
  sudokuEl.querySelectorAll(".sudokuCell").forEach((el) => el.classList.remove("invalid"));

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      let el = qCell(r, c);
      let v = board[r][c];

      el.value = v === 0 ? "" : String(v);
      el.classList.toggle("given", !!givenMask[r][c]);
      el.readOnly = !!givenMask[r][c];
    }
  }

  persist();
  updateStats();
}

function clearAll() {
  renderBoard(makeEmptyBoard(), makeEmptyMask());
  setMessage("Tablero vacío. Puedes rellenar a mano.", "info");
}

function loadExample() {
  let mask = EXAMPLE.map((row) => row.map((v) => v !== 0));
  renderBoard(deepCopyBoard(EXAMPLE), mask);
  setMessage("Ejemplo cargado. Pulsa Validar o Resolver.", "info");
}

function getBoardFromUI() {
  let board = makeEmptyBoard();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      let el = qCell(r, c);
      let v = el.value.trim();
      board[r][c] = v === "" ? 0 : Number(v);
    }
  }
  return board;
}

function markInvalidCells(positions) {
  sudokuEl.querySelectorAll(".sudokuCell").forEach((el) => el.classList.remove("invalid"));
  for (let { r, c } of positions) {
    let el = qCell(r, c);
    if (el) el.classList.add("invalid");
  }
}

function updateStats() {
  let b = getBoardFromUI();
  let filled = 0;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (b[r][c] !== 0) filled++;
  statsEl.textContent = `Rellenas: ${filled}/81`;
}

function validateBoard(board) {
  let conflicts = [];

  function checkUnit(cells) {
    let seen = new Map(); // num -> {r,c}
    for (let { r, c } of cells) {
      let v = board[r][c];
      if (v === 0) continue;
      if (seen.has(v)) {
        conflicts.push({ r, c });
        conflicts.push(seen.get(v));
      } else {
        seen.set(v, { r, c });
      }
    }
  }

  for (let r = 0; r < 9; r++) checkUnit(Array.from({ length: 9 }, (_, c) => ({ r, c })));
  for (let c = 0; c < 9; c++) checkUnit(Array.from({ length: 9 }, (_, r) => ({ r, c })));

  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      let cells = [];
      for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) cells.push({ r, c });
      checkUnit(cells);
    }
  }

  let key = (p) => `${p.r}-${p.c}`;
  let uniq = Array.from(new Map(conflicts.map((p) => [key(p), p])).values());

  return { ok: uniq.length === 0, conflicts: uniq };
}

function findEmpty(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) return { r, c };
    }
  }
  return null;
}

function isValidPlacement(board, r, c, n) {
  for (let x = 0; x < 9; x++) if (board[r][x] === n) return false;
  for (let x = 0; x < 9; x++) if (board[x][c] === n) return false;

  let br = Math.floor(r / 3) * 3;
  let bc = Math.floor(c / 3) * 3;
  for (let rr = br; rr < br + 3; rr++) {
    for (let cc = bc; cc < bc + 3; cc++) {
      if (board[rr][cc] === n) return false;
    }
  }
  return true;
}

function solveSudoku(board) {
  let empty = findEmpty(board);
  if (!empty) return true;

  let { r, c } = empty;

  for (let n = 1; n <= 9; n++) {
    if (!isValidPlacement(board, r, c, n)) continue;
    board[r][c] = n;
    if (solveSudoku(board)) return true;
    board[r][c] = 0;
  }

  return false;
}

function persist() {
  let state = {
    board: getBoardFromUI(),
    givenMask,
    mode: modeEl.value,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function restore() {
  let raw = localStorage.getItem(LS_KEY);
  if (!raw) return false;

  try {
    let state = JSON.parse(raw);
    if (!state || !Array.isArray(state.board) || state.board.length !== 9) return false;
    modeEl.value = state.mode || "empty";
    renderBoard(state.board, state.givenMask || makeEmptyMask());
    setMessage("Estado restaurado desde la última sesión.", "info");
    return true;
  } catch {
    return false;
  }
}

btnLoad.addEventListener("click", () => {
  let mode = modeEl.value;
  if (mode === "example") loadExample();
  else clearAll();
});

btnClear.addEventListener("click", () => {
  clearAll();
});

btnValidate.addEventListener("click", () => {
  let board = getBoardFromUI();
  let v = validateBoard(board);
  if (v.ok) {
    markInvalidCells([]);
    setMessage("Tablero válido (sin conflictos).", "ok");
  } else {
    markInvalidCells(v.conflicts);
    setMessage("Tablero inválido: hay números repetidos en alguna fila/columna/subcuadrante.", "error");
  }
});

btnSolve.addEventListener("click", () => {
  if (solving) return;
  solving = true;

  let board = getBoardFromUI();
  let v = validateBoard(board);

  if (!v.ok) {
    markInvalidCells(v.conflicts);
    setMessage("No se puede resolver: primero corrige los conflictos del tablero.", "error");
    solving = false;
    return;
  }

  let work = deepCopyBoard(board);
  let t0 = performance.now();
  let ok = solveSudoku(work);
  let t1 = performance.now();
  if (!ok) {
    setMessage("Este Sudoku no tiene solución (o el tablero es inconsistente).", "error");
    solving = false;
    return;
  }

  renderBoard(work, givenMask);
  markInvalidCells([]);
  setMessage(`Resuelto en ${(t1 - t0).toFixed(1)} ms.`, "ok");
  solving = false;
});

buildGrid();
if (!restore()) {
  setMessage("Listo. Elige modo y pulsa Cargar.", "info");
  clearAll();
}