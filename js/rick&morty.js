(() => {
  "use strict";

  let $ = (sel, root = document) => root.querySelector(sel);
  let $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  let API = "https://rickandmortyapi.com/api";
  let LS_KEY = "rme_favorites_v1";
  let safeText = (v) => (v == null ? "" : String(v));
  let clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function debounce(fn, wait = 300) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function readFavs() {
    try {
      let raw = localStorage.getItem(LS_KEY);
      let parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return { characters: [], episodes: [], locations: [] };
      return {
        characters: Array.isArray(parsed.characters) ? parsed.characters : [],
        episodes: Array.isArray(parsed.episodes) ? parsed.episodes : [],
        locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      };
    } catch {
      return { characters: [], episodes: [], locations: [] };
    }
  }

  function writeFavs(favs) {
    localStorage.setItem(LS_KEY, JSON.stringify(favs));
  }

  function isFav(type, id) {
    let favs = readFavs();
    return favs[type]?.includes(id) ?? false;
  }

  function toggleFav(type, id) {
    let favs = readFavs();
    let arr = favs[type] ?? [];
    let idx = arr.indexOf(id);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(id);
    favs[type] = arr;
    writeFavs(favs);
    return idx < 0; // true = añadido
  }

  function setLoading(on) {
    let el = $("#rmeLoading");
    el.classList.toggle("rme-hidden", !on);
  }

  function setError(msg) {
    let el = $("#rmeError");
    if (!msg) {
      el.classList.add("rme-hidden");
      el.textContent = "";
      return;
    }
    el.classList.remove("rme-hidden");
    el.textContent = msg;
  }

  function setMeta({ countText = "—", pageText = "—" } = {}) {
    $("#rmeCount").textContent = countText;
    $("#rmePage").textContent = pageText;
  }

  async function apiGet(url) {
    let res = await fetch(url);
    if (!res.ok) {
      // La API responde 404 cuando no hay resultados con filtros/búsqueda
      let isNotFound = res.status === 404;
      let txt = await res.text().catch(() => "");
      let err = new Error(isNotFound ? "No hay resultados" : `Error ${res.status}`);
      err.status = res.status;
      err.body = txt;
      throw err;
    }
    return res.json();
  }

  function idFromUrl(u) {
  let s = String(u || "");
  let parts = s.split("/").filter(Boolean);
  let last = parts[parts.length - 1];
  let n = Number(last);
  return Number.isFinite(n) ? n : null;
  }

  function coverFromRefs(refs) {
  if (!Array.isArray(refs) || refs.length === 0) return null;
  let id = idFromUrl(refs[0]);
  return id ? `${API}/character/avatar/${id}.jpeg` : null;
}

  let state = {
    tab: "characters", // characters | episodes | locations | favorites
    query: "",
    status: "",
    species: "",
    page: 1,
    info: null, // {count, pages, next, prev}
    items: [],
    loadMoreMode: false, // si pulsas "Cargar más" concatenas
  };

  let els = {
    app: $("#rmeApp"),
    tabs: $$(".rme-tab"),
    form: $("#rmeForm"),
    query: $("#rmeQuery"),
    status: $("#rmeStatus"),
    species: $("#rmeSpecies"),
    btnReset: $("#rmeBtnReset"),
    grid: $("#rmeGrid"),
    btnPrev: $("#rmePrev"),
    btnNext: $("#rmeNext"),
    btnLoadMore: $("#rmeLoadMore"),
    drawer: $("#rmeDrawer"),
    drawerTitle: $("#rmeDrawerTitle"),
    drawerContent: $("#rmeDrawerContent"),
    drawerClose: $("#rmeDrawerClose"),
    drawerBackdrop: $("#rmeDrawerBackdrop"),
    onlyCharactersFields: $$("[data-rme-only='characters']"),
  };

  function setTab(newTab) {
    state.tab = newTab;
    state.page = 1;
    state.info = null;
    state.items = [];
    state.loadMoreMode = false;
    setError(null);

    // UI tabs
    els.tabs.forEach((b) => b.classList.toggle("rme-tab--active", b.dataset.rmeTab === newTab));

    // Mostrar/ocultar filtros exclusivos de personajes
    let showCharFilters = newTab === "characters";
    els.onlyCharactersFields.forEach((node) => (node.style.display = showCharFilters ? "" : "none"));

    // Ajustar placeholder de búsqueda según tab
    if (newTab === "characters") {
      els.query.placeholder = "Buscar personaje por nombre...";
    } else if (newTab === "episodes") {
      els.query.placeholder = "Buscar episodio por nombre (o código S01E01)...";
    } else if (newTab === "locations") {
      els.query.placeholder = "Buscar localización por nombre...";
    } else {
      els.query.placeholder = "Buscar en favoritos...";
    }

    // Render inmediato si favoritos
    if (newTab === "favorites") {
      renderFavorites();
      updatePaginationButtons();
      setMeta({ countText: "Favoritos", pageText: "—" });
      return;
    }

    fetchAndRender({ replace: true });
  }

  function buildEndpoint() {
    let q = state.query.trim();
    let p = clamp(state.page, 1, 10_000);

    if (state.tab === "characters") {
      let params = new URLSearchParams();
      if (q) params.set("name", q);
      if (state.status) params.set("status", state.status);
      if (state.species.trim()) params.set("species", state.species.trim());
      params.set("page", String(p));
      return `${API}/character/?${params.toString()}`;
    }

    if (state.tab === "episodes") {
      let params = new URLSearchParams();
      if (q) {
        // Si meten S01E01, lo dejamos como name igualmente (la API tiene filtro por "episode" también, pero sin liarnos)
        params.set("name", q);
      }
      params.set("page", String(p));
      return `${API}/episode/?${params.toString()}`;
    }

    if (state.tab === "locations") {
      let params = new URLSearchParams();
      if (q) params.set("name", q);
      params.set("page", String(p));
      return `${API}/location/?${params.toString()}`;
    }

    return "";
  }

  async function fetchAndRender({ replace }) {
    setLoading(true);
    setError(null);

    try {
      let url = buildEndpoint();
      let data = await apiGet(url);

      state.info = data.info || null;
      let results = Array.isArray(data.results) ? data.results : [];
      if (replace) state.items = results;
      else state.items = state.items.concat(results);

      renderGrid();
      updatePaginationButtons();

      let count = state.info?.count ?? state.items.length;
      let pages = state.info?.pages ?? "?";
      setMeta({
        countText: `${count} resultados`,
        pageText: `Página ${state.page} / ${pages}`,
      });
    } catch (err) {
      // 404 => no results
      if (err?.status === 404) {
        state.info = { count: 0, pages: 0, next: null, prev: null };
        state.items = [];
        renderGrid();
        updatePaginationButtons();
        setMeta({ countText: "0 resultados", pageText: "—" });
        setError("No hay resultados con esos filtros/búsqueda.");
      } else {
        setError("Error al consumir la API (red/endpoint). Revisa tu conexión o inténtalo de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  function updatePaginationButtons() {
    let hasPrev = !!state.info?.prev;
    let hasNext = !!state.info?.next;

    els.btnPrev.disabled = state.tab === "favorites" || !hasPrev;
    els.btnNext.disabled = state.tab === "favorites" || !hasNext;

    // "Cargar más" solo cuando hay next y no estamos en favoritos
    els.btnLoadMore.disabled = state.tab === "favorites" || !hasNext;
    els.btnLoadMore.style.display = state.tab === "favorites" ? "none" : "";
  }

  function renderGrid() {
    const list = state.items;

    if (!list.length) {
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

    if (state.tab === "characters") {
      els.grid.innerHTML = list.map(renderCharacterCard).join("");
      wireCardEvents("characters");
      return;
    }

    if (state.tab === "episodes") {
      els.grid.innerHTML = list.map(renderEpisodeCard).join("");
      wireCardEvents("episodes");
      return;
    }

    if (state.tab === "locations") {
      els.grid.innerHTML = list.map(renderLocationCard).join("");
      wireCardEvents("locations");
      return;
    }
  }

  function favIconHtml(active) {
    return active ? "★" : "☆";
  }

  function renderCharacterCard(c) {
    let fav = isFav("characters", c.id);
    let status = safeText(c.status);
    let species = safeText(c.species);
    let gender = safeText(c.gender);

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

function renderEpisodeCard(e) {
  let fav = isFav("episodes", e.id);
  let cover = coverFromRefs(e.characters);

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

function renderLocationCard(l) {
  let fav = isFav("locations", l.id);
  let cover = coverFromRefs(l.residents);

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

  function wireCardEvents(type) {
    let cards = $$(`.rme-card[data-rme-type="${type}"]`, els.grid);

    cards.forEach((card) => {
      let id = Number(card.dataset.rmeId);

      let btnOpen = $(`[data-rme-action="open"]`, card);
      let btnFav = $(`[data-rme-action="fav"]`, card);

      btnOpen.addEventListener("click", () => openDetail(type, id));

      btnFav.addEventListener("click", () => {
        let added = toggleFav(type, id);
        btnFav.textContent = favIconHtml(added);
        // si estás en favoritos, re-render para reflejar cambios
        if (state.tab === "favorites") renderFavorites();
      });
    });
  }

  function openDrawer(title, html) {
    els.drawerTitle.textContent = title;
    els.drawerContent.innerHTML = html;

    els.drawer.classList.remove("rme-hidden");
    els.drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    els.drawer.classList.add("rme-hidden");
    els.drawer.setAttribute("aria-hidden", "true");
    els.drawerContent.innerHTML = "";
    document.body.style.overflow = "";
  }

  async function openDetail(type, id) {
    setError(null);
    setLoading(true);

    try {
      if (type === "characters") {
        let c = await apiGet(`${API}/character/${id}`);

        let eps = Array.isArray(c.episode) ? c.episode.slice(0, 8) : [];
        let epsHtml =
          eps.length === 0
            ? `<div class="rme-detail__v">—</div>`
            : `<div class="rme-list">
                ${eps
                  .map((u) => {
                    let eid = Number(String(u).split("/").pop());
                    return `<button class="rme-linkbtn" type="button" data-rme-link="episode" data-rme-id="${eid}">
                      Episodio #${eid}
                    </button>`;
                  })
                  .join("")}
              </div>`;

        let fav = isFav("characters", c.id);

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

        // enlaces episodios
        $$("[data-rme-link='episode']", els.drawerContent).forEach((btn) => {
          btn.addEventListener("click", () => openDetail("episodes", Number(btn.dataset.rmeId)));
        });

        // toggle fav desde drawer
        let favBtn = $("[data-rme-drawer-fav]", els.drawerContent);
        if (favBtn) {
          favBtn.addEventListener("click", () => {
            let added = toggleFav("characters", c.id);
            favBtn.textContent = added ? "Quitar de favoritos" : "Añadir a favoritos";
            // refrescar icono en card si está en pantalla
            renderIfNotFavoritesTab();
          });
        }

        return;
      }

      if (type === "episodes") {
        let e = await apiGet(`${API}/episode/${id}`);
        let fav = isFav("episodes", e.id);
        let chars = Array.isArray(e.characters) ? e.characters.slice(0, 12) : [];
        let charsHtml =
          chars.length === 0
            ? `<div class="rme-detail__v">—</div>`
            : `<div class="rme-list">
                ${chars
                  .map((u) => {
                    let cid = Number(String(u).split("/").pop());
                    return `<button class="rme-linkbtn" type="button" data-rme-link="character" data-rme-id="${cid}">
                      Personaje #${cid}
                    </button>`;
                  })
                  .join("")}
              </div>`;

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

        $$("[data-rme-link='character']", els.drawerContent).forEach((btn) => {
          btn.addEventListener("click", () => openDetail("characters", Number(btn.dataset.rmeId)));
        });

        let favBtn = $("[data-rme-drawer-fav]", els.drawerContent);
        if (favBtn) {
          favBtn.addEventListener("click", () => {
            let added = toggleFav("episodes", e.id);
            favBtn.textContent = added ? "Quitar de favoritos" : "Añadir a favoritos";
            renderIfNotFavoritesTab();
          });
        }

        return;
      }

      if (type === "locations") {
        let l = await apiGet(`${API}/location/${id}`);
        let fav = isFav("locations", l.id);
        let residents = Array.isArray(l.residents) ? l.residents.slice(0, 12) : [];
        let resHtml =
          residents.length === 0
            ? `<div class="rme-detail__v">—</div>`
            : `<div class="rme-list">
                ${residents
                  .map((u) => {
                    let cid = Number(String(u).split("/").pop());
                    return `<button class="rme-linkbtn" type="button" data-rme-link="character" data-rme-id="${cid}">
                      Residente #${cid}
                    </button>`;
                  })
                  .join("")}
              </div>`;

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

        $$("[data-rme-link='character']", els.drawerContent).forEach((btn) => {
          btn.addEventListener("click", () => openDetail("characters", Number(btn.dataset.rmeId)));
        });

        let favBtn = $("[data-rme-drawer-fav]", els.drawerContent);
        if (favBtn) {
          favBtn.addEventListener("click", () => {
            let added = toggleFav("locations", l.id);
            favBtn.textContent = added ? "Quitar de favoritos" : "Añadir a favoritos";
            renderIfNotFavoritesTab();
          });
        }

        return;
      }
    } catch (e) {
      setError("No se pudo cargar el detalle (error de red o endpoint).");
    } finally {
      setLoading(false);
    }
  }

  function renderIfNotFavoritesTab() {
    // Si estás en un listado normal, re-render para que el icono de favorito se actualice.
    if (state.tab !== "favorites") {
      renderGrid();
    } else {
      renderFavorites();
    }
  }

  async function renderFavorites() {
    setError(null);
    setLoading(true);

    let favs = readFavs();
    let q = state.query.trim().toLowerCase();

    try {
      // Cargamos por IDs (batch simple). Si no hay, mostramos tarjeta.
      let chunks = [];
      let charIds = favs.characters.slice().sort((a, b) => a - b);
      let epiIds = favs.episodes.slice().sort((a, b) => a - b);
      let locIds = favs.locations.slice().sort((a, b) => a - b);
      let [chars, epis, locs] = await Promise.all([
        charIds.length ? apiGet(`${API}/character/${charIds.join(",")}`) : [],
        epiIds.length ? apiGet(`${API}/episode/${epiIds.join(",")}`) : [],
        locIds.length ? apiGet(`${API}/location/${locIds.join(",")}`) : [],
      ]);

      let normArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
      let all = [
        ...normArr(chars).map((x) => ({ type: "characters", data: x })),
        ...normArr(epis).map((x) => ({ type: "episodes", data: x })),
        ...normArr(locs).map((x) => ({ type: "locations", data: x })),
      ];

      let filtered = q
        ? all.filter((item) => safeText(item.data.name).toLowerCase().includes(q))
        : all;

      if (!filtered.length) {
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

      // Render combinado (orden por tipo y nombre)
      filtered.sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return safeText(a.data.name).localeCompare(safeText(b.data.name));
      });

      els.grid.innerHTML = filtered
        .map((it) => {
          if (it.type === "characters") return renderCharacterCard(it.data);
          if (it.type === "episodes") return renderEpisodeCard(it.data);
          return renderLocationCard(it.data);
        })
        .join("");

      // wire en conjunto
      wireCardEvents("characters");
      wireCardEvents("episodes");
      wireCardEvents("locations");
    } catch (e) {
      // Si hay IDs inválidos o la API falla, limpiamos error suave
      setError("No se pudieron cargar los favoritos (posible error de red).");
    } finally {
      setLoading(false);
    }
  }

  els.tabs.forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.rmeTab));
  });

  els.form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    state.query = els.query.value;
    state.status = els.status.value;
    state.species = els.species.value;
    state.page = 1;
    state.loadMoreMode = false;

    if (state.tab === "favorites") {
      renderFavorites();
      return;
    }
    fetchAndRender({ replace: true });
  });

  els.btnReset.addEventListener("click", () => {
    els.query.value = "";
    els.status.value = "";
    els.species.value = "";
    state.query = "";
    state.status = "";
    state.species = "";
    state.page = 1;
    state.loadMoreMode = false;
    setError(null);

    if (state.tab === "favorites") {
      renderFavorites();
      return;
    }
    fetchAndRender({ replace: true });
  });

  // búsqueda rápida al teclear (solo si quieres: aquí sí, con debounce)
    let onTyping = debounce(() => {
    state.query = els.query.value;
    state.page = 1;
    state.loadMoreMode = false;

    if (state.tab === "favorites") {
      renderFavorites();
      return;
    }
    fetchAndRender({ replace: true });
  }, 450);

  els.query.addEventListener("input", onTyping);

  els.btnPrev.addEventListener("click", () => {
    if (!state.info?.prev) return;
    state.page = Math.max(1, state.page - 1);
    state.loadMoreMode = false;
    fetchAndRender({ replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.btnNext.addEventListener("click", () => {
    if (!state.info?.next) return;
    state.page += 1;
    state.loadMoreMode = false;
    fetchAndRender({ replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.btnLoadMore.addEventListener("click", () => {
    if (!state.info?.next) return;
    state.page += 1;
    state.loadMoreMode = true;
    fetchAndRender({ replace: false });
  });

  // Drawer close
  els.drawerClose.addEventListener("click", closeDrawer);
  els.drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.drawer.classList.contains("rme-hidden")) closeDrawer();
  });

  setTab("characters");
})();