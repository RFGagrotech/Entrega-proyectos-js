(() => {
  // Activa el modo estricto de JavaScript para evitar ciertos errores comunes.
  "use strict";
  // Función auxiliar para seleccionar un único elemento del DOM.
  // Recibe un selector CSS y, opcionalmente, un nodo raíz donde buscar.
  let $ = (sel, root = document) => root.querySelector(sel);
  // Función auxiliar para seleccionar varios elementos del DOM.
  // Devuelve siempre un array real en lugar de un NodeList.
  let $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  // URL base de la API de Rick and Morty.
  let API = "https://rickandmortyapi.com/api";
  // Clave usada para guardar los favoritos en localStorage.
  let LS_KEY = "rme_favorites_v1";
  // Convierte cualquier valor a texto seguro.
  // Si el valor es null o undefined, devuelve cadena vacía.
  let safeText = (v) => (v == null ? "" : String(v));
  // Limita un número entre un mínimo y un máximo.
  let clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  // Función debounce:
  // retrasa la ejecución de una función hasta que pase un tiempo sin volver a llamarla.
  // Muy útil para inputs de búsqueda mientras el usuario escribe.
  function debounce(fn, wait = 300) {
    // Variable donde se guardará el identificador del temporizador.
    let t = null;
    // Devuelve una nueva función que envuelve a la original.
    return (...args) => {
      // Si había una llamada pendiente, la cancela.
      clearTimeout(t);
      // Programa una nueva ejecución después del tiempo indicado.
      t = setTimeout(() => fn(...args), wait);
    };
  }
  // Lee el objeto de favoritos guardado en localStorage.
  function readFavs() {
    try {
      // Recupera el texto bruto almacenado.
      let raw = localStorage.getItem(LS_KEY);
      // Si existe contenido, lo parsea como JSON; si no, usa null.
      let parsed = raw ? JSON.parse(raw) : null;
      // Si no existe objeto válido, devuelve estructura vacía por defecto.
      if (!parsed || typeof parsed !== "object") {
        return { characters: [], episodes: [], locations: [] };
      }
      // Devuelve cada tipo asegurándose de que sea un array.
      return {
        characters: Array.isArray(parsed.characters) ? parsed.characters : [],
        episodes: Array.isArray(parsed.episodes) ? parsed.episodes : [],
        locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      };
    } catch {
      // Si hay error de lectura o parseo, devuelve estructura vacía.
      return { characters: [], episodes: [], locations: [] };
    }
  }
  // Guarda el objeto de favoritos en localStorage.
  function writeFavs(favs) {
    // Convierte el objeto a JSON y lo almacena bajo la clave LS_KEY.
    localStorage.setItem(LS_KEY, JSON.stringify(favs));
  }
  // Comprueba si un id concreto de un tipo está guardado en favoritos.
  function isFav(type, id) {
    // Lee el objeto actual de favoritos.
    let favs = readFavs();
    // Devuelve true si el array de ese tipo contiene el id.
    return favs[type]?.includes(id) ?? false;
  }
  // Añade o elimina un favorito.
  // Devuelve true si se añadió y false si se eliminó.
  function toggleFav(type, id) {
    // Lee favoritos actuales.
    let favs = readFavs();
    // Obtiene el array del tipo indicado o uno vacío si no existe.
    let arr = favs[type] ?? [];
    // Busca la posición del id dentro del array.
    let idx = arr.indexOf(id);
    // Si el id ya existe, lo elimina.
    if (idx >= 0) arr.splice(idx, 1);
    // Si no existe, lo añade.
    else arr.push(id);
    // Guarda de nuevo el array actualizado dentro del objeto.
    favs[type] = arr;
    // Persiste los cambios en localStorage.
    writeFavs(favs);
    // Devuelve true si se añadió, false si se eliminó.
    return idx < 0;
  }
  // Muestra u oculta el indicador visual de carga.
  function setLoading(on) {
    // Selecciona el elemento del loading.
    let el = $("#rmeLoading");
    // Añade o quita la clase rme-hidden según el valor recibido.
    el.classList.toggle("rme-hidden", !on);
  }
  // Muestra un mensaje de error o lo limpia si no hay ninguno.
  function setError(msg) {
    // Selecciona el contenedor de errores.
    let el = $("#rmeError");
    // Si no hay mensaje...
    if (!msg) {
      // ...oculta el contenedor...
      el.classList.add("rme-hidden");
      // ...borra su texto...
      el.textContent = "";
      // ...y termina la función.
      return;
    }
    // Si sí hay mensaje, muestra el contenedor.
    el.classList.remove("rme-hidden");
    // Inserta el texto del error.
    el.textContent = msg;
  }
  // Actualiza la zona de metadatos visibles.
  // Muestra el número de resultados y la página actual.
  function setMeta({ countText = "—", pageText = "—" } = {}) {
    // Actualiza el contador de resultados.
    $("#rmeCount").textContent = countText;
    // Actualiza el texto de paginación.
    $("#rmePage").textContent = pageText;
  }
  // Hace una petición GET a la API.
  async function apiGet(url) {
    // Lanza la petición fetch.
    let res = await fetch(url);
    // Si la respuesta HTTP no es correcta...
    if (!res.ok) {
      // Comprueba si es un 404, que la API usa para "sin resultados".
      let isNotFound = res.status === 404;
      // Intenta leer el cuerpo de la respuesta como texto.
      let txt = await res.text().catch(() => "");
      // Crea un error personalizado con mensaje adecuado.
      let err = new Error(isNotFound ? "No hay resultados" : `Error ${res.status}`);
      // Añade el status HTTP al error.
      err.status = res.status;
      // Añade también el body por si se quiere inspeccionar.
      err.body = txt;
      // Lanza el error.
      throw err;
    }
    // Si todo fue bien, devuelve el JSON parseado.
    return res.json();
  }
  // Extrae un id numérico desde una URL de la API.
  function idFromUrl(u) {
    // Convierte el valor recibido a string seguro.
    let s = String(u || "");
    // Divide la URL por "/" y elimina segmentos vacíos.
    let parts = s.split("/").filter(Boolean);
    // Se queda con la última parte.
    let last = parts[parts.length - 1];
    // Intenta convertir esa última parte a número.
    let n = Number(last);
    // Si es un número válido, lo devuelve; si no, devuelve null.
    return Number.isFinite(n) ? n : null;
  }
  // Intenta sacar una imagen de portada a partir de una lista de URLs de referencia.
  function coverFromRefs(refs) {
    // Si no es un array o está vacío, no hay portada posible.
    if (!Array.isArray(refs) || refs.length === 0) return null;
    // Extrae el id de la primera URL del array.
    let id = idFromUrl(refs[0]);
    // Si hay id válido, construye la URL del avatar del personaje.
    return id ? `${API}/character/avatar/${id}.jpeg` : null;
  }
  // Estado global de la aplicación.
  let state = {
    // Pestaña activa: characters, episodes, locations o favorites.
    tab: "characters",
    // Texto de búsqueda actual.
    query: "",
    // Filtro de estado para personajes.
    status: "",
    // Filtro de especie para personajes.
    species: "",
    // Página actual.
    page: 1,
    // Objeto info devuelto por la API: count, pages, next, prev...
    info: null,
    // Array de elementos renderizados actualmente.
    items: [],
    // Indica si se está usando el modo "cargar más".
    loadMoreMode: false,
  };
  // Objeto con referencias a muchos elementos del DOM.
  let els = {
    // Contenedor general de la app.
    app: $("#rmeApp"),
    // Botones o tabs principales.
    tabs: $$(".rme-tab"),
    // Formulario de búsqueda y filtros.
    form: $("#rmeForm"),
    // Input de texto de búsqueda.
    query: $("#rmeQuery"),
    // Select de estado del personaje.
    status: $("#rmeStatus"),
    // Input/select de especie.
    species: $("#rmeSpecies"),
    // Botón de reset del formulario.
    btnReset: $("#rmeBtnReset"),
    // Grid donde se pintan las tarjetas.
    grid: $("#rmeGrid"),
    // Botón de página anterior.
    btnPrev: $("#rmePrev"),
    // Botón de página siguiente.
    btnNext: $("#rmeNext"),
    // Botón de "cargar más".
    btnLoadMore: $("#rmeLoadMore"),
    // Drawer lateral del detalle.
    drawer: $("#rmeDrawer"),
    // Título del drawer.
    drawerTitle: $("#rmeDrawerTitle"),
    // Contenido HTML interno del drawer.
    drawerContent: $("#rmeDrawerContent"),
    // Botón para cerrar el drawer.
    drawerClose: $("#rmeDrawerClose"),
    // Fondo oscurecido detrás del drawer.
    drawerBackdrop: $("#rmeDrawerBackdrop"),
    // Campos que solo deben verse en la pestaña de personajes.
    onlyCharactersFields: $$("[data-rme-only='characters']"),
  };
  // Cambia la pestaña activa y refresca la interfaz.
  function setTab(newTab) {
    // Guarda la nueva pestaña en el estado.
    state.tab = newTab;
    // Reinicia la página al cambiar de pestaña.
    state.page = 1;
    // Borra la info de paginación anterior.
    state.info = null;
    // Limpia los items renderizados.
    state.items = [];
    // Resetea el modo cargar más.
    state.loadMoreMode = false;
    // Limpia cualquier error previo.
    setError(null);
    // Recorre todas las tabs para marcar visualmente la activa.
    els.tabs.forEach((b) => {
      // Añade clase activa si el data-rme-tab coincide con la pestaña seleccionada.
      b.classList.toggle("rme-tab--active", b.dataset.rmeTab === newTab);
    });
    // Solo en personajes se muestran filtros de status y species.
    let showCharFilters = newTab === "characters";
    // Muestra u oculta esos campos según proceda.
    els.onlyCharactersFields.forEach((node) => {
      node.style.display = showCharFilters ? "" : "none";
    });
    // Ajusta el placeholder del campo de búsqueda según la pestaña.
    if (newTab === "characters") {
      els.query.placeholder = "Buscar personaje por nombre...";
    } else if (newTab === "episodes") {
      els.query.placeholder = "Buscar episodio por nombre (o código S01E01)...";
    } else if (newTab === "locations") {
      els.query.placeholder = "Buscar localización por nombre...";
    } else {
      els.query.placeholder = "Buscar en favoritos...";
    }
    // Si se entra en la pestaña de favoritos...
    if (newTab === "favorites") {
      // ...renderiza favoritos directamente...
      renderFavorites();
      // ...actualiza paginación...
      updatePaginationButtons();
      // ...y muestra metadatos específicos.
      setMeta({ countText: "Favoritos", pageText: "—" });
      // Sale de la función sin consultar endpoint general.
      return;
    }
    // Para el resto de pestañas, consulta la API y renderiza.
    fetchAndRender({ replace: true });
  }
  // Construye la URL del endpoint según pestaña y filtros activos.
  function buildEndpoint() {
    // Limpia espacios de la query.
    let q = state.query.trim();
    // Asegura que la página esté dentro de un rango razonable.
    let p = clamp(state.page, 1, 10_000);
    // Si la pestaña activa es personajes...
    if (state.tab === "characters") {
      // Crea un objeto de parámetros de URL.
      let params = new URLSearchParams();
      // Si hay texto, filtra por nombre.
      if (q) params.set("name", q);
      // Si hay estado, lo añade.
      if (state.status) params.set("status", state.status);
      // Si hay especie, la añade tras recortar espacios.
      if (state.species.trim()) params.set("species", state.species.trim());
      // Añade la página.
      params.set("page", String(p));
      // Devuelve la URL final.
      return `${API}/character/?${params.toString()}`;
    }
    // Si la pestaña es episodios...
    if (state.tab === "episodes") {
      // Crea parámetros.
      let params = new URLSearchParams();
      // Si hay búsqueda, filtra por nombre.
      if (q) params.set("name", q);
      // Añade página.
      params.set("page", String(p));
      // Devuelve URL del endpoint de episodios.
      return `${API}/episode/?${params.toString()}`;
    }
    // Si la pestaña es localizaciones...
    if (state.tab === "locations") {
      // Crea parámetros.
      let params = new URLSearchParams();
      // Si hay búsqueda, filtra por nombre.
      if (q) params.set("name", q);

      // Añade página.
      params.set("page", String(p));

      // Devuelve URL del endpoint de localizaciones.
      return `${API}/location/?${params.toString()}`;
    }
    // Si no coincide con ninguna pestaña válida, devuelve string vacío.
    return "";
  }
  // Consulta la API y pinta resultados.
  async function fetchAndRender({ replace }) {
    // Muestra loading.
    setLoading(true);
    // Limpia error anterior.
    setError(null);
    try {
      // Construye la URL de consulta.
      let url = buildEndpoint();
      // Llama a la API.
      let data = await apiGet(url);
      // Guarda la info de paginación.
      state.info = data.info || null;
      // Asegura que results sea un array.
      let results = Array.isArray(data.results) ? data.results : [];
      // Si replace=true, sustituye items actuales.
      if (replace) state.items = results;
      // Si replace=false, concatena al final.
      else state.items = state.items.concat(results);
      // Renderiza el grid.
      renderGrid();
      // Actualiza estado de botones de paginación.
      updatePaginationButtons();
      // Obtiene el total de resultados o usa longitud actual si falta.
      let count = state.info?.count ?? state.items.length;
      // Obtiene el número total de páginas o "?" si falta.
      let pages = state.info?.pages ?? "?";
      // Actualiza metadatos visibles.
      setMeta({
        countText: `${count} resultados`,
        pageText: `Página ${state.page} / ${pages}`,
      });
    } catch (err) {
      // Si la API respondió 404, significa "sin resultados".
      if (err?.status === 404) {
        // Se fuerza una info vacía.
        state.info = { count: 0, pages: 0, next: null, prev: null };
        // Se vacían los items.
        state.items = [];
        // Se vuelve a renderizar el grid.
        renderGrid();
        // Se actualizan botones de paginación.
        updatePaginationButtons();
        // Se actualizan metadatos para reflejar 0 resultados.
        setMeta({ countText: "0 resultados", pageText: "—" });
        // Se muestra mensaje específico.
        setError("No hay resultados con esos filtros/búsqueda.");
      } else {
        // Para cualquier otro error, muestra mensaje genérico de fallo.
        setError("Error al consumir la API (red/endpoint). Revisa tu conexión o inténtalo de nuevo.");
      }
    } finally {
      // Oculta loading siempre, haya éxito o error.
      setLoading(false);
    }
  }
  // Ajusta el estado visual de los botones de paginación.
  function updatePaginationButtons() {
    // Comprueba si existe página anterior.
    let hasPrev = !!state.info?.prev;
    // Comprueba si existe página siguiente.
    let hasNext = !!state.info?.next;
    // Desactiva o activa el botón "prev".
    els.btnPrev.disabled = state.tab === "favorites" || !hasPrev;
    // Desactiva o activa el botón "next".
    els.btnNext.disabled = state.tab === "favorites" || !hasNext;
    // Desactiva o activa el botón "load more".
    els.btnLoadMore.disabled = state.tab === "favorites" || !hasNext;
    // En favoritos oculta el botón de cargar más; en otras pestañas lo muestra.
    els.btnLoadMore.style.display = state.tab === "favorites" ? "none" : "";
  }
  // Renderiza el grid principal según la pestaña activa.
  function renderGrid() {
    // Toma la lista de items del estado.
    const list = state.items;
    // Si no hay resultados...
    if (!list.length) {
      // ...muestra una tarjeta vacía con mensaje.
      els.grid.innerHTML = `
        <div class="rme-card" style="grid-column: 1 / -1;">
          <div class="rme-card__body">
            <h3 class="rme-card__title">Sin resultados</h3>
            <p class="rme-card__sub">Prueba otra búsqueda o cambia filtros.</p>
          </div>
        </div>
      `;
      return;
    }
    // Si la pestaña activa es personajes...
    if (state.tab === "characters") {
      // Genera el HTML de todas las tarjetas y lo inserta en el grid.
      els.grid.innerHTML = list.map(renderCharacterCard).join("");
      // Asigna eventos a las tarjetas renderizadas.
      wireCardEvents("characters");
      return;
    }
    // Si la pestaña activa es episodios...
    if (state.tab === "episodes") {
      // Renderiza todas las tarjetas de episodios.
      els.grid.innerHTML = list.map(renderEpisodeCard).join("");
      // Asigna eventos.
      wireCardEvents("episodes");
      return;
    }
    // Si la pestaña activa es localizaciones...
    if (state.tab === "locations") {
      // Renderiza todas las tarjetas de localización.
      els.grid.innerHTML = list.map(renderLocationCard).join("");
      // Asigna eventos.
      wireCardEvents("locations");
      return;
    }
  }
  // Devuelve el símbolo visual del favorito.
  function favIconHtml(active) {
    // Si está activo, estrella rellena; si no, estrella vacía.
    return active ? "★" : "☆";
  }
  // Genera el HTML de una tarjeta de personaje.
  function renderCharacterCard(c) {
    // Comprueba si el personaje es favorito.
    let fav = isFav("characters", c.id);
    // Guarda el estado como texto seguro.
    let status = safeText(c.status);
    // Guarda la especie como texto seguro.
    let species = safeText(c.species);
    // Guarda el género como texto seguro.
    let gender = safeText(c.gender);
    // Devuelve la plantilla HTML de la tarjeta.
    return `
      <article class="rme-card" data-rme-type="characters" data-rme-id="${c.id}">
        <div class="rme-card__media">
          <img src="${safeText(c.image)}" alt="${safeText(c.name)}" loading="lazy" />
        </div>
        <div class="rme-card__body">
          <h3 class="rme-card__title">${safeText(c.name)}</h3>
          <p class="rme-card__sub">${status} • ${species} • ${gender}</p>
          <div class="rme-badges">
            <span class="rme-badge">${safeText(c.origin?.name)}</span>
            <span class="rme-badge">${safeText(c.location?.name)}</span>
          </div>
          <div class="rme-card__actions">
            <button class="rme-btn rme-btn--primary" type="button" data-rme-action="open">Ver detalle</button>
            <button class="rme-iconbtn" type="button" data-rme-action="fav" aria-label="Favorito">
              ${favIconHtml(fav)}
            </button>
          </div>
        </div>
      </article>
    `;
  }
  // Genera el HTML de una tarjeta de episodio.
  function renderEpisodeCard(e) {
    // Comprueba si el episodio es favorito.
    let fav = isFav("episodes", e.id);
    // Intenta sacar una portada a partir de sus personajes.
    let cover = coverFromRefs(e.characters);
    // Devuelve la plantilla HTML.
    return `
      <article class="rme-card" data-rme-type="episodes" data-rme-id="${e.id}">
        <div class="rme-card__media" aria-hidden="true">
          ${
            cover
              ? `<img src="${cover}" alt="" loading="lazy" />`
              : `<div style="width:100%;height:100%;display:grid;place-items:center;padding:12px;">
                   <div style="text-align:center;">
                     <div style="font-weight:900;font-size:18px;letter-spacing:0.5px;">${safeText(e.episode)}</div>
                     <div style="color:rgba(231,238,252,0.7);font-size:12px;margin-top:6px;">${safeText(e.air_date)}</div>
                   </div>
                 </div>`
          }
        </div>
        <div class="rme-card__body">
          <h3 class="rme-card__title">${safeText(e.name)}</h3>
          <p class="rme-card__sub">${safeText(e.episode)} • ${safeText(e.air_date)}</p>
          <div class="rme-badges">
            <span class="rme-badge">${(e.characters?.length ?? 0)} personajes</span>
          </div>
          <div class="rme-card__actions">
            <button class="rme-btn rme-btn--primary" type="button" data-rme-action="open">Ver detalle</button>
            <button class="rme-iconbtn" type="button" data-rme-action="fav" aria-label="Favorito">
              ${favIconHtml(fav)}
            </button>
          </div>
        </div>
      </article>
    `;
  }
  // Genera el HTML de una tarjeta de localización.
  function renderLocationCard(l) {
    // Comprueba si la localización es favorita.
    let fav = isFav("locations", l.id);
    // Intenta obtener una portada usando el primer residente.
    let cover = coverFromRefs(l.residents);
    // Devuelve la plantilla HTML.
    return `
      <article class="rme-card" data-rme-type="locations" data-rme-id="${l.id}">
        <div class="rme-card__media" aria-hidden="true">
          ${
            cover
              ? `<img src="${cover}" alt="" loading="lazy" />`
              : `<div style="width:100%;height:100%;display:grid;place-items:center;padding:12px;">
                   <div style="text-align:center;">
                     <div style="font-weight:900;font-size:16px;">${safeText(l.type) || "Location"}</div>
                     <div style="color:rgba(231,238,252,0.7);font-size:12px;margin-top:6px;">${safeText(l.dimension) || "—"}</div>
                   </div>
                 </div>`
          }
        </div>
        <div class="rme-card__body">
          <h3 class="rme-card__title">${safeText(l.name)}</h3>
          <p class="rme-card__sub">${safeText(l.type)} • ${safeText(l.dimension)}</p>
          <div class="rme-badges">
            <span class="rme-badge">${(l.residents?.length ?? 0)} residentes</span>
          </div>
          <div class="rme-card__actions">
            <button class="rme-btn rme-btn--primary" type="button" data-rme-action="open">Ver detalle</button>
            <button class="rme-iconbtn" type="button" data-rme-action="fav" aria-label="Favorito">
              ${favIconHtml(fav)}
            </button>
          </div>
        </div>
      </article>
    `;
  }
  // Asigna eventos a las tarjetas renderizadas del tipo indicado.
  function wireCardEvents(type) {
    // Selecciona todas las tarjetas de ese tipo dentro del grid.
    let cards = $$(`.rme-card[data-rme-type="${type}"]`, els.grid);
    // Recorre cada tarjeta.
    cards.forEach((card) => {
      // Extrae su id desde data-rme-id.
      let id = Number(card.dataset.rmeId);
      // Selecciona el botón de abrir detalle.
      let btnOpen = $(`[data-rme-action="open"]`, card);
      // Selecciona el botón de favorito.
      let btnFav = $(`[data-rme-action="fav"]`, card);
      // Al hacer click en abrir, carga el detalle.
      btnOpen.addEventListener("click", () => openDetail(type, id));
      // Al hacer click en favorito...
      btnFav.addEventListener("click", () => {
        // ...alterna el favorito y guarda si se añadió o quitó.
        let added = toggleFav(type, id);
        // Actualiza el icono visual.
        btnFav.textContent = favIconHtml(added);
        // Si estamos viendo favoritos, vuelve a renderizarlos.
        if (state.tab === "favorites") renderFavorites();
      });
    });
  }
  // Abre el drawer lateral con el HTML recibido.
  function openDrawer(title, html) {
    // Inserta el título.
    els.drawerTitle.textContent = title;
    // Inserta el contenido HTML.
    els.drawerContent.innerHTML = html;
    // Muestra el drawer.
    els.drawer.classList.remove("rme-hidden");
    // Marca aria-hidden como false.
    els.drawer.setAttribute("aria-hidden", "false");
    // Bloquea el scroll de la página principal.
    document.body.style.overflow = "hidden";
  }
  // Cierra el drawer y limpia su contenido.
  function closeDrawer() {
    // Oculta el drawer.
    els.drawer.classList.add("rme-hidden");
    // Marca aria-hidden como true.
    els.drawer.setAttribute("aria-hidden", "true");
    // Limpia el HTML interno.
    els.drawerContent.innerHTML = "";
    // Restaura el scroll de la página.
    document.body.style.overflow = "";
  }
  // Carga y muestra el detalle de un elemento.
  async function openDetail(type, id) {
    // Limpia errores previos.
    setError(null);
    // Muestra loading.
    setLoading(true);
    try {
      // Si se pide detalle de personaje...
      if (type === "characters") {
        // Consulta ese personaje por id.
        let c = await apiGet(`${API}/character/${id}`);
        // Toma como máximo los primeros 8 episodios.
        let eps = Array.isArray(c.episode) ? c.episode.slice(0, 8) : [];
        // Construye el HTML de episodios relacionados.
        let epsHtml =
          eps.length === 0
            ? `<div class="rme-detail__v">—</div>`
            : `<div class="rme-list">
                ${eps
                  .map((u) => {
                    // Extrae el id del episodio desde su URL.
                    let eid = Number(String(u).split("/").pop());
                    // Devuelve un botón para abrir ese episodio.
                    return `<button class="rme-linkbtn" type="button" data-rme-link="episode" data-rme-id="${eid}">
                      Episodio #${eid}
                    </button>`;
                  })
                  .join("")}
              </div>`;
        // Comprueba si el personaje ya es favorito.
        let fav = isFav("characters", c.id);
        // Abre el drawer con todo el detalle.
        openDrawer(
          c.name,
          `
          <div class="rme-detail">
            <div class="rme-detail__hero">
              <img src="${safeText(c.image)}" alt="${safeText(c.name)}" />
            </div>

            <div class="rme-detail__row">
              <div class="rme-detail__k">Estado / Especie / Género</div>
              <div class="rme-detail__v">${safeText(c.status)} • ${safeText(c.species)} • ${safeText(c.gender)}</div>
            </div>

            <div class="rme-detail__row">
              <div class="rme-detail__k">Origen</div>
              <div class="rme-detail__v">${safeText(c.origin?.name)}</div>
            </div>

            <div class="rme-detail__row">
              <div class="rme-detail__k">Localización</div>
              <div class="rme-detail__v">${safeText(c.location?.name)}</div>
            </div>

            <div class="rme-detail__row">
              <div class="rme-detail__k">Episodios (primeros 8)</div>
              ${epsHtml}
            </div>

            <div class="rme-detail__row">
              <div class="rme-detail__k">Acciones</div>
              <div class="rme-detail__v">
                <button class="rme-btn rme-btn--primary" type="button" data-rme-drawer-fav="${c.id}">
                  ${fav ? "Quitar de favoritos" : "Añadir a favoritos"}
                </button>
              </div>
            </div>
          </div>
        `
        );
        // Selecciona todos los botones de episodios dentro del drawer.
        $$("[data-rme-link='episode']", els.drawerContent).forEach((btn) => {
          // Al hacer click, abre el detalle del episodio.
          btn.addEventListener("click", () => openDetail("episodes", Number(btn.dataset.rmeId)));
        });
        // Busca el botón de favoritos dentro del drawer.
        let favBtn = $("[data-rme-drawer-fav]", els.drawerContent);
        // Si existe ese botón...
        if (favBtn) {
          // ...añade su evento click.
          favBtn.addEventListener("click", () => {
            // Alterna el favorito del personaje.
            let added = toggleFav("characters", c.id);
            // Cambia el texto del botón.
            favBtn.textContent = added ? "Quitar de favoritos" : "Añadir a favoritos";
            // Refresca la vista actual para sincronizar iconos.
            renderIfNotFavoritesTab();
          });
        }
        // Sale de la función tras renderizar personaje.
        return;
      }
      // Si se pide detalle de episodio...
      if (type === "episodes") {
        // Consulta el episodio por id.
        let e = await apiGet(`${API}/episode/${id}`);
        // Comprueba si ya es favorito.
        let fav = isFav("episodes", e.id);
        // Toma como máximo los primeros 12 personajes.
        let chars = Array.isArray(e.characters) ? e.characters.slice(0, 12) : [];
        // Construye el HTML de personajes relacionados.
        let charsHtml =
          chars.length === 0
            ? `<div class="rme-detail__v">—</div>`
            : `<div class="rme-list">
                ${chars
                  .map((u) => {
                    // Extrae el id del personaje desde la URL.
                    let cid = Number(String(u).split("/").pop());
                    // Devuelve un botón para abrir ese personaje.
                    return `<button class="rme-linkbtn" type="button" data-rme-link="character" data-rme-id="${cid}">
                      Personaje #${cid}
                    </button>`;
                  })
                  .join("")}
              </div>`;
        // Abre el drawer con detalle del episodio.
        openDrawer(
          e.name,
          `
          <div class="rme-detail">
            <div class="rme-detail__row">
              <div class="rme-detail__k">Código</div>
              <div class="rme-detail__v">${safeText(e.episode)}</div>
            </div>

            <div class="rme-detail__row">
              <div class="rme-detail__k">Fecha de emisión</div>
              <div class="rme-detail__v">${safeText(e.air_date)}</div>
            </div>

            <div class="rme-detail__row">
              <div class="rme-detail__k">Personajes (primeros 12)</div>
              ${charsHtml}
            </div>

            <div class="rme-detail__row">
              <div class="rme-detail__k">Acciones</div>
              <div class="rme-detail__v">
                <button class="rme-btn rme-btn--primary" type="button" data-rme-drawer-fav="${e.id}">
                  ${fav ? "Quitar de favoritos" : "Añadir a favoritos"}
                </button>
              </div>
            </div>
          </div>
        `
        );
        // Busca enlaces a personajes dentro del drawer.
        $$("[data-rme-link='character']", els.drawerContent).forEach((btn) => {
          // Al pulsar, abre ese personaje.
          btn.addEventListener("click", () => openDetail("characters", Number(btn.dataset.rmeId)));
        });
        // Busca el botón de favorito del drawer.
        let favBtn = $("[data-rme-drawer-fav]", els.drawerContent);
        // Si existe...
        if (favBtn) {
          // ...añade evento click.
          favBtn.addEventListener("click", () => {
            // Alterna favorito.
            let added = toggleFav("episodes", e.id);
            // Cambia el texto del botón.
            favBtn.textContent = added ? "Quitar de favoritos" : "Añadir a favoritos";
            // Refresca la vista actual.
            renderIfNotFavoritesTab();
          });
        }
        // Sale de la función.
        return;
      }
      // Si se pide detalle de localización...
      if (type === "locations") {
        // Consulta la localización por id.
        let l = await apiGet(`${API}/location/${id}`);
        // Comprueba si es favorita.
        let fav = isFav("locations", l.id);
        // Toma como máximo los primeros 12 residentes.
        let residents = Array.isArray(l.residents) ? l.residents.slice(0, 12) : [];
        // Construye el HTML de residentes relacionados.
        let resHtml =
          residents.length === 0
            ? `<div class="rme-detail__v">—</div>`
            : `<div class="rme-list">
                ${residents
                  .map((u) => {
                    // Extrae el id del personaje residente.
                    let cid = Number(String(u).split("/").pop());
                    // Devuelve un botón para abrir ese residente.
                    return `<button class="rme-linkbtn" type="button" data-rme-link="character" data-rme-id="${cid}">
                      Residente #${cid}
                    </button>`;
                  })
                  .join("")}
              </div>`;
        // Abre el drawer con el detalle de la localización.
        openDrawer(
          l.name,
          `
          <div class="rme-detail">
            <div class="rme-detail__row">
              <div class="rme-detail__k">Tipo</div>
              <div class="rme-detail__v">${safeText(l.type)}</div>
            </div>

            <div class="rme-detail__row">
              <div class="rme-detail__k">Dimensión</div>
              <div class="rme-detail__v">${safeText(l.dimension)}</div>
            </div>

            <div class="rme-detail__row">
              <div class="rme-detail__k">Residentes (primeros 12)</div>
              ${resHtml}
            </div>

            <div class="rme-detail__row">
              <div class="rme-detail__k">Acciones</div>
              <div class="rme-detail__v">
                <button class="rme-btn rme-btn--primary" type="button" data-rme-drawer-fav="${l.id}">
                  ${fav ? "Quitar de favoritos" : "Añadir a favoritos"}
                </button>
              </div>
            </div>
          </div>
        `
        );
        // Busca enlaces a residentes dentro del drawer.
        $$("[data-rme-link='character']", els.drawerContent).forEach((btn) => {
          // Al pulsar, abre el personaje correspondiente.
          btn.addEventListener("click", () => openDetail("characters", Number(btn.dataset.rmeId)));
        });
        // Busca el botón de favorito del drawer.
        let favBtn = $("[data-rme-drawer-fav]", els.drawerContent);
        // Si existe...
        if (favBtn) {
          // ...añade el evento click.
          favBtn.addEventListener("click", () => {
            // Alterna favorito.
            let added = toggleFav("locations", l.id);
            // Cambia el texto del botón.
            favBtn.textContent = added ? "Quitar de favoritos" : "Añadir a favoritos";
            // Refresca la vista actual.
            renderIfNotFavoritesTab();
          });
        }
        // Sale de la función.
        return;
      }
    } catch (e) {
      // Si falla la carga del detalle, muestra error.
      setError("No se pudo cargar el detalle (error de red o endpoint).");
    } finally {
      // Oculta loading siempre.
      setLoading(false);
    }
  }
  // Re-renderiza la vista actual para refrescar el estado de favoritos.
  function renderIfNotFavoritesTab() {
    // Si no estamos en favoritos...
    if (state.tab !== "favorites") {
      // ...re-renderiza el grid actual.
      renderGrid();
    } else {
      // Si sí estamos en favoritos, vuelve a pintarlos.
      renderFavorites();
    }
  }
  // Renderiza la pestaña de favoritos.
  async function renderFavorites() {
    // Limpia errores previos.
    setError(null);
    // Activa loading.
    setLoading(true);
    // Lee el objeto de favoritos desde localStorage.
    let favs = readFavs();
    // Toma la query actual en minúsculas para filtrar.
    let q = state.query.trim().toLowerCase();
    try {
      // Variable declarada aunque en este código no se utiliza.
      let chunks = [];
      // Copia y ordena ids de personajes.
      let charIds = favs.characters.slice().sort((a, b) => a - b);
      // Copia y ordena ids de episodios.
      let epiIds = favs.episodes.slice().sort((a, b) => a - b);
      // Copia y ordena ids de localizaciones.
      let locIds = favs.locations.slice().sort((a, b) => a - b);
      // Pide a la API todos los favoritos por lote usando Promise.all.
      let [chars, epis, locs] = await Promise.all([
        charIds.length ? apiGet(`${API}/character/${charIds.join(",")}`) : [],
        epiIds.length ? apiGet(`${API}/episode/${epiIds.join(",")}`) : [],
        locIds.length ? apiGet(`${API}/location/${locIds.join(",")}`) : [],
      ]);
      // Función auxiliar que asegura convertir respuesta a array.
      let normArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
      // Une todos los favoritos normalizados en un único array común.
      let all = [
        ...normArr(chars).map((x) => ({ type: "characters", data: x })),
        ...normArr(epis).map((x) => ({ type: "episodes", data: x })),
        ...normArr(locs).map((x) => ({ type: "locations", data: x })),
      ];
      // Si hay texto de búsqueda, filtra favoritos por nombre.
      let filtered = q
        ? all.filter((item) => safeText(item.data.name).toLowerCase().includes(q))
        : all;
      // Si no queda nada tras el filtrado...
      if (!filtered.length) {
        // ...muestra una tarjeta informativa.
        els.grid.innerHTML = `
          <div class="rme-card" style="grid-column: 1 / -1;">
            <div class="rme-card__body">
              <h3 class="rme-card__title">No hay favoritos</h3>
              <p class="rme-card__sub">Marca estrellas en tarjetas o en el detalle para guardarlos.</p>
            </div>
          </div>
        `;
        return;
      }
      // Ordena primero por tipo y luego por nombre.
      filtered.sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return safeText(a.data.name).localeCompare(safeText(b.data.name));
      });
      // Genera el HTML de todos los favoritos y lo pinta en el grid.
      els.grid.innerHTML = filtered
        .map((it) => {
          if (it.type === "characters") return renderCharacterCard(it.data);
          if (it.type === "episodes") return renderEpisodeCard(it.data);
          return renderLocationCard(it.data);
        })
        .join("");
      // Asigna eventos a todas las tarjetas renderizadas.
      wireCardEvents("characters");
      wireCardEvents("episodes");
      wireCardEvents("locations");
    } catch (e) {
      // Si falla algo, muestra mensaje de error.
      setError("No se pudieron cargar los favoritos (posible error de red).");
    } finally {
      // Oculta loading.
      setLoading(false);
    }
  }
  // Recorre todas las tabs y asigna su evento de cambio.
  els.tabs.forEach((btn) => {
    // Al hacer click, cambia a la pestaña indicada en data-rme-tab.
    btn.addEventListener("click", () => setTab(btn.dataset.rmeTab));
  });
  // Evento submit del formulario de búsqueda/filtros.
  els.form.addEventListener("submit", (ev) => {
    // Evita la recarga de la página.
    ev.preventDefault();
    // Copia el valor del input query al estado.
    state.query = els.query.value;
    // Copia el valor del filtro status al estado.
    state.status = els.status.value;
    // Copia el valor del filtro species al estado.
    state.species = els.species.value;
    // Reinicia la página a 1.
    state.page = 1;
    // Resetea el modo cargar más.
    state.loadMoreMode = false;
    // Si estamos en favoritos...
    if (state.tab === "favorites") {
      // ...simplemente vuelve a renderizar favoritos.
      renderFavorites();
      return;
    }
    // En el resto de casos, consulta API y sustituye contenido.
    fetchAndRender({ replace: true });
  });
  // Evento del botón reset del formulario.
  els.btnReset.addEventListener("click", () => {
    // Limpia visualmente el campo query.
    els.query.value = "";
    // Limpia visualmente el campo status.
    els.status.value = "";
    // Limpia visualmente el campo species.
    els.species.value = "";
    // Limpia el estado de query.
    state.query = "";
    // Limpia el estado de status.
    state.status = "";
    // Limpia el estado de species.
    state.species = "";
    // Vuelve a la primera página.
    state.page = 1;
    // Desactiva modo cargar más.
    state.loadMoreMode = false;
    // Limpia errores visibles.
    setError(null);
    // Si estamos en favoritos...
    if (state.tab === "favorites") {
      // ...re-renderiza favoritos.
      renderFavorites();
      return;
    }
    // En otras pestañas, vuelve a consultar la API desde cero.
    fetchAndRender({ replace: true });
  });
  // Función debounce usada para búsqueda en vivo al teclear.
  let onTyping = debounce(() => {
    // Copia el valor actual del input al estado.
    state.query = els.query.value;
    // Reinicia página.
    state.page = 1;
    // Desactiva modo cargar más.
    state.loadMoreMode = false;
    // Si estamos en favoritos...
    if (state.tab === "favorites") {
      // ...filtra y renderiza favoritos.
      renderFavorites();
      return;
    }
    // En otras pestañas, vuelve a consultar la API.
    fetchAndRender({ replace: true });
  }, 450);
  // Asigna la búsqueda en vivo al evento input.
  els.query.addEventListener("input", onTyping);
  // Evento del botón página anterior.
  els.btnPrev.addEventListener("click", () => {
    // Si no existe página anterior, no hace nada.
    if (!state.info?.prev) return;
    // Reduce la página sin bajar de 1.
    state.page = Math.max(1, state.page - 1);
    // Desactiva modo cargar más.
    state.loadMoreMode = false;
    // Consulta la API sustituyendo resultados.
    fetchAndRender({ replace: true });
    // Hace scroll suave arriba del todo.
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  // Evento del botón página siguiente.
  els.btnNext.addEventListener("click", () => {
    // Si no existe página siguiente, no hace nada.
    if (!state.info?.next) return;
    // Incrementa la página.
    state.page += 1;
    // Desactiva modo cargar más.
    state.loadMoreMode = false;
    // Consulta la API sustituyendo resultados.
    fetchAndRender({ replace: true });
    // Hace scroll suave arriba del todo.
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  // Evento del botón "Cargar más".
  els.btnLoadMore.addEventListener("click", () => {
    // Si no hay siguiente página, no hace nada.
    if (!state.info?.next) return;
    // Avanza una página.
    state.page += 1;
    // Activa modo cargar más.
    state.loadMoreMode = true;
    // Consulta la API concatenando los resultados.
    fetchAndRender({ replace: false });
  });
  // Evento del botón de cierre del drawer.
  els.drawerClose.addEventListener("click", closeDrawer);
  // Evento del fondo del drawer para cerrar al pulsar fuera.
  els.drawerBackdrop.addEventListener("click", closeDrawer);
  // Evento global de teclado.
  document.addEventListener("keydown", (e) => {
    // Si se pulsa Escape y el drawer está visible...
    if (e.key === "Escape" && !els.drawer.classList.contains("rme-hidden")) {
      // ...lo cierra.
      closeDrawer();
    }
  });
  // Inicializa la app cargando por defecto la pestaña de personajes.
  setTab("characters");
})();