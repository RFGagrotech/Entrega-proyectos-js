//Creo abreviatura (Helper)
let $ = (sel) => document.querySelector(sel);
//Enlazo a los ids Captura de elementos DOM)
let difficultyEl = $("#difficulty"); //Elección dificultad
//Inputs numéricos (easy/medium/hard/personalizado)
let rowsEl = $("#rows");
let colsEl = $("#cols");
let minesEl = $("#mines");
//Botón de crear partida/Reiniciar
let btnNew = $("#btnNew");
//Crear contenedores + mensaje
let boardEl = $("#board");
let msgEl = $("#message");
//Pills de estadísticas
let minesTotalEl = $("#minesTotal"); //minas totales
let flagsCountEl = $("#flagsCount"); //Banderas puestas
let timeEl = $("#time");             //Tiempo actual (segundos)
let bestTimeEl = $("#bestTime");     //Mejor tiempo guardado en localStorage
//Estado global de la partida
let game = null;
//Estado del temporizador (ID del setIterval para poder pararlo con clearInterval)
let timerId = null;

//Se crea el objeto partida (función para crear la partida)
function createGame(rows, cols, mines) {
  let maxMines = rows * cols - 1;   //Máximo de minas permitido: todas menos 1 (para que quede al menos 1 celda libre)
  let safeMines = Math.max(1, Math.min(mines, maxMines)); //minas ajustadas a un rango seguro (1, maxMines)
  //Crear matriz 2D (rows x cols)
  //Cada celda es un objeto con propiedades (mine, revealed, adjacent y flagged)
  let grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      r, c,                          //Establece las coordenadas(r=filas y c=columnas)
      mine: false,                   //Si tiene mina 
      adjacent: 0,                   //número de minas alrededor
      revealed: false,               //si está revelada o no
      flagged: false,                //si tiene bandera o no
    }))
  );

  //Se crea una lista con todos los indices posibles
  let positions = [];
  for (let i = 0; i < rows * cols; i++) positions.push(i); 
  shuffleInPlace(positions); //Se barajan las listas para que el orden sea aleatorio
  //Se colocan las minas en las safeMines aleatorias
  for (let i = 0; i < safeMines; i++) { 
    let idx = positions[i];          //índice lineal
    let r = Math.floor(idx / cols);  //fila=idx/cols
    let c = idx % cols;              //col= resto
    grid[r][c].mine = true;          //se marca esa celda con mina
  }
  //Calculo de nº de minas adjacentes para cada celda sin mina
  for (let r = 0; r < rows; r++) { 
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].mine) continue; //si es una mina no se calcula adjacent
      grid[r][c].adjacent = countAdjacentMines(grid, rows, cols, r, c);
    }
  }
  //Se devuelve el estado completo del juego 
  return {
    rows,                   //nº de filas
    cols,                   //nº de columnas
    mines: safeMines,       //nº de minas ya ajustado (real)
    grid,                   //la matriz de las celdas
    flagsCount: 0,          //banderas colocadas
    revealedSafeCount: 0,   //cantidad de celdas sin minas reveladas
    startedAt: null,        //timestamp en ms cuando empieza
    ended: false,           //si el juego termino
    won: false,             //si se ganó
  };
}
//baraja de array
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
  // Si ya hay startedAt (no es null), ya arrancó
  if (game.startedAt !== null) return;
  // Guardamos cuándo empezó
  game.startedAt = Date.now();
  // Por si acaso había un timer anterior, lo paramos
  stopTimer();
  // Cada 250ms actualizamos el texto del tiempo
  timerId = setInterval(() => {
    timeEl.textContent = String(getElapsedSeconds());
  }, 250);
}
//parar el temporizador si existe
function stopTimer() {
  if (timerId) clearInterval(timerId);    // mata el setInterval
  timerId = null;                         // lo dejamos limpio
}
// Devuelve los segundos transcurridos desde startedAt
function getElapsedSeconds() {
  // Si aún no empezó (startedAt null/0/undefined), tiempo = 0
  if (!game.startedAt) return 0;
  // end = endedAt si terminó, o Date.now() si sigue vivo
  let end = game.ended ? game.endedAt : Date.now();
  // Pasamos de ms a segundos (floor para entero), y nunca negativo
  return Math.max(0, Math.floor((end - game.startedAt) / 1000));
}
//Mensajes ganar/perder
function setMessage(text, type = "info") {
  if (type === "win") msgEl.innerHTML = `✅ <b>Victoria</b> — ${text}`;
  else if (type === "lose") msgEl.innerHTML = `💥 <b>Game Over</b> — ${text}`;
  else msgEl.innerHTML = text;
}
// Genera la clave única para el "mejor tiempo" en localStorage
function bestKey(rows, cols, mines) {
  return `cb_minesweeper_best_${rows}x${cols}_${mines}`;
}
// Carga el mejor tiempo desde localStorage (si existe)
function loadBest(rows, cols, mines) {
  let raw = localStorage.getItem(bestKey(rows, cols, mines)); // string o null
  let n = raw ? Number(raw) : NaN;                            // intenta convertirlo a número
  return Number.isFinite(n) ? n : null;                       // si es válido, lo devuelve; si no, null
}
// Guarda el mejor tiempo en localStorage
function saveBest(rows, cols, mines, seconds) {
  localStorage.setItem(bestKey(rows, cols, mines), String(seconds));
}
//Para actualiza minas, banderas, tiempo actual y mejor tiempo
function updateTopUI() {
  minesTotalEl.textContent = String(game.mines);
  flagsCountEl.textContent = String(game.flagsCount);
  timeEl.textContent = String(getElapsedSeconds());

  let best = loadBest(game.rows, game.cols, game.mines);
  bestTimeEl.textContent = best === null ? "—" : `${best}s`;
}
// Renderiza (pinta) el tablero creando botones en el DOM
function renderBoard() {
  // Vacía el tablero anterior
  boardEl.innerHTML = "";
  // Ajusta el CSS grid con tantas columnas como game.cols
  boardEl.style.gridTemplateColumns = `repeat(${game.cols}, 34px)`;
  //Recorremos todas las celdas
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      let cell = game.grid[r][c];
      // Creamos un botón por celda
      let btn = document.createElement("button");
      btn.className = "cell";
      btn.type = "button";
      // Guardamos coordenadas en data-attributes para poder encontrarlas después
      btn.dataset.r = String(r);
      btn.dataset.c = String(c);
       // Accesibilidad: etiqueta para lector de pantalla
      btn.setAttribute("aria-label", `Celda ${r + 1},${c + 1}`);
       // Pintamos su estado visual (texto, clases, etc.)
      paintCell(btn, cell);
      //Eventos
      // Click izquierdo (revelar)
      btn.addEventListener("click", (e) => {
        e.preventDefault();   // evita comportamientos raros por defecto
        onLeftClick(r, c);    // manejador real
      });

      // Click derecho (bandera)
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();   // evita que salga el menú del navegador
        onRightClick(r, c);
      });
      // Metemos el botón en el tablero
      boardEl.appendChild(btn);
    }
  }
}
// Pinta una celda en un botón según su estado
function paintCell(btn, cell) {
  // Añade/quita clases según booleanos
  btn.classList.toggle("revealed", cell.revealed);
  btn.classList.toggle("flagged", cell.flagged);
  btn.classList.toggle("mine", cell.mine);
  // Si NO está revelada:
  if (!cell.revealed) {
    // Si está marcada con bandera, mostramos 🚩, si no, vacío
    btn.textContent = cell.flagged ? "🚩" : "";
    return;
  }
  // Si está revelada y ES mina:
  if (cell.mine) {
    btn.textContent = "💣";
    return;
  }
  // Si está revelada y NO es mina:
  // Si alrededor no hay minas, no mostramos nada
  if (cell.adjacent === 0) {
    btn.textContent = "";
    return;
  }
  // Si hay minas alrededor, mostramos el número
  btn.textContent = String(cell.adjacent);
}
  // Devuelve el botón DOM correspondiente a la celda (r,c)
function getCellButton(r, c) {
  return boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}
// Revela todas las minas (cuando pierdes)
function revealAllMines() {
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      let cell = game.grid[r][c];
      // Solo minas
      if (cell.mine) {
        cell.revealed = true;           //marcamos la revelada
        let btn = getCellButton(r, c);  //buscamos su botón
        if (btn) paintCell(btn, cell);  //repetimos si existe
      }
    }
  }
}
// Click izquierdo: revelar una celda
function onLeftClick(r, c) {
  // Si no hay juego o ya terminó, no hacemos nada
  if (!game || game.ended) return;

  let cell = game.grid[r][c];
  // Si ya estaba revelada o marcada con bandera, no hacemos nada
  if (cell.revealed || cell.flagged) return;
  // Arrancamos el tiempo si aún no había empezado
  startTimerIfNeeded();
  // Si pisas una mina:
  if (cell.mine) {
    // Revelamos la mina pulsada
    cell.revealed = true;
    paintCell(getCellButton(r, c), cell);
    // Game Over
    game.ended = true;
    game.won = false;
    game.endedAt = Date.now();
    // Revelamos todas las minas
    revealAllMines();
    // Paramos timer
    stopTimer();
    // Mensaje de derrota + UI
    setMessage(`Has explotado en ${getElapsedSeconds()}s. Pulsa "Crear / Reiniciar" para volver a jugar.`, "lose");
    updateTopUI();
    return;
  }
  // Si NO es mina: revelamos y hacemos cascada si adjacent=0
  revealSafeCell(r, c);

  // ¿Victoria?
  let totalSafe = game.rows * game.cols - game.mines;
  // Si revelamos todas las seguras, ganamos
  if (game.revealedSafeCount >= totalSafe) {
    game.ended = true;
    game.won = true;
    game.endedAt = Date.now();
    stopTimer();
    // segundos finales
    let secs = getElapsedSeconds();
    // miramos mejor tiempo actual
    let currentBest = loadBest(game.rows, game.cols, game.mines);
    // si no hay best o lo hemos mejorado, lo guardamos
    if (currentBest === null || secs < currentBest) {
      saveBest(game.rows, game.cols, game.mines, secs);
    }
    // Mensaje + UI
    setMessage(`Has completado el tablero en ${secs}s.`, "win");
    updateTopUI();
  }
}
// Revela una celda segura y si es 0, abre "cascada" BFS
function revealSafeCell(r, c) {
  // Cola inicial con la celda que queremos revelar
  let queue = [[r, c]];
  // Mientras haya cosas en la cola...
  while (queue.length) {
    // Sacamos el primero (BFS)
    let [cr, cc] = queue.shift();
    let current = game.grid[cr][cc];
    // Si ya estaba revelada o marcada, ignoramos
    if (current.revealed || current.flagged) continue;
    // Si por alguna razón fuera mina, ignoramos (seguridad extra)
    if (current.mine) continue; 
    // Marcamos como revelada
    current.revealed = true;
    // Aumentamos contador de seguras reveladas
    game.revealedSafeCount++;
    // Pintamos su botón
    let btn = getCellButton(cr, cc);
    if (btn) paintCell(btn, current);
    // Si no hay minas alrededor (0), abrimos vecinos en cascada
    if (current.adjacent === 0) {
      for (let [nr, nc] of neighbors(cr, cc)) {
        // Si vecino está fuera, saltamos
        if (!inBounds(game.rows, game.cols, nr, nc)) continue;
        let ncell = game.grid[nr][nc];
        // Si vecino no está revelado, no tiene bandera y no es mina -> lo metemos a la cola
        if (!ncell.revealed && !ncell.flagged && !ncell.mine) {
          queue.push([nr, nc]);
        }
      }
    }
  }
}
// Click derecho: poner/quitar bandera.  
function onRightClick(r, c) {
  if (!game || game.ended) return;
  let cell = game.grid[r][c];
  // No puedes poner bandera en una celda ya revelada
  if (cell.revealed) return;
  // No arrancamos el timer con click derecho
  cell.flagged = !cell.flagged;
  // Ajustamos contador según el nuevo estado
  game.flagsCount += cell.flagged ? 1 : -1;
  // Repintamos esa celda y actualizamos los contadores
  paintCell(getCellButton(r, c), cell);
  updateTopUI();
}
  // Aplica un preset de dificultad al cambiar el select
function applyDifficultyPreset(value) {
  let presets = {
    easy:   { rows: 8,  cols: 8,  mines: 10 },
    medium: { rows: 12, cols: 12, mines: 30 },
    hard:   { rows: 16, cols: 16, mines: 50 },
  };
  // Si el valor no existe, no hacemos nada
  if (!presets[value]) return;
  // Seteamos los inputs con ese preset
  rowsEl.value = String(presets[value].rows);
  colsEl.value = String(presets[value].cols);
  minesEl.value = String(presets[value].mines);
}
  // Asegura que rows/cols/mines están dentro de rangos válidos y devuelve esos valores numéricos
function clampInputs() {
  // Filas: mínimo 4, máximo 40
  let rows = Math.max(4, Math.min(40, Number(rowsEl.value || 8)));
  // Columnas: mínimo 4, máximo 60
  let cols = Math.max(4, Math.min(60, Number(colsEl.value || 8)));
  // Máximo de minas permitido según tamaño actual
  let maxMines = rows * cols - 1;
  // Minas: cogemos input o 10 si está vacío, y lo ajustamos entre 1 y maxMines
  let mines = Number(minesEl.value || 10);
  mines = Math.max(1, Math.min(maxMines, mines));
  // Volvemos a escribir los inputs ya corregidos (para que el usuario lo vea)
  rowsEl.value = String(rows);
  colsEl.value = String(cols);
  minesEl.value = String(mines);
  // Devolvemos los números listos para usar
  return { rows, cols, mines };
}
  // Crea una partida nueva (o reinicia)
function newGame() {
  // Por si había un timer corriendo, lo paramos
  stopTimer();
  // Leemos y saneamos inputs
  let { rows, cols, mines } = clampInputs();
  // Creamos estado de juego nuevo
  game = createGame(rows, cols, mines);
  // Mensaje informativo
  setMessage(`Tablero creado: <b>${rows}×${cols}</b> con <b>${game.mines}</b> minas.`, "info");
  // Pintamos tablero y UI
  renderBoard();
  updateTopUI();
}
// Eventos del UI (select dificultad, inputs, botón)
// Cuando cambias el select:
difficultyEl.addEventListener("change", (e) => {
  let val = e.target.value;
  // Si el usuario elige un preset (no custom),
  // aplicamos preset y arrancamos juego nuevo
  if (val !== "custom") {
    applyDifficultyPreset(val);
    newGame();
  }
});
// Si el usuario escribe en rows/cols/mines,
// cambiamos automáticamente el select a "custom"
[rowsEl, colsEl, minesEl].forEach((el) => {
  el.addEventListener("input", () => {
    difficultyEl.value = "custom";
  });
});
// Click en "Crear / Reiniciar"
btnNew.addEventListener("click", () => {
  newGame();
});

// Arranque inicial
newGame();