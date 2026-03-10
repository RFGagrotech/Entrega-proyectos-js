// Atajo para seleccionar un único elemento del DOM a partir de un selector CSS.
let $ = (sel) => document.querySelector(sel);
// Botón o pestaña que muestra la galería general.
let tabGallery = $("#catTabGallery");
// Botón o pestaña que muestra la vista de favoritos.
let tabFavs = $("#catTabFavs");
// Contenedor principal de la vista de galería.
let viewGallery = $("#catViewGallery");
// Contenedor principal de la vista de favoritos.
let viewFavs = $("#catViewFavs");
// Grid donde se insertan dinámicamente las imágenes descargadas de la API.
let gridEl = $("#catGrid");
// Grid donde se insertan dinámicamente las imágenes favoritas guardadas.
let favGridEl = $("#catFavGrid");
// Elemento donde se muestran mensajes de estado al usuario.
let statusEl = $("#catStatus");
// Elemento visual donde se muestra el número total de favoritos.
let favCountEl = $("#catFavCount");
// Select o input que define cuántas imágenes pedir a la API.
let limitEl = $("#catLimit");
// Select o input que define el tipo de imagen a pedir (jpg, png, gif...).
let typeEl = $("#catType");
// Botón para recargar la galería desde cero.
let btnReload = $("#catBtnReload");
// Botón para cargar más imágenes.
let btnMore = $("#catBtnMore");
// Botón para vaciar todos los favoritos almacenados.
let btnClearFavs = $("#catBtnClearFavs");
// Botón para volver de la vista de favoritos a la galería.
let btnBackToGallery = $("#catBtnBackToGallery");
// API key opcional de TheCatAPI.
// Si no se usa cuenta o clave, puede dejarse vacío.
let API_KEY = "";
// Endpoint base de TheCatAPI para buscar imágenes.
let API_BASE = "https://api.thecatapi.com/v1/images/search";
// Clave usada en localStorage para guardar los favoritos del proyecto.
let LS_FAVS = "cb_cat_favs_v1";
// Variable que controla la página actual de resultados.
let page = 0;
// Bandera para evitar hacer varias peticiones simultáneas.
let loading = false;
// Función para escribir mensajes de estado en pantalla.
function setStatus(text, kind = "info") {
  // Si el tipo es error, añade icono de aviso.
  if (kind === "error") statusEl.textContent = `⚠️ ${text}`;
  // Si el tipo es ok, añade icono de confirmación.
  else if (kind === "ok") statusEl.textContent = `✅ ${text}`;
  // Si el tipo es loading, añade icono de carga.
  else if (kind === "loading") statusEl.textContent = `⏳ ${text}`;
  // Si no se indica ningún tipo especial, muestra solo el texto.
  else statusEl.textContent = text;
}
// Lee el array de favoritos guardado en localStorage.
function readFavs() {
  try {
    // Recupera el texto bruto guardado bajo la clave LS_FAVS.
    let raw = localStorage.getItem(LS_FAVS);
    // Si hay contenido, lo parsea como JSON; si no, usa array vacío.
    let arr = raw ? JSON.parse(raw) : [];
    // Asegura que el valor final sea realmente un array.
    return Array.isArray(arr) ? arr : [];
  } catch {
    // Si ocurre un error al leer o parsear, devuelve array vacío.
    return [];
  }
}
// Guarda el array de favoritos en localStorage.
function writeFavs(favs) {
  // Convierte el array a JSON y lo guarda.
  localStorage.setItem(LS_FAVS, JSON.stringify(favs));
  // Actualiza el contador visual de favoritos.
  updateFavBadge();
}
// Actualiza el número de favoritos mostrado en la interfaz.
function updateFavBadge() {
  // Lee los favoritos actuales.
  let favs = readFavs();
  // Muestra la cantidad en texto.
  favCountEl.textContent = String(favs.length);
}
// Comprueba si un gato concreto está guardado en favoritos.
function isFav(id) {
  // Recorre favoritos y devuelve true si encuentra uno con el mismo id.
  return readFavs().some((f) => f.id === id);
}
// Añade o elimina un gato de favoritos.
function toggleFav(cat) {
  // Lee el listado actual de favoritos.
  let favs = readFavs();
  // Busca la posición del gato dentro del array.
  let idx = favs.findIndex((f) => f.id === cat.id);
  // Si el gato ya existe en favoritos...
  if (idx >= 0) {
    // ...lo elimina del array.
    favs.splice(idx, 1);
    // Guarda el array actualizado.
    writeFavs(favs);
    // Muestra mensaje de confirmación.
    setStatus("Eliminado de favoritos.", "ok");
  } else {
    // Si no existe, añade un objeto con su id y url.
    favs.push({ id: cat.id, url: cat.url });
    // Guarda el array actualizado.
    writeFavs(favs);
    // Muestra mensaje de confirmación.
    setStatus("Añadido a favoritos.", "ok");
  }
  // Repinta la vista de favoritos por si está visible.
  paintFavs();
  // Actualiza el estado visual de los botones de favorito en la galería.
  paintFavButtonsState();
}
// Revisa todos los botones de favorito en el grid principal y actualiza su aspecto.
function paintFavButtonsState() {
  // Selecciona todos los botones que tengan el atributo data-fav-btn.
  gridEl.querySelectorAll("[data-fav-btn]").forEach((btn) => {
    // Obtiene el id del gato asociado a ese botón.
    let id = btn.getAttribute("data-id");
    // Comprueba si ese id está en favoritos.
    let fav = isFav(id);
    // Añade o quita la clase visual is-fav.
    btn.classList.toggle("is-fav", fav);
    // Cambia el icono según esté o no en favoritos.
    btn.textContent = fav ? "❤️" : "🤍";
    // Actualiza accesibilidad indicando estado pulsado/no pulsado.
    btn.setAttribute("aria-pressed", fav ? "true" : "false");
  });
}
// Crea una tarjeta HTML completa para un gato recibido desde la API.
function createCard(cat) {
  // Crea el contenedor principal de la tarjeta.
  let card = document.createElement("article");
  // Asigna su clase CSS.
  card.className = "catCard";
  // Crea un contenedor para envolver la imagen.
  let imgWrap = document.createElement("div");
  // Asigna la clase CSS del wrapper de imagen.
  imgWrap.className = "catImgWrap";
  // Crea el elemento img.
  let img = document.createElement("img");
  // Asigna clase CSS a la imagen.
  img.className = "catImg";
  // Asigna la URL de la imagen del gato.
  img.src = cat.url;
  // Texto alternativo para accesibilidad.
  img.alt = "Gato (TheCatAPI)";
  // Lazy loading para mejorar rendimiento.
  img.loading = "lazy";
  // Inserta la imagen dentro de su contenedor.
  imgWrap.appendChild(img);
  // Crea el contenedor de acciones de la tarjeta.
  let actions = document.createElement("div");
  // Asigna clase CSS de acciones.
  actions.className = "catActions";
  // Crea un bloque de metadatos.
  let meta = document.createElement("div");
  // Clase CSS para los metadatos.
  meta.className = "catMeta";
  // Muestra el id de la imagen.
  meta.textContent = `id: ${cat.id}`;
  // Crea el botón de favorito.
  let favBtn = document.createElement("button");
  // Asigna su clase base.
  favBtn.className = "catFavBtn";
  // Define que es un botón normal, no submit.
  favBtn.type = "button";
  // Marca el botón con un atributo identificador.
  favBtn.setAttribute("data-fav-btn", "1");
  // Guarda el id del gato en el botón para poder usarlo luego.
  favBtn.setAttribute("data-id", cat.id);
  // Comprueba si el gato ya está en favoritos.
  let fav = isFav(cat.id);
  // Aplica o no la clase visual de favorito.
  favBtn.classList.toggle("is-fav", fav);
  // Muestra corazón relleno o vacío.
  favBtn.textContent = fav ? "❤️" : "🤍";
  // Etiqueta accesible del botón.
  favBtn.setAttribute("aria-label", "Marcar como favorito");
  // Indica accesibilidad sobre el estado del botón.
  favBtn.setAttribute("aria-pressed", fav ? "true" : "false");
  // Al hacer click, alterna favorito para este gato.
  favBtn.addEventListener("click", () => toggleFav(cat));
  // Inserta metadatos en el contenedor de acciones.
  actions.appendChild(meta);
  // Inserta botón favorito en el contenedor de acciones.
  actions.appendChild(favBtn);
  // Inserta el bloque de imagen en la tarjeta.
  card.appendChild(imgWrap);
  // Inserta el bloque de acciones en la tarjeta.
  card.appendChild(actions);
  // Devuelve la tarjeta ya montada.
  return card;
}
// Pide imágenes a TheCatAPI y las pinta en el grid principal.
async function fetchCats({ append = true } = {}) {
  // Si ya hay una carga en curso, se cancela esta ejecución.
  if (loading) return;
  // Activa la bandera de carga.
  loading = true;
  // Obtiene el límite de imágenes desde el input/select.
  let limit = Number(limitEl.value || 9);
  // Obtiene el tipo MIME seleccionado.
  let mime = typeEl.value.trim(); // "", "jpg,png", "gif"
  // Construye los parámetros de consulta.
  let params = new URLSearchParams();
  // Añade el número de imágenes a solicitar.
  params.set("limit", String(limit));
  // Añade la página actual.
  params.set("page", String(page));
  // Orden descendente.
  params.set("order", "DESC");
  // La API admite mime_types: jpg,png,gif
  // Si el usuario ha elegido un filtro, se añade.
  if (mime) params.set("mime_types", mime);
  // Construye la URL final con query string.
  let url = `${API_BASE}?${params.toString()}`;
  // Informa al usuario de que se está cargando contenido.
  setStatus("Cargando imágenes…", "loading");
  // Desactiva el botón de cargar más mientras se procesa la petición.
  btnMore.disabled = true;
  // Desactiva el botón de recargar mientras se procesa la petición.
  btnReload.disabled = true;
  try {
    // Lanza la petición fetch a la API.
    let res = await fetch(url, {
      // Si existe API_KEY, la manda en cabeceras.
      headers: API_KEY ? { "x-api-key": API_KEY } : undefined,
    });
    // Si la respuesta HTTP no es correcta, lanza error.
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    // Convierte la respuesta a JSON.
    let data = await res.json();
    // Verifica que la respuesta sea un array.
    if (!Array.isArray(data)) throw new Error("Respuesta inesperada");
    // Si append es false, vacía el grid antes de pintar nuevas imágenes.
    if (!append) gridEl.innerHTML = "";
    // Recorre las imágenes recibidas y crea una tarjeta por cada una.
    data.forEach((cat) => gridEl.appendChild(createCard(cat)));
    // Muestra mensaje de éxito.
    setStatus(`Cargadas ${data.length} imágenes.`, "ok");
    // Actualiza el estado visual de los botones favoritos.
    paintFavButtonsState();
  } catch (err) {
    // Si ocurre un error, informa al usuario.
    setStatus(`Error al cargar imágenes (${err.message}).`, "error");
  } finally {
    // Desactiva el estado de carga.
    loading = false;
    // Reactiva el botón de cargar más.
    btnMore.disabled = false;
    // Reactiva el botón de recargar.
    btnReload.disabled = false;
  }
}
// Dibuja la vista de favoritos usando lo almacenado en localStorage.
function paintFavs() {
  // Lee los favoritos actuales.
  let favs = readFavs();
  // Limpia el contenedor antes de repintar.
  favGridEl.innerHTML = "";
  // Si no hay favoritos...
  if (favs.length === 0) {
    // ...crea un mensaje vacío.
    let empty = document.createElement("div");
    // Le asigna clase CSS.
    empty.className = "catStatus";
    // Escribe texto orientativo para el usuario.
    empty.textContent = "No hay favoritos aún. Vuelve a Galería y marca algunos ❤️.";
    // Inserta el mensaje en el grid de favoritos.
    favGridEl.appendChild(empty);
    // Sale de la función.
    return;
  }
  // Recorre todos los favoritos guardados.
  favs.forEach((cat) => {
    // Crea la tarjeta principal.
    let card = document.createElement("article");
    // Asigna su clase CSS.
    card.className = "catCard";
    // Crea el wrapper de imagen.
    let imgWrap = document.createElement("div");
    // Asigna clase CSS al wrapper.
    imgWrap.className = "catImgWrap";
    // Crea el elemento img.
    let img = document.createElement("img");
    // Clase CSS de la imagen.
    img.className = "catImg";
    // URL de la imagen favorita.
    img.src = cat.url;
    // Texto alternativo accesible.
    img.alt = "Gato favorito";
    // Carga diferida.
    img.loading = "lazy";
    // Inserta la imagen dentro del wrapper.
    imgWrap.appendChild(img);
    // Crea bloque de acciones.
    let actions = document.createElement("div");
    // Clase CSS de acciones.
    actions.className = "catActions";
    // Crea bloque de metadatos.
    let meta = document.createElement("div");
    // Clase CSS de metadatos.
    meta.className = "catMeta";
    // Muestra el id del favorito.
    meta.textContent = `id: ${cat.id}`;
    // Crea botón para eliminar de favoritos.
    let delBtn = document.createElement("button");
    // Clase CSS del botón, ya con estado visual de favorito.
    delBtn.className = "catFavBtn is-fav";
    // Tipo botón para evitar submit.
    delBtn.type = "button";
    // Muestra icono de papelera.
    delBtn.textContent = "🗑️";
    // Tooltip del botón.
    delBtn.title = "Eliminar de favoritos";
    // Al hacer click, elimina el favorito usando toggleFav.
    delBtn.addEventListener("click", () => toggleFav(cat));
    // Inserta los metadatos en acciones.
    actions.appendChild(meta);
    // Inserta el botón de borrar en acciones.
    actions.appendChild(delBtn);
    // Inserta el wrapper de imagen en la tarjeta.
    card.appendChild(imgWrap);
    // Inserta el bloque de acciones en la tarjeta.
    card.appendChild(actions);
    // Inserta la tarjeta final en el grid de favoritos.
    favGridEl.appendChild(card);
  });
}
// Cambia entre la vista de galería y la vista de favoritos.
function setView(which) {
  // Comprueba si la vista pedida es la galería.
  let isGallery = which === "gallery";
  // Oculta o muestra la galería.
  viewGallery.classList.toggle("is-hidden", !isGallery);
  // Oculta o muestra favoritos.
  viewFavs.classList.toggle("is-hidden", isGallery);
  // Marca visualmente la pestaña de galería como activa o no.
  tabGallery.classList.toggle("is-active", isGallery);
  // Marca visualmente la pestaña de favoritos como activa o no.
  tabFavs.classList.toggle("is-active", !isGallery);
  // Si estamos entrando en favoritos, repinta su contenido.
  if (!isGallery) paintFavs();
}
// Reinicia la galería y vuelve a cargar imágenes desde la página inicial.
function resetAndLoad() {
  // Resetea la página a 0.
  page = 0;
  // Limpia el grid de galería.
  gridEl.innerHTML = "";
  // Lanza nueva carga.
  fetchCats({ append: true });
}
// Al pulsar la pestaña Galería, cambia a esa vista.
tabGallery.addEventListener("click", () => setView("gallery"));
// Al pulsar la pestaña Favoritos, cambia a esa vista.
tabFavs.addEventListener("click", () => setView("favs"));
// Al pulsar el botón de volver, regresa a la galería.
btnBackToGallery.addEventListener("click", () => setView("gallery"));
// Al pulsar recargar, reinicia página y vuelve a pedir imágenes.
btnReload.addEventListener("click", () => resetAndLoad());
// Al pulsar cargar más...
btnMore.addEventListener("click", () => {
  // ...avanza una página...
  page += 1;
  // ...y solicita más imágenes acumulándolas en el grid.
  fetchCats({ append: true });
});
// Al pulsar vaciar favoritos...
btnClearFavs.addEventListener("click", () => {
  // ...guarda un array vacío en localStorage.
  writeFavs([]);
  // ...repinta la vista de favoritos.
  paintFavs();
  // ...actualiza los corazones del grid principal.
  paintFavButtonsState();
  // ...e informa al usuario.
  setStatus("Favoritos vaciados.", "ok");
});
// Si cambia el límite de imágenes...
limitEl.addEventListener("change", () => resetAndLoad());
// ...se reinicia y recarga la galería.
// Si cambia el filtro de tipo de imagen...
typeEl.addEventListener("change", () => resetAndLoad());
// ...también se reinicia y recarga la galería.
// Arranque inicial de la aplicación:
// Actualiza el contador visual de favoritos al cargar la app.
updateFavBadge();
// Muestra inicialmente la vista de galería.
setView("gallery");
// Hace la primera carga de imágenes.
resetAndLoad();