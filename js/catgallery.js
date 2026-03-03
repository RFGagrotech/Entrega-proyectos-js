// catgallery.js (TheCatAPI) - aislado
let $ = (sel) => document.querySelector(sel);
let tabGallery = $("#catTabGallery");
let tabFavs = $("#catTabFavs");
let viewGallery = $("#catViewGallery");
let viewFavs = $("#catViewFavs");
let gridEl = $("#catGrid");
let favGridEl = $("#catFavGrid");
let statusEl = $("#catStatus");
let favCountEl = $("#catFavCount");
let limitEl = $("#catLimit");
let typeEl = $("#catType");
let btnReload = $("#catBtnReload");
let btnMore = $("#catBtnMore");
let btnClearFavs = $("#catBtnClearFavs");
let btnBackToGallery = $("#catBtnBackToGallery");

// --- Config API ---
// Nota: TheCatAPI funciona sin key, pero con rate-limit más estricto.
// Si tienes API KEY, ponla aquí:
let API_KEY = ""; // "TU_API_KEY";
let API_BASE = "https://api.thecatapi.com/v1/images/search";

let LS_FAVS = "cb_cat_favs_v1";

let page = 0;
let loading = false;

function setStatus(text, kind = "info") {
  // kind: info | ok | error | loading
  if (kind === "error") statusEl.textContent = `⚠️ ${text}`;
  else if (kind === "ok") statusEl.textContent = `✅ ${text}`;
  else if (kind === "loading") statusEl.textContent = `⏳ ${text}`;
  else statusEl.textContent = text;
}

function readFavs() {
  try {
    let raw = localStorage.getItem(LS_FAVS);
    let arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeFavs(favs) {
  localStorage.setItem(LS_FAVS, JSON.stringify(favs));
  updateFavBadge();
}

function updateFavBadge() {
  let favs = readFavs();
  favCountEl.textContent = String(favs.length);
}

function isFav(id) {
  return readFavs().some((f) => f.id === id);
}

function toggleFav(cat) {
  let favs = readFavs();
  let idx = favs.findIndex((f) => f.id === cat.id);

  if (idx >= 0) {
    favs.splice(idx, 1);
    writeFavs(favs);
    setStatus("Eliminado de favoritos.", "ok");
  } else {
    favs.push({ id: cat.id, url: cat.url });
    writeFavs(favs);
    setStatus("Añadido a favoritos.", "ok");
  }

  // refrescar vista actual
  paintFavs();
  paintFavButtonsState();
}

function paintFavButtonsState() {
  // Actualiza el estado visual de los botones ❤️ en la galería
  gridEl.querySelectorAll("[data-fav-btn]").forEach((btn) => {
    let id = btn.getAttribute("data-id");
    let fav = isFav(id);
    btn.classList.toggle("is-fav", fav);
    btn.textContent = fav ? "❤️" : "🤍";
    btn.setAttribute("aria-pressed", fav ? "true" : "false");
  });
}

function createCard(cat) {
  let card = document.createElement("article");
  card.className = "catCard";

  let imgWrap = document.createElement("div");
  imgWrap.className = "catImgWrap";

  let img = document.createElement("img");
  img.className = "catImg";
  img.src = cat.url;
  img.alt = "Gato (TheCatAPI)";
  img.loading = "lazy";

  imgWrap.appendChild(img);

  let actions = document.createElement("div");
  actions.className = "catActions";

  let meta = document.createElement("div");
  meta.className = "catMeta";
  meta.textContent = `id: ${cat.id}`;

  let favBtn = document.createElement("button");
  favBtn.className = "catFavBtn";
  favBtn.type = "button";
  favBtn.setAttribute("data-fav-btn", "1");
  favBtn.setAttribute("data-id", cat.id);

  let fav = isFav(cat.id);
  favBtn.classList.toggle("is-fav", fav);
  favBtn.textContent = fav ? "❤️" : "🤍";
  favBtn.setAttribute("aria-label", "Marcar como favorito");
  favBtn.setAttribute("aria-pressed", fav ? "true" : "false");

  favBtn.addEventListener("click", () => toggleFav(cat));

  actions.appendChild(meta);
  actions.appendChild(favBtn);

  card.appendChild(imgWrap);
  card.appendChild(actions);

  return card;
}

async function fetchCats({ append = true } = {}) {
  if (loading) return;
  loading = true;

  let limit = Number(limitEl.value || 9);
  let mime = typeEl.value.trim(); // "", "jpg,png", "gif"

  let params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("page", String(page));
  params.set("order", "DESC");
  // El API admite mime_types: jpg,png,gif
  if (mime) params.set("mime_types", mime);

  let url = `${API_BASE}?${params.toString()}`;

  setStatus("Cargando imágenes…", "loading");
  btnMore.disabled = true;
  btnReload.disabled = true;

  try {
    let res = await fetch(url, {
      headers: API_KEY ? { "x-api-key": API_KEY } : undefined,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    let data = await res.json();
    if (!Array.isArray(data)) throw new Error("Respuesta inesperada");

    if (!append) gridEl.innerHTML = "";

    data.forEach((cat) => gridEl.appendChild(createCard(cat)));

    setStatus(`Cargadas ${data.length} imágenes.`, "ok");
    paintFavButtonsState();
  } catch (err) {
    setStatus(`Error al cargar imágenes (${err.message}).`, "error");
  } finally {
    loading = false;
    btnMore.disabled = false;
    btnReload.disabled = false;
  }
}

function paintFavs() {
  let favs = readFavs();
  favGridEl.innerHTML = "";

  if (favs.length === 0) {
    let empty = document.createElement("div");
    empty.className = "catStatus";
    empty.textContent = "No hay favoritos aún. Vuelve a Galería y marca algunos ❤️.";
    favGridEl.appendChild(empty);
    return;
  }

  favs.forEach((cat) => {
    // En favoritos, el botón sirve para quitar
    let card = document.createElement("article");
    card.className = "catCard";

    let imgWrap = document.createElement("div");
    imgWrap.className = "catImgWrap";

    let img = document.createElement("img");
    img.className = "catImg";
    img.src = cat.url;
    img.alt = "Gato favorito";
    img.loading = "lazy";

    imgWrap.appendChild(img);

    let actions = document.createElement("div");
    actions.className = "catActions";

    let meta = document.createElement("div");
    meta.className = "catMeta";
    meta.textContent = `id: ${cat.id}`;

    let delBtn = document.createElement("button");
    delBtn.className = "catFavBtn is-fav";
    delBtn.type = "button";
    delBtn.textContent = "🗑️";
    delBtn.title = "Eliminar de favoritos";
    delBtn.addEventListener("click", () => toggleFav(cat));

    actions.appendChild(meta);
    actions.appendChild(delBtn);

    card.appendChild(imgWrap);
    card.appendChild(actions);

    favGridEl.appendChild(card);
  });
}

function setView(which) {
  let isGallery = which === "gallery";
  viewGallery.classList.toggle("is-hidden", !isGallery);
  viewFavs.classList.toggle("is-hidden", isGallery);

  tabGallery.classList.toggle("is-active", isGallery);
  tabFavs.classList.toggle("is-active", !isGallery);

  if (!isGallery) paintFavs();
}

function resetAndLoad() {
  page = 0;
  gridEl.innerHTML = "";
  fetchCats({ append: true });
}

tabGallery.addEventListener("click", () => setView("gallery"));
tabFavs.addEventListener("click", () => setView("favs"));
btnBackToGallery.addEventListener("click", () => setView("gallery"));

btnReload.addEventListener("click", () => resetAndLoad());

btnMore.addEventListener("click", () => {
  page += 1;
  fetchCats({ append: true });
});

btnClearFavs.addEventListener("click", () => {
  writeFavs([]);
  paintFavs();
  paintFavButtonsState();
  setStatus("Favoritos vaciados.", "ok");
});

limitEl.addEventListener("change", () => resetAndLoad());
typeEl.addEventListener("change", () => resetAndLoad());

// Arranque
updateFavBadge();
setView("gallery");
resetAndLoad();