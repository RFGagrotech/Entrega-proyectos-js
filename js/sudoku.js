// $: atajo para document.querySelector (coge el PRIMER elemento que coincida con el selector)
let $ = (sel) => document.querySelector(sel);
// Captura de elementos del DOM (selects, botones, contenedores)
let modeEl = $("#sudokuMode"); // Select "Modo" (vacío / ejemplo)
// Botones de la UI
let btnLoad = $("#sudokuBtnLoad");            // "Cargar"
let btnClear = $("#sudokuBtnClear");          // "Limpiar"
let btnValidate = $("#sudokuBtnValidate");    // "Validar"
let btnSolve = $("#sudokuBtnSolve");          // "Resolver"
// Contenedor donde se pintan las 81 celdas (inputs) del sudoku
let sudokuEl = $("#sudokuBoard");
// Zona de mensajes al usuario
let msgEl = $("#sudokuMessage");
// Zona donde se muestran estadísticas (rellenas X/81)
let statsEl = $("#sudokuStats");

// Tablero de ejemplo típico (0 significa "casilla vacía")
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
// Clave para guardar/recuperar estado en localStorage (v2 para no mezclar con versiones antiguas)
let LS_KEY = "cb_sudoku_state_v2"; // cambio key para no mezclar con estados previos
// givenMask: matriz 9x9 de booleanos.
let givenMask = makeEmptyMask(); // true si la celda es "fija"
// solving: flag para evitar que mientras resolvemos (o estamos renderizando), el usuario pueda meter inputs o se disparen handlers de input.
let solving = false;
// Crea un tablero 9x9 lleno de ceros (vacío)
function makeEmptyBoard() {
    // Array.from({length:9}, ...) crea 9 filas, cada fila es un array de 9 ceros
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0));
}
// Crea una máscara 9x9 llena de false (nada es "given")
function makeEmptyMask() {
    // 9 filas, 9 columnas, todo false
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => false));
}
// Copia profunda (simple) del tablero: copia filas para no compartir referencias
function deepCopyBoard(board) {
  // row.slice() clona cada fila
  return board.map((row) => row.slice());
}
// Mensajes al usuario: añade icono según tipo
function setMessage(text, type = "info") {
  // Elegimos un icono según tipo
  let icon = type === "ok" ? "✅" : type === "error" ? "⚠️" : "ℹ️";
  // Usamos innerHTML para poder meter <b> si lo necesitas
  msgEl.innerHTML = `${icon} ${text}`;
}
// Devuelve el input DOM de la celda (r,c)
function qCell(r, c) {
  // Busca dentro del contenedor sudokuEl el input con data-r y data-c exactos
  return sudokuEl.querySelector(`.sudokuCell[data-r="${r}"][data-c="${c}"]`);
}

function buildGrid() {
  sudokuEl.innerHTML = "";
   // Recorremos filas
  for (let r = 0; r < 9; r++) {
    // Recorremos columnas
    for (let c = 0; c < 9; c++) {
      // Creamos un input por celda
      let input = document.createElement("input");
      // Tipo texto (pero lo limitamos a 1 carácter y solo 1-9)
      input.type = "text";
      // inputMode numeric ayuda en móviles a mostrar teclado numérico
      input.inputMode = "numeric";
      // Solo dejamos un carácter (un dígito)
      input.maxLength = 1;
      // Clase base para estilos
      input.className = "sudokuCell";
      // Guardamos posición en data attributes
      input.dataset.r = String(r);
      input.dataset.c = String(c);
      // Accesibilidad
      input.setAttribute("aria-label", `Celda ${r + 1},${c + 1}`);
      // Si estamos en columna 2 o 5, metemos borde a la derecha (separación vertical)
      if (c === 2 || c === 5) input.classList.add("bR");
      // Si estamos en fila 2 o 5, metemos borde abajo (separación horizontal)
      if (r === 2 || r === 5) input.classList.add("bB");
      //Control de entrada (lo que el usuario escribe)
      input.addEventListener("input", (e) => {
        // Si estamos resolviendo, ignoramos entradas
        if (solving) return;
        // Leemos el valor y quitamos espacios
        let v = e.target.value.trim();
        // Permitir borrar:
        if (v === "") {
          // dejamos vacío
          e.target.value = "";
          // quitamos marca de inválido si la tenía
          e.target.classList.remove("invalid");
          // guardamos estado
          persist();
          // actualizamos stats (rellenas X/81)
          updateStats();
          return;
        }

// Si NO es un dígito 1..9, lo consideramos inválido y lo borramos
        if (!/^[1-9]$/.test(v)) {
          e.target.value = "";
          persist();
          updateStats();
          return;
        }

        // Si la celda es "given" (fija), no permitimos cambiarla
        if (givenMask[r][c]) {
          // Reponemos el valor original que esté en el tablero UI (o vacío)
          e.target.value = String(getBoardFromUI()[r][c] || "");
          return;
        }
        // Si pasa validación, lo dejamos tal cual
        e.target.value = v;
        // Quitamos estilo invalid (si venía de antes)
        e.target.classList.remove("invalid");
        // Guardamos y actualizamos estadísticas
        persist();
        updateStats();
      });

      // Navegación con flechas (mover foco)
      input.addEventListener("keydown", (e) => {
        let key = e.key;
        // Si no es una flecha, no hacemos nada
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) return;
        // Evita que el cursor haga cosas raras dentro del input
        e.preventDefault();
        // Calculamos la siguiente celda según la flecha
        let nr = r + (key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0);
        let nc = c + (key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0);
        // Si nos salimos del tablero, no hacemos nada
        if (nr < 0 || nr > 8 || nc < 0 || nc > 8) return;
        // Buscamos el input siguiente y lo enfocamos
        let next = qCell(nr, nc);
        if (next) next.focus();
      });
      // Añadimos el input al DOM
      sudokuEl.appendChild(input);
    }
  }
}
// Renderiza el tablero en la UI y aplica máscara "given"
function renderBoard(board, mask = makeEmptyMask()) {
  // Guardamos la máscara recibida como "givenMask" global
  givenMask = mask;

  // Limpiamos marcas de inválido en todas las celdas
  sudokuEl.querySelectorAll(".sudokuCell").forEach((el) => el.classList.remove("invalid"));
  // Recorremos cada celda para poner su valor en la UI
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      let el = qCell(r, c);       // input DOM
      let v = board[r][c];        // valor numérico del tablero
      // Si v es 0 => input vacío, si no => ponemos el número
      el.value = v === 0 ? "" : String(v);
      // Clase "given" para estilo visual de celdas fijas
      el.classList.toggle("given", !!givenMask[r][c]);
      // readOnly para impedir editar celdas fijas
      el.readOnly = !!givenMask[r][c];
    }
  }
  // Guardamos estado y actualizamos stats
  persist();
  updateStats();
}
  // Vacía todo (tablero vacío + máscara vacía)
function clearAll() {
  renderBoard(makeEmptyBoard(), makeEmptyMask());
  setMessage("Tablero vacío. Puedes rellenar a mano.", "info");
}
  // Carga ejemplo: crea máscara de givens y renderiza
function loadExample() {
  // mask = true si EXAMPLE tiene número distinto de 0
  let mask = EXAMPLE.map((row) => row.map((v) => v !== 0));
  // Renderizamos una copia del ejemplo (para no modificar EXAMPLE por accidente)
  renderBoard(deepCopyBoard(EXAMPLE), mask);
  setMessage("Ejemplo cargado. Pulsa Validar o Resolver.", "info");
}
// Lee el tablero desde la UI (los inputs) y lo convierte a números
function getBoardFromUI() {
  let board = makeEmptyBoard();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      let el = qCell(r, c);
      let v = el.value.trim();
      // Si vacío => 0, si no => Number(dígito)
      board[r][c] = v === "" ? 0 : Number(v);
    }
  }
  return board;
}
// Marca como inválidas ciertas celdas (array de {r,c})
function markInvalidCells(positions) {
  // Primero limpia todas
  sudokuEl.querySelectorAll(".sudokuCell").forEach((el) => el.classList.remove("invalid"));
  // Luego marca solo las que vienen en "positions"
  for (let { r, c } of positions) {
    let el = qCell(r, c);
    if (el) el.classList.add("invalid");
  }
}
// Actualiza stats: cuántas celdas están rellenas
function updateStats() {
  let b = getBoardFromUI();
  let filled = 0;
  // Cuenta cuántas no son 0
  for (let r = 0; r < 9; r++) 
    for (let c = 0; c < 9; c++) 
      if (b[r][c] !== 0) filled++;
      // Muestra "Rellenas: X/81"
  statsEl.textContent = `Rellenas: ${filled}/81`;
}
// Valida el tablero: detecta repetidos en filas, columnas y subcuadrantes 3x3
function validateBoard(board) {
  // Aquí guardaremos posiciones que entran en conflicto
  let conflicts = [];
  // checkUnit recibe una lista de celdas (posiciones) que forman una "unidad"
  function checkUnit(cells) {
    // seen: mapa número -> primera posición donde apareció
    let seen = new Map(); // num -> {r,c}
    for (let { r, c } of cells) {
      let v = board[r][c];
      // 0 = vacío, no cuenta para conflictos
      if (v === 0) continue;
      // Si ya vimos ese número en la misma unidad => conflicto
      if (seen.has(v)) {
        // Guardamos la celda actual
        conflicts.push({ r, c });
        // Y la celda donde apareció por primera vez
        conflicts.push(seen.get(v));
      } else {
        // Si no estaba, lo registramos
        seen.set(v, { r, c });
      }
    }
  }
  // Para cada fila r, creamos un array de 9 posiciones {r,c} con c=0..8
  for (let r = 0; r < 9; r++)
    checkUnit(Array.from({ length: 9 }, (_, c) => ({ r, c })));
  // Para cada columna c, creamos un array de 9 posiciones {r,c} con r=0..8
  for (let c = 0; c < 9; c++) 
    checkUnit(Array.from({ length: 9 }, (_, r) => ({ r, c })));
  //Subcuadrantes 3x3, br/bc recorren los "bloques" empezando en 0,3,6
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      let cells = [];
      // Metemos las 9 posiciones dentro del bloque 3x3
      for (let r = br; r < br + 3; r++) 
        for (let c = bc; c < bc + 3; c++) 
      cells.push({ r, c });
    // Validamos esa unidad (bloque)
      checkUnit(cells);
    }
  }
  // Como conflicts puede tener duplicados, los eliminamos con una clave "r-c"
  let key = (p) => `${p.r}-${p.c}`;
  // Map: clave -> posición (si se repite, pisa; al final quedan únicas)
  let uniq = Array.from(new Map(conflicts.map((p) => [key(p), p])).values());
  // ok = no hay conflictos
  return { ok: uniq.length === 0, conflicts: uniq };
}
//Solver (Backtracking)
// Busca la primera celda vacía (valor 0). Si no hay, devuelve null.
function findEmpty(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) return { r, c };
    }
  }
  return null;
}
// Comprueba si poner n en (r,c) respeta reglas sudoku
function isValidPlacement(board, r, c, n) {
  // Revisión fila: si n ya está en la fila r, no vale
  for (let x = 0; x < 9; x++) if (board[r][x] === n) return false;
  // Revisión columna: si n ya está en la columna c, no vale
  for (let x = 0; x < 9; x++) if (board[x][c] === n) return false;
  // Revisión bloque 3x3: calculamos esquina superior izquierda del bloque
  let br = Math.floor(r / 3) * 3;
  let bc = Math.floor(c / 3) * 3;
  // Recorremos las 9 celdas del bloque
  for (let rr = br; rr < br + 3; rr++) {
    for (let cc = bc; cc < bc + 3; cc++) {
      if (board[rr][cc] === n) return false;
    }
  }
  // Si pasa todo, es válido           
  return true;
}
// Resolver Sudoku con backtracking (recursivo)
function solveSudoku(board) {
  // Encuentra una celda vacía
  let empty = findEmpty(board);
  // Si no hay vacías, ya está resuelto
  if (!empty) return true;
  let { r, c } = empty;
  // Probamos números del 1 al 9
  for (let n = 1; n <= 9; n++) {
    // Si no se puede poner, seguimos con el siguiente
    if (!isValidPlacement(board, r, c, n)) continue;
    // Colocamos el número
    board[r][c] = n;
    // Intentamos resolver el resto
    if (solveSudoku(board)) return true;
    // Si no funcionó, deshacemos (backtrack)
    board[r][c] = 0;
  }
  // Si ningún número funcionó, no hay solución con esta configuración
  return false;
}
// Guarda en localStorage el tablero, máscara y modo actual
function persist() {
  let state = {
    board: getBoardFromUI(),  // tablero leído de inputs
    givenMask,                // máscara actual
    mode: modeEl.value,       // modo seleccionado en el select
  };
  localStorage.setItem(LS_KEY, JSON.stringify(state));  // Guardamos en JSON
}
// Intenta restaurar estado desde localStorage
function restore() {
  let raw = localStorage.getItem(LS_KEY);
  // Si no hay nada guardado, no restauramos
  if (!raw) return false;

  try {
    // Parseamos JSON a objeto
    let state = JSON.parse(raw);
    // Validación mínima: state.board debe existir y ser un array de 9 filas
    if (!state || !Array.isArray(state.board) || state.board.length !== 9) return false;
    // Restauramos el modo en el select
    modeEl.value = state.mode || "empty";
    // Renderizamos tablero y máscara (si no hay máscara, usamos vacía)
    renderBoard(state.board, state.givenMask || makeEmptyMask());
    // Mensaje
    setMessage("Estado restaurado desde la última sesión.", "info");
    return true;
  } catch {
    // Si JSON.parse falla, no restauramos
    return false;
  }
}
// Botón "Cargar": según modo, carga ejemplo o deja vacío
btnLoad.addEventListener("click", () => {
  let mode = modeEl.value;
  // Si el modo es "example", cargamos ejemplo
  if (mode === "example") loadExample();
  // Si es "empty", limpiamos todo
  else clearAll();
});
// Botón "Limpiar": vacía el tablero
btnClear.addEventListener("click", () => {
  clearAll();
});
// Botón "Validar": detecta conflictos y marca celdas inválidas
btnValidate.addEventListener("click", () => {
  let board = getBoardFromUI();       // tablero actual
  let v = validateBoard(board);       // validación (ok/conflicts)
  if (v.ok) {
    // Si es válido, quitamos marcas inválidas y avisamos
    markInvalidCells([]);
    setMessage("Tablero válido (sin conflictos).", "ok");
  } else {
    // Si es inválido, marcamos las celdas en conflicto
    markInvalidCells(v.conflicts);
    setMessage("Tablero inválido: hay números repetidos en alguna fila/columna/subcuadrante.", "error");
  }
});
// Botón "Resolver": valida y luego intenta resolver con backtracking
btnSolve.addEventListener("click", () => {
  // Si ya estamos resolviendo, evitamos doble click
  if (solving) return;
  // Activamos lock
  solving = true;
  // Leemos tablero actual
  let board = getBoardFromUI();
  // Antes de resolver, validamos que no haya conflictos
  let v = validateBoard(board);
  // Si hay conflictos, no resolvemos
  if (!v.ok) {
    markInvalidCells(v.conflicts);
    setMessage("No se puede resolver: primero corrige los conflictos del tablero.", "error");
    solving = false;      // liberamos lock
    return;
  }
  // work: copia del tablero para resolver sin tocar directamente lo leído
  let work = deepCopyBoard(board);
  // Medimos tiempo (en ms) con performance.now()
  let t0 = performance.now();
  let ok = solveSudoku(work);
  let t1 = performance.now();
  // Si no se puede resolver, avisamos
  if (!ok) {
    setMessage("Este Sudoku no tiene solución (o el tablero es inconsistente).", "error");
    solving = false;
    return;
  }
  //Si se resolvió, renderizamos el tablero solucionado manteniendo las celdas "given" como readOnly
  renderBoard(work, givenMask);
  // Quitamos marcas inválidas por si hubiera
  markInvalidCells([]);
  // Mensaje con el tiempo de resolución
  setMessage(`Resuelto en ${(t1 - t0).toFixed(1)} ms.`, "ok");
  // Liberamos lock
  solving = false;
});
// Construimos el grid (crea los 81 inputs + listeners)
buildGrid();
//Intentamos restaurar del localStorage. Si NO se puede restaurar, dejamos tablero vacío y mensaje por defecto.
if (!restore()) {
  setMessage("Listo. Elige modo y pulsa Cargar.", "info");
  clearAll();
}