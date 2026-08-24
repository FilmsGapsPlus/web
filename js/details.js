document.addEventListener("DOMContentLoaded", () => {
    // ============================================================
    // Configuración
    // ============================================================
    const apiBaseUrl = "https://anusdbs.onrender.com"
    const CONTENT_INDEX_KEY = "fgp_content_index_v1"
    const CACHE_PREFIX = "filmsgapsplus_"

    // ============================================================
    // Elementos del DOM
    // ============================================================
    const detailSkeleton = document.getElementById("detail-skeleton")
    const detailHero = document.getElementById("detail-hero")
    const detailHeroBg = document.getElementById("detail-hero-bg")
    const detailBackdrop = document.getElementById("detail-backdrop")
    const detailPoster = document.getElementById("detail-poster")
    const detailTypeBadge = document.getElementById("detail-type-badge")
    const detailTitle = document.getElementById("detail-title")
    const metaChips = document.getElementById("meta-chips")
    const heroOverview = document.getElementById("hero-overview")
    const detailPlayBtn = document.getElementById("detail-play-btn")
    const shareBtn = document.getElementById("share-btn")
    const detailBody = document.getElementById("detail-body")
    const detailError = document.getElementById("detail-error")
    const retryBtn = document.getElementById("retry-detail-btn")

    // ============================================================
    // Estado
    // ============================================================
    const params = new URLSearchParams(location.search)
    // Formato compacto nuevo (?t=m|s&id=~...) con compatibilidad al viejo (?type=movies|series&id=...)
    const FGPUrl = window.FGPUrl || {
        typeFromShort: () => null,
        decompressId: v => v,
        buildDetailUrl: (t, id) => `details.html?type=${t}&id=${encodeURIComponent(id)}`
    }
    const shortType = params.get("t")
    const longType = params.get("type")
    let contentType = FGPUrl.typeFromShort(shortType) ||
        (longType === "series" ? "series" : longType === "movies" ? "movies" : null) || "movies"
    let contentId = FGPUrl.decompressId(params.get("id"))
    // Reanudar: ?sn=<temporada>&ep=<episodio> (índices base 0)
    const resumeSeasonIdx = parseInt(params.get("sn"), 10)
    const resumeEpIdx = parseInt(params.get("ep"), 10)
    const hasResume = Number.isInteger(resumeSeasonIdx) && Number.isInteger(resumeEpIdx)
    let currentData = null
    let renderedOnce = false
    let renderSerial = 0
    let detailInitDone = false
    // Flag a nivel window: sobrevive a múltiples invocaciones del handler
    if (typeof window.__fgpDetailInit !== "undefined") {
        detailInitDone = window.__fgpDetailInit
    }

    if (!contentId) {
        showError()
        return
    }

    retryBtn.addEventListener("click", () => {
        detailInitDone = false
        window.__fgpDetailInit = false
        init()
    })

    // Volver: history.back() sin recargar el index; si no hay historial, carga el index
    document.getElementById("back-btn").addEventListener("click", e => {
        e.preventDefault()
        if (window.history && window.history.length > 1) {
            window.history.back()
            // Respaldo por si back() no llega a descargar la página
            setTimeout(() => { window.location.href = "index.html" }, 900)
        } else {
            window.location.href = "index.html"
        }
    })

    // ============================================================
    // Utilidades compartidas con main.js
    // ============================================================
    function loadContentIndex() {
        try {
            return JSON.parse(localStorage.getItem(CONTENT_INDEX_KEY)) || {}
        } catch (error) {
            return {}
        }
    }

    function stableRating(seedStr) {
        let h = 0
        const s = String(seedStr || "")
        for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
        return (6.9 + Math.abs(h % 24) / 10).toFixed(1)
    }

    function parseGenres(content) {
        if (!content.generos) return []
        return typeof content.generos === "string" ? content.generos.split(" - ") : content.generos
    }

    function rememberItems(type, items) {
        if (!Array.isArray(items) || items.length === 0) return
        try {
            const index = loadContentIndex()
            const bucket = index[type] || (index[type] = {})
            items.forEach(item => {
                const id = item.id || item._id
                if (id) bucket[id] = item
            })
            localStorage.setItem(CONTENT_INDEX_KEY, JSON.stringify(index))
        } catch (error) { /* cuota llena */ }
    }

    function serverIcon(nombre) {
        const n = String(nombre || "").toLowerCase()
        if (n.includes("mega")) return "fas fa-cloud-download-alt"
        if (n.includes("google")) return "fab fa-google-drive"
        if (n.includes("fembed") || n.includes("hyper") || n.includes("stream")) return "fas fa-play-circle"
        if (n.includes("ok.ru")) return "fas fa-video"
        return "fas fa-server"
    }

    function languageIcon(idioma) {
        const l = String(idioma || "").toLowerCase()
        if (l.includes("subtitulado")) return "fas fa-closed-captioning"
        if (l.includes("español") || l.includes("latino")) return "fas fa-language"
        return "fas fa-globe"
    }

    // Texto expandible "Ver más": solo en pantallas estrechas (móvil/Android
    // o ventana de navegador angosta), donde las líneas se alargan.
    // Recorta a N líneas y añade el botón únicamente si el texto desborda.
    function isMobileViewport() {
        try {
            return window.matchMedia("(max-width: 1024px)").matches
        } catch (e) {
            return false
        }
    }

    function attachVerMas(paragraph, maxLines, opts = {}) {
        if (!paragraph || !paragraph.textContent) return
        // opts.always: mostrar en cualquier viewport (p. ej. descripciones de
        // episodios); sin él, solo en pantallas estrechas (hero de detalles)
        if (!opts.always && !isMobileViewport()) return
        paragraph.classList.add("clampable")
        paragraph.style.setProperty("--clamp-lines", String(maxLines))
        requestAnimationFrame(() => {
            if (paragraph.classList.contains("expanded")) return
            if (paragraph.scrollHeight <= paragraph.clientHeight + 2) {
                paragraph.classList.remove("clampable")
                return
            }
            if (paragraph.nextElementSibling && paragraph.nextElementSibling.classList.contains("ver-mas-btn")) return
            const btn = document.createElement("button")
            btn.className = "ver-mas-btn"
            btn.type = "button"
            btn.innerHTML = `Ver más <i class="fas fa-chevron-down"></i>`
            btn.addEventListener("click", e => {
                e.stopPropagation()
                const open = paragraph.classList.toggle("expanded")
                btn.innerHTML = open
                    ? `Ver menos <i class="fas fa-chevron-up"></i>`
                    : `Ver más <i class="fas fa-chevron-down"></i>`
            })
            paragraph.insertAdjacentElement("afterend", btn)
        })
    }

    // ============================================================
    // Inicialización: caché primero, luego API fresca
    // ============================================================
    async function init() {
        if (detailInitDone) return
        detailInitDone = true
        window.__fgpDetailInit = true

        detailError.style.display = "none"
        detailSkeleton.style.display = "block"
        detailHero.style.display = "none"
        detailBody.style.display = "none"

        // 1) Hidratación instantánea desde el índice local
        const cachedItem = loadContentIndex()[contentType]?.[contentId]
        if (cachedItem) {
            currentData = cachedItem
            renderAll(cachedItem, true)
            renderedOnce = true
        }

        // 2) Datos frescos desde la API
        try {
            const endpoint = contentType === "movies" ? "movies" : "series"
            const response = await fetch(`${apiBaseUrl}/api/${endpoint}/${encodeURIComponent(contentId)}`)
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const payload = await response.json()

            if (payload.success && payload.data) {
                const item = Array.isArray(payload.data) ? payload.data[0] : payload.data
                if (item) {
                    currentData = item
                    item.id = item.id || item._id || contentId
                    rememberItems(contentType, [item])
                    renderAll(item, false)
                    renderedOnce = true
                    // El segundo render reconstruyó las pestañas de temporadas:
                    // devolver al usuario a su temporada si ya se había posicionado
                    restoreResumeTabSilently()
                }
            } else if (!renderedOnce) {
                showError()
                return
            }
        } catch (error) {
            if (!renderedOnce) {
                showError()
                return
            }
            // Ya se está mostrando la versión cacheada; continuar en silencio
        }

        loadSimilarContent(currentData)
    }

    function showError() {
        detailSkeleton.style.display = "none"
        detailHero.style.display = "none"
        detailBody.style.display = "none"
        detailError.style.display = "block"
    }

    // ============================================================
    // Render principal
    // ============================================================
    function renderAll(item, fromCache) {
        renderSerial++
        const title = item.titulo || "Sin título"
        document.title = `${title} | FilmsGapsPlus`

        const backdropSrc = item.miniature || item.post
        detailHeroBg.style.backgroundImage = `url("${backdropSrc}")`
        detailBackdrop.src = backdropSrc
        detailPoster.src = item.post || item.miniature
        detailPoster.alt = `Póster de ${title}`

        const isMovie = contentType === "movies"
        detailTypeBadge.innerHTML = `<i class="fas ${isMovie ? "fa-film" : "fa-tv"}"></i> ${isMovie ? "Película" : "Serie"}`

        detailTitle.textContent = title

        // Chips de metadatos
        metaChips.innerHTML = ""
        addChip(`<i class="far fa-calendar-alt"></i> ${item.ano || "Año desconocido"}`)
        if (item.duracion) addChip(`<i class="far fa-clock"></i> ${item.duracion}`)
        addChip(`<span class="chip-star"><i class="fas fa-star" style="color:#f59e0b;"></i> ${stableRating(item.id || contentId)}</span>`, "chip-accent")

        const genres = parseGenres(item)
        genres.slice(0, 4).forEach(genre => {
            addChip(`<i class="fas fa-tag"></i> ${genre.trim()}`)
        })

        heroOverview.textContent = item.descripcion || ""
        heroOverview.style.display = item.descripcion ? "block" : "none"
        attachVerMas(heroOverview, 3)

        // Botón reproducir: primer servidor disponible (películas)
        updatePlayButton(item)
        updateResumeButton(item)
        updateMetaTags(item)

        shareBtn.onclick = () => shareContent(title)

        renderBodySections(item)
        detailSkeleton.style.display = "none"
        detailHero.style.display = "flex"
        detailBody.style.display = "block"

        // Reanudar en la temporada/episodio dejado por el usuario (?sn=&ep=)
        scheduleResume()
    }

    // La página se pinta primero desde caché y después llega la versión fresca
    // de la API (segundo render). Posicionar en cada render provocaba el
    // efecto de "doble carga": saltaba a T1·E1 y volvía a saltar. Esperamos
    // un instante y aplicamos la posición UNA sola vez, sobre el DOM final.
    let resumeScheduled = false
    let resumeApplied = false
    let resumeAppliedRender = -1
    function scheduleResume() {
        if (!hasResume || contentType !== "series" || resumeScheduled) return
        resumeScheduled = true
        setTimeout(() => {
            if (resumeApplied || !currentData) return
            resumeApplied = true
            resumeAppliedRender = renderSerial
            goToResumePosition(resumeSeasonIdx, resumeEpIdx)
        }, 350)
    }

    // Si los datos frescos llegaron DESPUÉS de aplicar la posición, el segundo
    // render reconstruyó TODO el DOM: repetimos el posicionamiento completo
    // (pestaña + scroll al episodio + resaltado) sobre el DOM definitivo
    function restoreResumeTabSilently() {
        if (!hasResume || contentType !== "series" || !resumeApplied) return
        if (renderSerial === resumeAppliedRender) return
        resumeAppliedRender = renderSerial
        goToResumePosition(resumeSeasonIdx, resumeEpIdx)
    }

    // Lleva al usuario a la posición exacta: activa la pestaña de la temporada,
    // desplaza hasta el episodio y lo resalta unos segundos. Con openModal,
    // además abre el modal de servidores tras el desplazamiento.
    function goToResumePosition(seasonIdx, epIdx, opts = {}) {
        if (!currentData || !Array.isArray(currentData.temporadas)) return null
        const season = currentData.temporadas[seasonIdx]
        const episode = season && Array.isArray(season.episodios) ? season.episodios[epIdx] : null
        if (!episode) return null

        const tabs = detailBody.querySelectorAll(".pill-tab")
        if (tabs[seasonIdx]) tabs[seasonIdx].click()

        const panel = detailBody.querySelector(`.season-content[data-season="${seasonIdx}"]`)
        const card = panel ? panel.querySelectorAll(".episode-item")[epIdx] : null

        const openModalFn = () => openEpisodeServersModal(episode, {
            serie: currentData,
            seasonIdx,
            epIdx
        })

        if (!card) {
            if (opts.openModal) openModalFn()
            return card
        }
        requestAnimationFrame(() => {
            // Scroll DIRECTO al episodio y resaltado por unos segundos
            card.scrollIntoView({ behavior: "smooth", block: "center" })
            card.classList.add("ep-highlight")
            setTimeout(() => card.classList.remove("ep-highlight"), 3200)
        })
        if (opts.openModal) setTimeout(openModalFn, 750)
        return card
    }

    // Botón "Continuar viendo": visible solo si hay progreso guardado de esta
    // serie; lleva a la posición sin abrir el modal
    function updateResumeButton(item) {
        const btn = document.getElementById("resume-btn")
        if (!btn) return
        btn.style.display = "none"
        if (contentType !== "series" || !window.FGPHistory) return
        const serieId = item.id || item._id
        const entry = window.FGPHistory.listAll().find(e => e && e.type === "series" && e.id === serieId)
        if (!entry || entry.seasonIdx === undefined || entry.epIdx === undefined) return
        btn.style.display = "inline-flex"
        btn.innerHTML = `<i class="fas fa-rotate-right"></i> Continuar viendo`
        btn.onclick = () => goToResumePosition(entry.seasonIdx, entry.epIdx)
    }

    function addChip(html, extraClass = "") {
        const chip = document.createElement("span")
        chip.className = `chip ${extraClass}`
        chip.innerHTML = html
        metaChips.appendChild(chip)
    }

    function updatePlayButton(item) {
        const serversBtn = document.getElementById("servers-btn")
        const firstServer = contentType === "movies" && Array.isArray(item.servidores) && item.servidores[0]
        if (firstServer && firstServer.url) {
            detailPlayBtn.style.display = "inline-flex"
            detailPlayBtn.innerHTML = `<i class="fas fa-play"></i> Reproducir · ${firstServer.nombre}`
            detailPlayBtn.onclick = () => {
                recordMovieView(item)
                window.open(firstServer.url, "_blank", "noopener")
            }
            // Igual que en las series: botón bajo "Reproducir" que abre el
            // modal de opciones de reproducción con todos los servidores
            if (serversBtn) {
                serversBtn.style.display = "inline-flex"
                serversBtn.onclick = () => openMovieServersModal(item)
            }
        } else if (contentType === "series") {
            detailPlayBtn.style.display = "inline-flex"
            detailPlayBtn.innerHTML = `<i class="fas fa-layer-group"></i> Ver episodios`
            detailPlayBtn.onclick = () => {
                detailBody.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            if (serversBtn) serversBtn.style.display = "none"
        } else {
            detailPlayBtn.style.display = "none"
            if (serversBtn) serversBtn.style.display = "none"
        }
    }

    // ------------------------------------------------------------
    // Historial de vistas (compartido con el index vía js/history.js)
    // ------------------------------------------------------------
    function recordMovieView(movie) {
        if (!window.FGPHistory || !movie) return
        window.FGPHistory.add({
            type: "movies",
            id: movie.id || movie._id,
            titulo: movie.titulo,
            post: movie.post,
            miniature: movie.miniature
        })
    }

    function recordSeriesView(serie, seasonIdx, epIdx, episode) {
        if (!window.FGPHistory || !serie) return
        const serieId = serie.id || serie._id
        window.FGPHistory.add({
            type: "series",
            id: serieId,
            titulo: serie.titulo,
            post: serie.post,
            miniature: (episode && (episode.miniatura || episode.imagen)) || serie.miniature,
            seasonIdx: seasonIdx,
            epIdx: epIdx,
            epTitle: episode ? episode.titulo : undefined,
            epNumero: episode && episode.numero_completo ? episode.numero_completo : undefined
        })
        if (episode && episode.numero_completo) {
            window.FGPHistory.markEpisodeSeen(serieId, episode.numero_completo)
        }
    }

    // Marca en el DOM la tarjeta del episodio como vista (barra roja + ojo)
    function markEpisodeCardWatched(epNumero) {
        if (!epNumero) return
        detailBody.querySelectorAll(".episode-item").forEach(card => {
            if (card.dataset.epNumero === epNumero) card.classList.add("watched")
        })
    }

    function shareContent(title) {
        // Enlace compacto: t=m|s e id comprimido (base64url del texto original)
        const compactUrl = compactShareUrl()
        const shareData = {
            title: `${title} | FilmsGapsPlus`,
            text: `Mira "${title}" en FilmsGapsPlus`,
            url: compactUrl
        }
        if (navigator.share) {
            navigator.share(shareData).catch(() => {})
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(compactUrl).then(() => {
                const original = shareBtn.innerHTML
                shareBtn.innerHTML = `<i class="fas fa-check"></i> Enlace copiado`
                setTimeout(() => { shareBtn.innerHTML = original }, 2000)
            })
        }
    }

    function compactShareUrl() {
        return location.origin + location.pathname.replace(/[^/]*$/, "") +
            window.FGPUrl.buildDetailUrl(contentType, contentId)
    }

    // ------------------------------------------------------------
    // Meta dinámico (title, description, OG, Twitter) con los datos de la
    // película/serie para que al compartir se muestre su información
    // ------------------------------------------------------------
    function setMeta(attrType, key, value) {
        if (!value) return
        let el = document.head.querySelector(`meta[${attrType}="${key}"]`)
        if (!el) {
            el = document.createElement("meta")
            el.setAttribute(attrType, key)
            document.head.appendChild(el)
        }
        el.setAttribute("content", value)
    }

    function absoluteUrl(path) {
        if (!path) return ""
        if (/^https?:\/\//i.test(path)) return path
        return location.origin + location.pathname.replace(/[^/]*$/, "") + path.replace(/^\/+/, "")
    }

    function updateMetaTags(item) {
        try {
            const title = `${item.titulo} | FilmsGapsPlus`
            const desc = String(item.descripcion || "").trim().slice(0, 200) ||
                `Mira "${item.titulo}" en FilmsGapsPlus: películas y series online sin anuncios.`
            const img = absoluteUrl(item.post || item.miniature) || absoluteUrl("img/icon_filmsgapsplus.png")
            const url = compactShareUrl()

            document.title = title
            setMeta("name", "description", desc)
            setMeta("property", "og:title", title)
            setMeta("property", "og:description", desc)
            setMeta("property", "og:image", img)
            setMeta("property", "og:url", url)
            setMeta("property", "og:type", contentType === "movies" ? "video.movie" : "video.tv_show")
            setMeta("name", "twitter:card", "summary_large_image")
            setMeta("name", "twitter:title", title)
            setMeta("name", "twitter:description", desc)
            setMeta("name", "twitter:image", img)
        } catch (e) { /* los meta nunca deben romper el render */ }
    }

    // ============================================================
    // Secciones del cuerpo
    // ============================================================
    function sectionTemplate(icon, title) {
        const section = document.createElement("section")
        section.className = "detail-section"
        section.innerHTML = `<h2 class="detail-section-title"><i class="${icon}"></i> ${title}</h2>`
        return section
    }

    function renderBodySections(item) {
        detailBody.innerHTML = ""

        // Reparto — tarjetas verticales en fila horizontal
        if (Array.isArray(item.actores) && item.actores.length > 0) {
            const castSection = sectionTemplate("fas fa-users", "Reparto")
            const castList = document.createElement("div")
            castList.className = "cast-list"
            item.actores.slice(0, 12).forEach(actor => {
                const card = document.createElement("div")
                card.className = "cast-card"
                card.dataset.actor = actor
                card.innerHTML = `
                    <div class="cast-photo-wrap">
                        <img class="cast-photo" alt="" hidden width="200" height="300">
                        <i class="fas fa-user-alt cast-photo-fallback"></i>
                    </div>
                    <span class="cast-name">${actor}</span>`
                castList.appendChild(card)
            })
            if (item.actores.length > 12) {
                const more = document.createElement("div")
                more.className = "cast-card cast-card-more"
                more.innerHTML = `
                    <div class="cast-photo-wrap"><i class="fas fa-users"></i></div>
                    <span class="cast-name">+${item.actores.length - 12} más</span>`
                castList.appendChild(more)
            }
            castSection.appendChild(castList)
            detailBody.appendChild(castSection)
            hydrateCastPhotos()
        }

        if (contentType === "movies") {
            // Los servidores ya no se listan abajo: se abren en el modal
            // desde el botón "Opciones de reproducción" del hero
        } else {
            renderSeasonsSection(item)
        }
    }

    // ------------------------------------------------------------
    // Fotos del reparto: API REST de Wikipedia (pública, sin registro
    // ni apikey, CORS abierto). TMDB/IMDb exigen clave → descartados.
    // Caché local 30 días por nombre; si no hay foto, queda el icono.
    // ------------------------------------------------------------
    const ACTOR_TTL_MS = 30 * 24 * 60 * 60 * 1000

    function actorCacheKey(name) {
        return CACHE_PREFIX + "actor_" + String(name).trim().toLowerCase()
    }

    async function fetchActorPhoto(name) {
        const key = actorCacheKey(name)
        try {
            const raw = localStorage.getItem(key)
            if (raw) {
                const { thumb, ts } = JSON.parse(raw)
                if (thumb && Date.now() - ts < ACTOR_TTL_MS) return thumb
            }
        } catch (e) { /* sin caché */ }

        for (const lang of ["es", "en"]) {
            try {
                const controller = new AbortController()
                const timer = setTimeout(() => controller.abort(), 6000)
                const res = await fetch(
                    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(String(name).trim())}?redirect=true`,
                    { signal: controller.signal }
                )
                clearTimeout(timer)
                if (!res.ok) continue
                const data = await res.json()
                const src = data && data.thumbnail && data.thumbnail.source
                if (src && data.type !== "disambiguation") {
                    try { localStorage.setItem(key, JSON.stringify({ thumb: src, ts: Date.now() })) } catch (e) { /* cuota */ }
                    return src
                }
            } catch (e) { /* siguiente idioma */ }
        }
        return null
    }

    function hydrateCastPhotos() {
        detailBody.querySelectorAll(".cast-card[data-actor]").forEach(async card => {
            const name = card.dataset.actor
            if (!name || card.dataset.actorDone) return
            card.dataset.actorDone = "1"
            const photo = await fetchActorPhoto(name)
            if (!photo) return
            // El DOM pudo re-renderizarse mientras llegaba la respuesta
            const img = card.querySelector(".cast-photo")
            if (!img) return
            // Solo se muestra si la imagen carga de verdad; si falla queda el icono.
            // Importante: SIN loading="lazy" — una img display:none con lazy nunca
            // dispara onload en Chromium y la foto quedaría en icono para siempre
            img.onload = () => {
                img.hidden = false
                const fallback = card.querySelector(".cast-photo-fallback")
                if (fallback) fallback.style.display = "none"
            }
            img.onerror = () => {
                img.hidden = true
                img.removeAttribute("src")
                const fallback = card.querySelector(".cast-photo-fallback")
                if (fallback) fallback.style.display = ""
            }
            img.src = photo
        })
    }

    // ------------------------------------------------------------
    // (Películas) El listado de servidores vive ahora en un modal,
    // idéntico al de episodios, abierto desde el botón del hero.
    // ------------------------------------------------------------
    function openMovieServersModal(movie) {
        closeMovieServersModal()

        const servers = Array.isArray(movie.servidores) ? movie.servidores : []

        const overlay = document.createElement("div")
        overlay.className = "modal open"
        overlay.id = "movie-servers-modal"
        overlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h2 class="modal-title"><i class="fas fa-play-circle"></i> Opciones de reproducción</h2>
                        <p class="modal-subtitle">${movie.titulo || ""}</p>
                    </div>
                    <button class="modal-close" id="movie-servers-close" aria-label="Cerrar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body"></div>
            </div>`

        const body = overlay.querySelector(".modal-body")
        if (servers.length === 0) {
            body.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No hay servidores disponibles para esta película por el momento.</p>`
        } else {
            body.appendChild(buildServerGroups(servers, () => recordMovieView(movie)))
        }

        document.body.appendChild(overlay)
        document.body.style.overflow = "hidden"

        overlay.querySelector("#movie-servers-close").addEventListener("click", closeMovieServersModal)
        overlay.addEventListener("click", e => { if (e.target === overlay) closeMovieServersModal() })
        document.addEventListener("keydown", escHandler)
    }

    function closeMovieServersModal() {
        const existing = document.getElementById("movie-servers-modal")
        if (existing) existing.remove()
        document.body.style.overflow = ""
        document.removeEventListener("keydown", escHandler)
    }

    function buildServerOptions(servers, title, onWatch) {
        const wrap = document.createElement("div")
        servers.forEach(server => {
            const option = document.createElement("div")
            option.className = "server-option"
            option.innerHTML = `
                <div class="server-info">
                    <span class="server-name"><i class="${serverIcon(server.nombre)}"></i> ${server.nombre}</span>
                    <div class="server-meta">
                        ${server.calidad ? `<span><i class="fas fa-video"></i> ${server.calidad}</span>` : ""}
                        ${server.idioma ? `<span><i class="fas fa-closed-captioning"></i> ${server.idioma}</span>` : ""}
                        ${server.tipo ? `<span><i class="fas fa-file-video"></i> ${server.tipo}</span>` : ""}
                    </div>
                </div>
                <a class="watch-btn" href="${server.url}" target="_blank" rel="noopener">
                    <i class="fas fa-play"></i> Ver ahora
                </a>`
            if (onWatch) {
                option.querySelector(".watch-btn").addEventListener("click", () => onWatch())
            }
            wrap.appendChild(option)
        })
        return wrap
    }

    // ------------------------------------------------------------
    // Temporadas y episodios (series)
    // ------------------------------------------------------------
    function renderSeasonsSection(serie) {
        const sectionTitle = contentType === "series" ? "Temporadas y episodios" : "Temporadas"
        if (!Array.isArray(serie.temporadas) || serie.temporadas.length === 0) {
            const empty = sectionTemplate("fas fa-layer-group", sectionTitle)
            empty.insertAdjacentHTML(
                "beforeend",
                `<p style="color: var(--text-muted);">No hay temporadas disponibles para esta serie por el momento.</p>`
            )
            detailBody.appendChild(empty)
            return
        }

        const section = sectionTemplate("fas fa-layer-group", sectionTitle)
        const pillTabs = document.createElement("div")
        pillTabs.className = "pill-tabs"
        const contentsWrap = document.createElement("div")

        serie.temporadas.forEach((season, idx) => {
            const tab = document.createElement("button")
            tab.className = `pill-tab ${idx === 0 ? "active" : ""}`
            const epCount = season.episodios ? season.episodios.length : 0
            tab.innerHTML = `<i class="fas fa-layer-group"></i> ${season.titulo || `Temporada ${season.numero}`} 
                <span style="opacity:.65;">· ${epCount}</span>`
            tab.addEventListener("click", () => {
                pillTabs.querySelectorAll(".pill-tab").forEach(t => t.classList.remove("active"))
                tab.classList.add("active")
                contentsWrap.querySelectorAll(".season-content").forEach(c =>
                    c.style.display = String(c.dataset.season) === String(idx) ? "block" : "none"
                )
            })
            pillTabs.appendChild(tab)

            const seasonContent = document.createElement("div")
            seasonContent.className = "season-content"
            seasonContent.dataset.season = idx
            seasonContent.style.display = idx === 0 ? "block" : "none"

            const episodeList = document.createElement("div")
            episodeList.className = "episode-list"

            if (Array.isArray(season.episodios) && season.episodios.length > 0) {
                season.episodios.forEach((episode, epIdx) => {
                    episodeList.appendChild(buildEpisodeCard(episode, serie, idx, epIdx))
                })
            } else {
                episodeList.innerHTML = `<p style="color: var(--text-muted);">No hay episodios disponibles para esta temporada.</p>`
            }

            seasonContent.appendChild(episodeList)
            contentsWrap.appendChild(seasonContent)
        })

        section.appendChild(pillTabs)
        section.appendChild(contentsWrap)
        detailBody.appendChild(section)
        relayoutEpisodeDescriptions()
    }

    function buildEpisodeCard(episode, serie, seasonIdx, epIdx) {
        const item = document.createElement("article")
        item.className = "episode-item"
        if (window.FGPHistory && episode.numero_completo && window.FGPHistory.isEpisodeSeen(serie.id || serie._id, episode.numero_completo)) {
            item.classList.add("watched")
        }
        item.dataset.epNumero = episode.numero_completo || ""
        item.tabIndex = 0
        item.setAttribute("role", "button")
        item.setAttribute("aria-label", `Ver opciones de reproducción de ${episode.titulo}`)

        const thumb = episode.miniatura || episode.imagen || serie.post

        // Chips con la info del primer servidor disponible
        const first = Array.isArray(episode.servidores) && episode.servidores.length > 0 ? episode.servidores[0] : null
        const chipsHtml = first ? `
            <div class="episode-meta-row">
                ${first.calidad ? `<span class="episode-chip"><i class="fas fa-hd"></i>${first.calidad}</span>` : ""}
                ${first.idioma ? `<span class="episode-chip"><i class="fas fa-language"></i>${first.idioma}</span>` : ""}
                ${first.tipo ? `<span class="episode-chip"><i class="fas fa-microphone"></i>${first.tipo}</span>` : ""}
            </div>` : ""

        item.innerHTML = `
            <div class="episode-header">
                <div class="episode-thumbnail-wrap">
                    <img class="episode-thumbnail" src="${thumb}" alt="${episode.titulo}" loading="lazy">
                    ${episode.numero_completo ? `<span class="episode-number-badge">${episode.numero_completo}</span>` : ""}
                    <span class="watched-eye" aria-label="Episodio ya visto"><i class="fas fa-eye"></i></span>
                </div>
                <div class="episode-info">
                    <h3 class="episode-title">${episode.titulo}</h3>
                    <p class="episode-description">${episode.descripcion || "Sin descripción disponible."}</p>
                    ${chipsHtml}
                </div>
            </div>
            <div class="episode-hint">
                <i class="fas fa-circle-play"></i> Ver opciones de reproducción
                <i class="fas fa-chevron-right"></i>
            </div>`

        const ctx = { serie, seasonIdx, epIdx, episode }
        item.addEventListener("click", () => openEpisodeServersModal(episode, ctx))
        item.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                openEpisodeServersModal(episode, ctx)
            }
        })

        attachVerMas(item.querySelector(".episode-description"), 2, { always: true })

        return item
    }

    // ------------------------------------------------------------
    // Layout responsive de episodios: en Android/pantalla estrecha la
    // descripción sale de la columna derecha y pasa a ocupar TODO el ancho
    // debajo de la miniatura; los chips quedan pegados al nombre.
    // En escritorio vuelve a su lugar original (título → descripción → chips).
    // ------------------------------------------------------------
    const EPISODE_MQ = window.matchMedia("(max-width: 768px)")
    function relayoutEpisodeDescriptions() {
        document.querySelectorAll(".episode-item").forEach(item => {
            const desc = item.querySelector(".episode-description")
            const header = item.querySelector(".episode-header")
            const info = item.querySelector(".episode-info")
            const title = item.querySelector(".episode-title")
            if (!desc || !header || !info || !title) return
            if (EPISODE_MQ.matches) {
                if (desc.parentElement !== item) header.after(desc)
                else { /* ya está fuera */ }
            } else {
                if (desc.parentElement !== info) title.after(desc)
            }
        })
    }
    if (EPISODE_MQ.addEventListener) EPISODE_MQ.addEventListener("change", relayoutEpisodeDescriptions)
    else if (EPISODE_MQ.addListener) EPISODE_MQ.addListener(relayoutEpisodeDescriptions)

    // ------------------------------------------------------------
    // Modal "Opciones de reproducción" del episodio
    // ------------------------------------------------------------
    function openEpisodeServersModal(episode, ctx = {}) {
        closeEpisodeServersModal()

        const servers = Array.isArray(episode.servidores) ? episode.servidores : []
        // Al reproducir un episodio: cuenta como vista y lo marca como visto
        const onWatch = () => {
            if (ctx.serie) {
                recordSeriesView(ctx.serie, ctx.seasonIdx, ctx.epIdx, episode)
                markEpisodeCardWatched(episode.numero_completo)
            }
        }

        const overlay = document.createElement("div")
        overlay.className = "modal open"
        overlay.id = "ep-servers-modal"
        overlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h2 class="modal-title"><i class="fas fa-play-circle"></i> Opciones de reproducción</h2>
                        <p class="modal-subtitle">${episode.titulo}${episode.numero_completo ? ` · ${episode.numero_completo}` : ""}</p>
                    </div>
                    <button class="modal-close" id="ep-servers-close" aria-label="Cerrar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body"></div>
            </div>`

        const body = overlay.querySelector(".modal-body")
        if (servers.length === 0) {
            body.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No hay servidores disponibles para este episodio.</p>`
        } else {
            body.appendChild(buildServerGroups(servers, onWatch))
        }

        document.body.appendChild(overlay)
        document.body.style.overflow = "hidden"

        const close = () => closeEpisodeServersModal()
        overlay.querySelector("#ep-servers-close").addEventListener("click", close)
        overlay.addEventListener("click", e => { if (e.target === overlay) close() })
        document.addEventListener("keydown", escHandler)
    }

    function escHandler(e) {
        if (e.key === "Escape") {
            closeEpisodeServersModal()
            closeMovieServersModal()
        }
    }

    // Agrupa servidores por idioma: etiqueta + lista de opciones
    function buildServerGroups(servers, onWatch) {
        const groups = {}
        const order = []
        servers.forEach(server => {
            const lang = server.idioma || "Multilenguaje"
            if (!groups[lang]) {
                groups[lang] = []
                order.push(lang)
            }
            groups[lang].push(server)
        })

        let isFirst = true
        const container = document.createElement("div")
        order.forEach(lang => {
            const label = document.createElement("div")
            label.className = "server-group-label"
            label.innerHTML = `<i class="fas fa-language"></i> ${lang}`
            container.appendChild(label)

            const options = buildServerOptions(groups[lang], null, onWatch)
            if (isFirst) {
                const primary = options.querySelector(".watch-btn")
                if (primary && !primary.classList.contains("btn-red")) {
                    primary.classList.add("btn-red", "primary")
                }
                isFirst = false
            }
            container.appendChild(options)
        })
        return container
    }

    function closeEpisodeServersModal() {
        const existing = document.getElementById("ep-servers-modal")
        if (existing) existing.remove()
        document.body.style.overflow = ""
        document.removeEventListener("keydown", escHandler)
    }

    // Al abandonar la página (atrás/adelante/recarga), cerrar el modal para que
    // la caché del navegador (BFCache) guarde una copia limpia: si la página se
    // guarda con el scroll bloqueado, el retroceso posterior se ve roto o el
    // navegador decide recargar todo el index en lugar de restaurar al vuelo.
    window.addEventListener("pagehide", () => {
        try { closeEpisodeServersModal() } catch (e) {}
        try { closeMovieServersModal() } catch (e) {}
    })

    // ------------------------------------------------------------
    // Contenido similar (por género)
    // ------------------------------------------------------------
    async function loadSimilarContent(item) {
        if (!item) return
        const genres = parseGenres(item)
        if (genres.length === 0) return

        try {
            const apiUrl = contentType === "movies" ? `${apiBaseUrl}/api/movies` : `${apiBaseUrl}/api/series`
            const data = await fetchWithCache(`${apiUrl}?search=generos=${encodeURIComponent(genres[0].trim())}&limit=20&random=true`)
            if (!data.success || !Array.isArray(data.data)) return

            const similar = data.data.filter(x => (x.id || x._id) !== contentId).slice(0, 20)
            if (similar.length === 0) return
            rememberItems(contentType, similar)

            const section = document.createElement("section")
            section.className = "detail-section"
            section.style.animationDelay = "0.1s"
            section.innerHTML = `
                <h2 class="detail-section-title"><i class="fas fa-fire"></i> Contenido similar</h2>
                <div class="movies-row" id="similar-row"></div>`

            const row = section.querySelector("#similar-row")
            similar.forEach(sim => {
                const card = document.createElement("div")
                card.className = "movie-card"
                card.innerHTML = `
                    <div class="movie-poster-container">
                        <img class="movie-poster" src="${sim.post}" alt="${sim.titulo}" loading="lazy">
                        <div class="movie-overlay">
                            <button class="movie-play-btn" aria-label="Ver ${sim.titulo}">
                                <i class="fas fa-play"></i>
                            </button>
                        </div>
                        <div class="movie-type">${contentType === "movies" ? "PELÍCULA" : "SERIE"}</div>
                    </div>
                    <div class="movie-info">
                        <h3 class="movie-title">${sim.titulo}</h3>
                        <div class="movie-meta">
                            <div class="movie-rating">
                                <i class="fas fa-star"></i>
                                <span>${stableRating(sim.id || sim._id)}</span>
                            </div>
                            <div class="movie-year">
                                <i class="far fa-calendar-alt"></i>
                                <span>${sim.ano || ""}</span>
                            </div>
                        </div>
                    </div>`

                card.addEventListener("click", () => {
                    const id = sim.id || sim._id
                    if (id) {
                        window.location.href = window.FGPUrl.buildDetailUrl(contentType, id)
                    }
                })
                row.appendChild(card)
            })

            detailBody.appendChild(section)
        } catch (error) { /* similares opcionales */ }
    }

    // Caché local ligera para los similares (reutiliza patrón del main.js)
    // ⏱ TTL espejo del main.js — ajusta ambos si cambias el "X tiempo"
    const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 horas

    function fetchWithCache(url) {
        const key = CACHE_PREFIX + `fetch_${url}`
        return new Promise(async resolve => {
            try {
                const raw = localStorage.getItem(key)
                if (raw) {
                    const { data, timestamp } = JSON.parse(raw)
                    if (Date.now() - timestamp < CACHE_TTL_MS) {
                        resolve(data)
                        return
                    }
                    // Vencida: servir igual y refrescar en segundo plano
                    ;(async () => {
                        try {
                            const response = await fetch(url)
                            const fresh = await response.json()
                            localStorage.setItem(key, JSON.stringify({ data: fresh, timestamp: Date.now() }))
                        } catch (e) { /* se mantiene el stale */ }
                    })()
                    resolve(data)
                    return
                }
            } catch (e) { /* seguir */ }

            try {
                const response = await fetch(url)
                const data = await response.json()
                try {
                    localStorage.setItem(key, JSON.stringify({ data: data, timestamp: Date.now() }))
                } catch (e) { /* cuota llena */ }
                resolve(data)
            } catch (e) {
                resolve({ success: false, data: [] })
            }
        })
    }

    // Arrancar
    init()
})
