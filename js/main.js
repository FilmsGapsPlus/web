document.addEventListener("DOMContentLoaded", () => {
    // ============================================================
    // Elementos del DOM
    // ============================================================
    const heroSection = document.getElementById("hero-section")
    const contentContainer = document.getElementById("content-container")
    const loadingElement = document.getElementById("loading")
    const searchInput = document.getElementById("search-input")
    const searchBtn = document.getElementById("search-btn")
    const navTabs = document.querySelectorAll(".nav-tab")
    const tabs = document.getElementById("tabs")
    const siteHeader = document.getElementById("site-header")
    const feedbackBtn = document.getElementById("feedback-btn")

    const channelPlayerContainer = document.getElementById("channel-player-container")
    const channelPlayerClose = document.getElementById("channel-player-close")
    const channelVideoEl = document.getElementById("channel-video")
    const channelVideoLoading = document.getElementById("channel-video-loading")
    const channelVideoError = document.getElementById("channel-video-error")
    const channelRetryBtn = document.getElementById("channel-retry-btn")

    const countriesModal = document.getElementById("countries-modal")
    const countriesModalClose = document.getElementById("countries-modal-close")
    const countriesGridModal = document.getElementById("countries-grid-modal")
    const countriesSearch = document.getElementById("countries-search")

    // ============================================================
    // Configuración de API (dominio propio con CORS abierto)
    // ============================================================
    let apiBaseUrl = "https://anusdbs.onrender.com"

    const apiUrlMovies = `${apiBaseUrl}/api/movies`
    const apiUrlSeries = `${apiBaseUrl}/api/series`
    const apiUrlChannels = `${apiBaseUrl}/api/channels`
    const apiUrlChannelsByIso = `${apiBaseUrl}/api/channels/iso/`
    const apiUrlIpCountry = "https://api.ipaddress.com/iptocountry?format=json"

    // ============================================================
    // Caché local con TTL
    // - Mientras el TTL esté vigente: TODO se sirve desde caché (sin red) = carga instantánea
    // - Al expirar: se pide fresco a la API y, si falla la red, se usa el respaldo viejo
    // ⏱ Ajusta aquí el "X tiempo":
    // ============================================================
    const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 horas
    const CACHE_PREFIX = "filmsgapsplus_"
    const CONTENT_INDEX_KEY = "fgp_content_index_v1"
    const INDEX_MAX_PER_TYPE = 150

    function getFromCache(key) {
        try {
            const cachedData = localStorage.getItem(CACHE_PREFIX + key)
            if (!cachedData) return null
            const { data, timestamp } = JSON.parse(cachedData)
            if (Date.now() - timestamp > CACHE_TTL_MS) {
                localStorage.removeItem(CACHE_PREFIX + key)
                return null
            }
            return data
        } catch (error) {
            return null
        }
    }

    function readCacheEntry(key) {
        try {
            const raw = localStorage.getItem(CACHE_PREFIX + key)
            return raw ? JSON.parse(raw) : null // { data, timestamp }
        } catch (error) {
            return null
        }
    }

    function saveToCache(key, data) {
        try {
            localStorage.setItem(
                CACHE_PREFIX + key,
                JSON.stringify({ data: data, timestamp: Date.now() })
            )
        } catch (error) { /* cuota llena */ }
    }

    function clearExpiredCache() {
        try {
            const keysToRemove = []
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key.startsWith(CACHE_PREFIX)) {
                    try {
                        const cachedData = JSON.parse(localStorage.getItem(key))
                        if (Date.now() - cachedData.timestamp > CACHE_TTL_MS) keysToRemove.push(key)
                    } catch (e) {
                        keysToRemove.push(key)
                    }
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key))
        } catch (error) { /* noop */ }
    }

    clearExpiredCache()

    // Refrescos en segundo plano en curso (stale-while-revalidate)
    const inflightRevalidations = new Set()

    function revalidateInBackground(url, options, cacheKey) {
        if (inflightRevalidations.has(cacheKey)) return
        inflightRevalidations.add(cacheKey)
        ;(async () => {
            try {
                const response = await fetch(url, options)
                if (response.ok) saveToCache(cacheKey, await response.json())
            } catch (error) { /* se mantiene el stale */ } finally {
                inflightRevalidations.delete(cacheKey)
            }
        })()
    }

    // ¿Hay caché vigente? → entrada "caliente": render instantáneo sin spinner global
    function hasWarmCache() {
        try {
            const now = Date.now()
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (!key.startsWith(CACHE_PREFIX + "fetch_")) continue
                try {
                    const { timestamp } = JSON.parse(localStorage.getItem(key))
                    if (now - timestamp < CACHE_TTL_MS) return true
                } catch (e) { /* seguir */ }
            }
        } catch (error) { /* noop */ }
        return false
    }

    async function fetchWithCache(url, options = {}) {
        const cacheKey = `fetch_${url}_${JSON.stringify(options)}`
        const entry = readCacheEntry(cacheKey)

        // 1) Entrada fresca (dentro del TTL): servir directo de caché, cero red
        if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
            return entry.data
        }

        // 2) Entrada vencida pero existente: mostrarla al instante y refrescar de fondo
        if (entry) {
            revalidateInBackground(url, options, cacheKey)
            return entry.data
        }

        // 3) Sin caché: red obligatoria
        try {
            const response = await fetch(url, options)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            const data = await response.json()
            saveToCache(cacheKey, data)
            return data
        } catch (error) {
            // Respaldo final: cualquier resto viejo si la red falla
            const stale = readCacheEntry(cacheKey)
            if (stale) return stale.data
            throw error
        }
    }

    // ============================================================
    // Índice de contenido para deeplinks (id -> objeto completo)
    // ============================================================
    function loadContentIndex() {
        try {
            return JSON.parse(localStorage.getItem(CONTENT_INDEX_KEY)) || {}
        } catch (error) {
            return {}
        }
    }

    function getItemId(item) {
        return item && (item.id || item._id || null)
    }

    function rememberItems(type, items) {
        if (!Array.isArray(items) || items.length === 0) return
        const index = loadContentIndex()
        const bucket = index[type] || (index[type] = {})
        items.forEach(item => {
            const id = getItemId(item)
            if (!id) return
            bucket[id] = item
        })
        const keys = Object.keys(bucket)
        if (keys.length > INDEX_MAX_PER_TYPE) {
            keys.slice(0, keys.length - INDEX_MAX_PER_TYPE).forEach(k => delete bucket[k])
        }
        try {
            localStorage.setItem(CONTENT_INDEX_KEY, JSON.stringify(index))
        } catch (error) { /* cuota llena */ }
    }

    // Navegación por deeplink a la página de detalle (idempotente para testing)
    if (!window.navigateTo) {
        window.navigateTo = url => { window.location.href = url }
    }
    const FGPUrl = window.FGPUrl || {
        buildDetailUrl: (type, id) => `details.html?type=${type}&id=${encodeURIComponent(id)}`
    }

    function openDetails(type, item) {
        if (!item) return
        let id = getItemId(item)
        if (!id) {
            // ID sintético determinista para ítems sin id
            id = "t_" + Array.from((item.titulo || "") + (item.ano || ""))
                .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
                .toString(36)
            rememberItems(type, [{ ...item, id: id }])
        }
        window.navigateTo(FGPUrl.buildDetailUrl(type, id))
    }

    // Rating estable basado en el id (sin parpadeos entre renders)
    function stableRating(seedStr) {
        let h = 0
        const s = String(seedStr || "")
        for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
        return (6.9 + Math.abs(h % 24) / 10).toFixed(1)
    }

    // ============================================================
    // Géneros
    // ============================================================
    const allGenres = [
        "Accion", "Animacion", "Anime", "Aventura", "Belica", "Ciencia Ficcion",
        "Comedia", "Crimen", "Documental", "Drama", "Familia", "Fantasia",
        "Historia", "Infantil", "Misterio", "Musica", "News", "Película de TV",
        "Politica", "Reality", "Romance", "Suspenso", "Talk", "Telenovela",
        "Terror", "Western",
    ]

    function getGenreIcon(genre) {
        const iconMap = {
            "Accion": "fas fa-running",
            "Comedia": "fas fa-laugh",
            "Terror": "fas fa-ghost",
            "Ciencia Ficcion": "fas fa-robot",
            "Romance": "fas fa-heart",
            "Animacion": "fas fa-child",
            "Anime": "fas fa-child",
            "Drama": "fas fa-theater-masks",
            "Aventura": "fas fa-mountain",
            "Fantasia": "fas fa-dragon",
            "Misterio": "fas fa-search"
        }
        return iconMap[genre] || "fas fa-film"
    }

    // ============================================================
    // Estado de la aplicación
    // ============================================================
    let featuredContent = null
    let currentContentType = "movies"
    let isSearchActive = false
    let isLoading = false
    let genreCache = { movies: {}, series: {} }

    let allCountries = []
    let currentCountryIso = null
    let currentCountryChannels = []
    let userCountryIso = null

    // Reproductor fullscreen de canales (@videojs/html custom elements)
    let currentChannel = null

    // ============================================================
    // Header glass al hacer scroll
    // ============================================================
    function onScroll() {
        if (siteHeader) siteHeader.classList.toggle("scrolled", window.scrollY > 12)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()

    // ============================================================
    // Inicialización
    // ============================================================
    async function initializeApp() {
        // El spinner lo gestiona loadContent según caché fría/caliente
        loadContent("movies")
    }

    async function loadContent(type) {
        currentContentType = type
        isSearchActive = false

        // Cambio de pestaña con datos ya en memoria: render instantáneo,
        // sin volver a pedir nada ni "recargar" el index completo
        const cachedView = type !== "channels" && viewData[type] &&
            Array.isArray(viewData[type].featured) && viewData[type].genres.length > 0
        if (cachedView) {
            contentContainer.innerHTML = ""
            loadingElement.style.display = "none"
            tabs.style.display = "flex"
            heroSection.style.display = "block"
            contentContainer.style.display = "block"
            renderContinueWatching()
            startFeaturedCarousel(viewData[type].featured, type)
            viewData[type].genres.forEach(g => createGenreSection(g.genreTitle, g.content, g.icon, type, g.wide))
            return
        }

        // Entrada caliente (caché vigente): sin spinner global, render instantáneo
        const warmCache = hasWarmCache()

        heroSection.style.display = "none"
        contentContainer.style.display = "none"
        tabs.style.display = "none"
        if (!warmCache) loadingElement.style.display = "flex"
        contentContainer.innerHTML = ""

        try {
            if (type === "channels") {
                await loadChannelsSection()
            } else {
                genreCollector = []
                renderContinueWatching()
                await Promise.all([
                    loadFeaturedContent(type),
                    organizeContentByGenre(type)
                ])
                // Guardar la vista construida para futuros cambios de pestaña
                const featured = viewData[type] && viewData[type].featured
                if (Array.isArray(featured) && featured.length > 0 && genreCollector.length > 0) {
                    viewData[type] = { featured, genres: genreCollector.slice() }
                }
            }
        } catch (error) {
            contentContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-wifi"></i>
                    <h2>No se pudo cargar el contenido</h2>
                    <p>Revisa tu conexión e intenta de nuevo más tarde.</p>
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="fas fa-redo"></i> Reintentar
                    </button>
                </div>`
        } finally {
            isLoading = false
            loadingElement.style.display = "none"
            tabs.style.display = "flex"
            if (type !== "channels") heroSection.style.display = "block"
            contentContainer.style.display = "block"
            scrollToTop()
        }
    }

    // ============================================================
    // Hero destacado
    // ============================================================
    let featuredTimer = null

    // Vista construida por tipo (destacados + filas por género) para poder
    // restaurarla al instante al cambiar de pestaña sin refetch
    const viewData = {}
    let genreCollector = null

    // Los títulos a veces traen saltos de línea o dobles espacios del origen:
    // normalizarlos para que el clamp de 2 líneas muestre "..." y no corte feo
    function cleanTitle(t) {
        return String(t == null ? "" : t).replace(/\s+/g, " ").trim()
    }

    async function loadFeaturedContent(type) {
        try {
            const apiUrl = type === "movies" ? apiUrlMovies : apiUrlSeries
            const data = await fetchWithCache(`${apiUrl}?limit=8&random=true`)
            if (data.success && data.data.length > 0) {
                rememberItems(type, data.data)
                startFeaturedCarousel(data.data.slice(0, 6), type)
                return
            }
        } catch (error) { /* sin red: usar el contenido guardado */ }
        // Fallback offline: carrusel con lo que ya hay en localStorage
        const cached = getCachedFeatured(type)
        if (cached.length > 0) startFeaturedCarousel(cached, type)
    }

    function getCachedFeatured(type) {
        try {
            const raw = JSON.parse(localStorage.getItem(CONTENT_INDEX_KEY))
            const items = Object.values((raw && raw[type]) || {}).filter(it => it && it.titulo)
            return shuffleArray(items).slice(0, 6)
        } catch (e) {
            return []
        }
    }

    // Carrusel del "Destacado hoy": rota automáticamente cada 6 s entre
    // varios títulos (películas o series según la pestaña activa)
    function startFeaturedCarousel(items, type) {
        if (!Array.isArray(items) || items.length === 0) return
        viewData[type] = viewData[type] || {}
        viewData[type].featured = items
        let idx = 0

        const show = i => {
            idx = (i + items.length) % items.length
            featuredContent = items[idx]
            updateHeroSection(featuredContent, type, idx, items.length)
        }
        const restartTimer = () => {
            if (featuredTimer) clearInterval(featuredTimer)
            featuredTimer = setInterval(() => show(idx + 1), 6000)
        }

        show(0)
        restartTimer()
        heroCarouselJump = i => { show(i); restartTimer() }
    }

    let heroCarouselJump = null

    function updateHeroSection(content, type, activeIdx = 0, total = 0) {
        if (!content) return
        heroSection.innerHTML = `
            <img class="hero-backdrop" src="${content.miniature || content.post}" alt="${content.titulo}">
            <div class="hero-overlay"></div>
            <div class="hero-content fadeInUp">
                <span class="hero-badge"><i class="fas fa-bolt"></i> Destacado hoy</span>
                <h1 class="hero-title">${cleanTitle(content.titulo)}</h1>
                <div class="hero-meta">
                    <span><i class="far fa-calendar-alt"></i> ${content.ano || ""}</span>
                    ${content.duracion ? `<span><i class="far fa-clock"></i> ${content.duracion}</span>` : ""}
                    <span class="meta-star"><i class="fas fa-star"></i> ${stableRating(getItemId(content))}</span>
                    <span><i class="fas fa-tag"></i> ${type === "movies" ? "Película" : "Serie"}</span>
                </div>
                <p class="hero-description">${content.descripcion || ""}</p>
                <div class="hero-buttons">
                    <button class="btn btn-red" id="hero-watch-btn">
                        <i class="fas fa-play"></i> Ver ahora
                    </button>
                    <button class="btn btn-glass" id="hero-info-btn">
                        <i class="fas fa-info-circle"></i> Más información
                    </button>
                </div>
                ${total > 1 ? `
                <div class="hero-dots" role="tablist" aria-label="Destacados">
                    ${Array.from({ length: total }, (_, i) =>
                        `<button class="hero-dot ${i === activeIdx ? "active" : ""}" data-i="${i}" aria-label="Destacado ${i + 1}"></button>`
                    ).join("")}
                </div>` : ""}
            </div>`
        const goDetail = () => openDetails(type, content)
        document.getElementById("hero-watch-btn").addEventListener("click", goDetail)
        document.getElementById("hero-info-btn").addEventListener("click", goDetail)
        heroSection.querySelectorAll(".hero-dot").forEach(dot => {
            dot.addEventListener("click", e => {
                e.stopPropagation()
                if (heroCarouselJump) heroCarouselJump(Number(dot.dataset.i))
            })
        })
    }

    // ============================================================
    // Canales de TV
    // ============================================================
    async function loadChannelsSection() {
        try {
            if (!userCountryIso) {
                try {
                    const ipResponse = await fetch(apiUrlIpCountry)
                    const ipData = await ipResponse.json()
                    userCountryIso = (ipData.country_code || "").toLowerCase() || "us"
                } catch (e) {
                    userCountryIso = "us"
                }
            }

            if (allCountries.length === 0) {
                const countriesData = await fetchWithCache(apiUrlChannels)
                if (countriesData.success && countriesData.data.length > 0) {
                    allCountries = countriesData.data[0].countries || []
                }
            }

            if (!currentCountryIso) {
                const userCountryExists = allCountries.find(c => c.iso === userCountryIso)
                currentCountryIso = userCountryExists ? userCountryIso : (allCountries[0]?.iso || "us")
            }

            if (currentCountryChannels.length === 0) {
                await loadChannelsByCountry(currentCountryIso)
            }

            renderChannelsUI()
        } catch (error) {
            contentContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-satellite-dish"></i>
                    <h2>Error al cargar los canales</h2>
                    <p>Por favor, intenta de nuevo más tarde.</p>
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="fas fa-redo"></i> Reintentar
                    </button>
                </div>`
        }
    }

    async function loadChannelsByCountry(iso) {
        try {
            const data = await fetchWithCache(`${apiUrlChannelsByIso}${iso}`)
            if (data.success && data.data && data.data.servidores) {
                currentCountryChannels = data.data.servidores
                currentCountryIso = iso
            } else {
                currentCountryChannels = []
            }
        } catch (error) {
            currentCountryChannels = []
        }
    }

    function sortChannelsAlphabetically(channels) {
        return [...channels].sort((a, b) =>
            String(a.titulo || "").localeCompare(String(b.titulo || ""), "es", { sensitivity: "base" })
        )
    }

    function getChannelDescription(channel) {
        return (
            channel.descripcion ||
            channel.description ||
            channel.sinopsis ||
            ""
        ).trim() || "Transmisión en vivo disponible las 24 horas."
    }

    function renderChannelsUI() {
        contentContainer.innerHTML = ""

        const currentCountry = allCountries.find(c => c.iso === currentCountryIso)

        const channelsSection = document.createElement("div")
        channelsSection.className = "channels-header-container fadeInUp"
        channelsSection.innerHTML = `
            <div class="channels-header-left">
                <h2 class="countries-title"><i class="fas fa-globe"></i> Canales de TV en Vivo</h2>
                <p class="channels-subtitle">Transmisiones en directo de canales de todo el mundo</p>
            </div>
            <div class="channels-header-right">
                <button class="country-selector-btn" id="open-countries-modal">
                    <span class="country-flag">${currentCountry?.flag || "🌍"}</span>
                    <div class="country-details">
                        <div class="country-name">${currentCountry?.name || "Seleccionar país"}</div>
                        <div class="country-channels-count">
                            <i class="fas fa-tv"></i> ${currentCountry?.server_count || currentCountryChannels.length} canales disponibles
                        </div>
                    </div>
                    <i class="fas fa-chevron-down change-country-icon"></i>
                </button>
            </div>`

        contentContainer.appendChild(channelsSection)

        const openCountriesModalBtn = document.getElementById("open-countries-modal")
        if (openCountriesModalBtn) {
            openCountriesModalBtn.addEventListener("click", openCountriesModal)
        }

        if (currentCountryChannels.length > 0) {
            const channelsGrid = document.createElement("div")
            channelsGrid.className = "genre-section fadeInUp"
            channelsGrid.style.marginTop = "1rem"

            const channelsHeader = document.createElement("div")
            channelsHeader.className = "section-header"
            channelsHeader.innerHTML = `
                <h2 class="section-title">
                    <i class="fas fa-broadcast-tower"></i>
                    Canales de ${currentCountry?.name || "TV"}
                    <span class="section-count">${sortChannelsAlphabetically(currentCountryChannels).length} disponibles · orden alfabético</span>
                </h2>`

            const channelsGridContainer = document.createElement("div")
            channelsGridContainer.className = "channels-grid"

            sortChannelsAlphabetically(currentCountryChannels).forEach(channel => {
                const channelCard = document.createElement("div")
                channelCard.className = "channel-card"
                channelCard.innerHTML = `
                    <div class="channel-thumb-container">
                        <img class="channel-logo contain" src="${channel.logo}" alt="${channel.titulo}" loading="lazy"
                            onerror="this.classList.remove('contain'); this.src='img/icon_filmsgapsplus.png'">
                        <div class="channel-live-badge">EN VIVO</div>
                        ${channel.calidad ? `<div class="channel-quality">${channel.calidad}</div>` : ""}
                    </div>
                    <div class="channel-info">
                        <h3 class="channel-title">${channel.titulo}</h3>
                        <p class="channel-desc">${getChannelDescription(channel)}</p>
                        <div class="channel-meta-row">
                            <span><i class="fas fa-signal"></i> Streaming HD</span>
                            <span><i class="far fa-play-circle"></i> Gratis</span>
                        </div>
                    </div>
                    <button class="channel-play-fab" aria-label="Reproducir ${channel.titulo}">
                        <i class="fas fa-play"></i>
                    </button>`

                channelCard.addEventListener("click", () => playChannel(channel))
                channelsGridContainer.appendChild(channelCard)
            })

            channelsGrid.appendChild(channelsHeader)
            channelsGrid.appendChild(channelsGridContainer)
            contentContainer.appendChild(channelsGrid)
        } else {
            const noChannels = document.createElement("div")
            noChannels.className = "empty-state fadeInUp"
            noChannels.innerHTML = `
                <i class="fas fa-tv"></i>
                <h2>No hay canales disponibles</h2>
                <p>No se encontraron canales para este país. Intenta seleccionar otro país.</p>
                <button class="btn btn-primary" id="select-another-country">
                    <i class="fas fa-globe"></i> Seleccionar otro país
                </button>`
            contentContainer.appendChild(noChannels)

            const selectAnotherBtn = document.getElementById("select-another-country")
            if (selectAnotherBtn) selectAnotherBtn.addEventListener("click", openCountriesModal)
        }
    }

    // Modal de países
    function openCountriesModal() {
        countriesModal.style.display = "block"
        document.body.style.overflow = "hidden"
        renderCountriesInModal()
        countriesSearch.value = ""
        countriesSearch.focus()
    }

    function closeCountriesModal() {
        countriesModal.style.display = "none"
        document.body.style.overflow = "auto"
    }

    function renderCountriesInModal(filter = "") {
        countriesGridModal.innerHTML = ""

        const filteredCountries = filter
            ? allCountries.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()))
            : [...allCountries].sort((a, b) => a.name.localeCompare(b.name, "es"))

        if (filteredCountries.length === 0) {
            countriesGridModal.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:2rem; color: var(--text-muted);">
                    <i class="fas fa-search" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>
                    No se encontraron países con "${filter}"
                </div>`
            return
        }

        filteredCountries.forEach(country => {
            const countryCard = document.createElement("div")
            countryCard.className = `country-card-modal ${country.iso === currentCountryIso ? "active" : ""}`
            countryCard.innerHTML = `
                <span class="country-flag">${country.flag}</span>
                <div class="country-info">
                    <div class="country-name">${country.name}</div>
                    <div class="country-channels">
                        <i class="fas fa-tv"></i> ${country.server_count} canales
                    </div>
                </div>`

            countryCard.addEventListener("click", async () => {
                if (country.iso !== currentCountryIso) {
                    closeCountriesModal()
                    loadingElement.style.display = "flex"
                    currentCountryChannels = []
                    await loadChannelsByCountry(country.iso)
                    loadingElement.style.display = "none"
                    renderChannelsUI()
                } else {
                    closeCountriesModal()
                }
            })

            countriesGridModal.appendChild(countryCard)
        })
    }

    countriesModalClose.addEventListener("click", closeCountriesModal)
    countriesModal.addEventListener("click", e => {
        if (e.target === countriesModal) closeCountriesModal()
    })
    countriesSearch.addEventListener("input", e => renderCountriesInModal(e.target.value))

    // ============================================================
    // Reproductor de canales — fullscreen, sin logo ni chrome extra
    // ============================================================
    function bindChannelVideoEvents() {
        channelVideoEl.addEventListener("playing", () => {
            channelVideoLoading.style.display = "none"
            channelVideoError.style.display = "none"
        })
        channelVideoEl.addEventListener("waiting", () => {
            if (currentChannel) channelVideoLoading.style.display = "flex"
        })
        channelVideoEl.addEventListener("error", () => {
            if (!currentChannel) return
            channelVideoLoading.style.display = "none"
            channelVideoError.style.display = "flex"
        })
    }

    function startChannelPlayback(channel) {
        try {
            channelVideoEl.src = channel.url
            const playPromise = channelVideoEl.play ? channelVideoEl.play() : null
            if (playPromise && typeof playPromise.catch === "function") {
                // Autoplay bloqueado: la skin muestra su botón de reproducción
                playPromise.catch(() => {
                    channelVideoLoading.style.display = "none"
                })
            }
        } catch (error) {
            channelVideoLoading.style.display = "none"
        }
    }

    function playChannel(channel) {
        currentChannel = channel

        channelPlayerContainer.classList.add("open")
        document.body.style.overflow = "hidden"
        channelVideoLoading.style.display = "flex"
        channelVideoError.style.display = "none"

        // Esperar (con tope de 2.5s) a que el custom element <video-player> esté definido
        if (window.customElements && typeof window.customElements.get === "function" && !window.customElements.get("video-player")) {
            let started = false
            const go = () => {
                if (started) return
                started = true
                startChannelPlayback(channel)
            }
            window.customElements.whenDefined("video-player").then(go).catch(go)
            setTimeout(go, 2500)
        } else {
            startChannelPlayback(channel)
        }
    }

    function closeChannelPlayer() {
        channelPlayerContainer.classList.remove("open")
        document.body.style.overflow = "auto"

        try {
            channelVideoEl.pause()
            channelVideoEl.removeAttribute("src")
            channelVideoEl.load()
        } catch (e) { /* noop */ }
        currentChannel = null
    }

    bindChannelVideoEvents()
    channelPlayerClose.addEventListener("click", closeChannelPlayer)
    channelRetryBtn.addEventListener("click", () => {
        if (currentChannel) playChannel(currentChannel)
    })

    // ============================================================
    // Organización por género
    // ============================================================
    // ------------------------------------------------------------
    // "Continuar viendo": historial mixto de películas y series.
    // Se muestra en ambas pestañas, arriba de Estrenos. Miniatura
    // horizontal (no póster). Click retoma donde se quedó el usuario.
    // ------------------------------------------------------------
    function renderContinueWatching() {
        if (!window.FGPHistory) return
        const items = window.FGPHistory.listAll()
        if (items.length === 0) return

        const section = document.createElement("div")
        section.className = "genre-section continue-section fadeInUp"

        const header = document.createElement("div")
        header.className = "section-header"
        header.innerHTML = `
            <h2 class="section-title"><i class="fas fa-clock-rotate-left"></i> Continuar viendo</h2>
            <button class="history-clear-btn" id="history-clear-btn" type="button" aria-label="Vaciar historial">
                <i class="fas fa-trash-can"></i> Vaciar
            </button>`
        section.appendChild(header)

        const row = document.createElement("div")
        row.className = "continue-row"

        const buildCards = () => {
            row.innerHTML = ""
            window.FGPHistory.listAll().forEach(entry => {
                if (!entry || !entry.id) return
                const card = document.createElement("article")
                card.className = "continue-card"
                card.tabIndex = 0

                const isSerie = entry.type === "series"
                const resumeLabel = isSerie && entry.seasonIdx !== undefined && entry.epIdx !== undefined
                    ? `<span class="continue-resume"><i class="fas fa-rotate-right"></i> T${entry.seasonIdx + 1} · E${entry.epIdx + 1}${entry.epTitle ? ` — ${entry.epTitle}` : ""}</span>`
                    : ""
                card.innerHTML = `
                    <div class="continue-thumb-wrap">
                        <img class="continue-thumb" src="${entry.miniature || entry.post}" alt="${entry.titulo}" loading="lazy">
                        <span class="continue-type-badge"><i class="fas ${isSerie ? "fa-tv" : "fa-film"}"></i> ${isSerie ? "Serie" : "Película"}</span>
                        <button class="continue-remove" type="button" aria-label="Quitar de la lista"><i class="fas fa-xmark"></i></button>
                    </div>
                    <div class="continue-info">
                        <h3 class="continue-title">${cleanTitle(entry.titulo)}</h3>
                        ${resumeLabel}
                    </div>`

                card.addEventListener("click", e => {
                    if (e.target.closest(".continue-remove")) return
                    let url = FGPUrl.buildDetailUrl(entry.type, entry.id)
                    if (isSerie && entry.seasonIdx !== undefined && entry.epIdx !== undefined) {
                        url += `&sn=${entry.seasonIdx}&ep=${entry.epIdx}`
                    }
                    window.navigateTo(url)
                })
                card.addEventListener("keydown", e => {
                    if (e.key === "Enter") card.click()
                })
                card.querySelector(".continue-remove").addEventListener("click", e => {
                    e.stopPropagation()
                    window.FGPHistory.remove(entry.type, entry.id)
                    buildCards()
                    if (window.FGPHistory.listAll().length === 0) section.remove()
                })

                row.appendChild(card)
            })
        }
        buildCards()

        header.querySelector("#history-clear-btn").addEventListener("click", () => {
            window.FGPHistory.clear()
            section.remove()
        })

        section.appendChild(row)
        // Idempotente: si ya existía una fila previa (p. ej. restauración desde
        // la caché del navegador), se reemplaza; siempre queda arriba del todo
        const existing = contentContainer.querySelector(".continue-section")
        if (existing) existing.remove()
        contentContainer.prepend(section)
    }

    function shuffleArray(array) {
        if (!array || array.length === 0) return array
        const shuffled = [...array]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
    }

    function renderSkeletonRows(count = 2) {
        for (let i = 0; i < count; i++) {
            const row = document.createElement("div")
            row.className = "skeleton-row"
            row.innerHTML = '<div class="skeleton-card"></div>'.repeat(8)
            contentContainer.appendChild(row)
        }
    }

    function clearSkeletons() {
        contentContainer.querySelectorAll(".skeleton-row").forEach(el => el.remove())
    }

    async function organizeContentByGenre(type) {
        const apiUrl = type === "movies" ? apiUrlMovies : apiUrlSeries
        renderSkeletonRows(2)

        // Estrenos (año actual o anterior)
        try {
            const currentYear = new Date().getFullYear()
            let releaseContent = []

            const cacheKey = `releases_${type}_${currentYear}`
            let currentYearData = getFromCache(cacheKey)

            if (!currentYearData) {
                currentYearData = await fetchWithCache(`${apiUrl}?search=ano=${currentYear}&limit=20&random=true`)
                saveToCache(cacheKey, currentYearData)
            }

            if (currentYearData.success && currentYearData.data.length > 0) {
                releaseContent = currentYearData.data
            } else {
                const previousYear = currentYear - 1
                const previousCacheKey = `releases_${type}_${previousYear}`
                let previousYearData = getFromCache(previousCacheKey)

                if (!previousYearData) {
                    previousYearData = await fetchWithCache(`${apiUrl}?search=ano=${previousYear}&limit=20&random=true`)
                    saveToCache(previousCacheKey, previousYearData)
                }

                if (previousYearData.success && previousYearData.data.length > 0) {
                    releaseContent = previousYearData.data
                }
            }

            if (releaseContent.length > 0) {
                rememberItems(type, releaseContent)
                const yearShown = releaseContent[0].ano || currentYear
                createGenreSection(`Estrenos ${yearShown}`, shuffleArray(releaseContent), "fas fa-fire", type)
                clearSkeletons()
            }
        } catch (error) { /* continuar con géneros */ }

        const initialGenres = allGenres.slice(0, 3)
        const remainingGenres = allGenres.slice(3)

        await Promise.all(initialGenres.map(genre => loadGenreContent(genre, type)))
        remainingGenres.forEach(genre => loadGenreContent(genre, type))
    }

    async function loadGenreContent(genre, type) {
        if (genreCache[type][genre]) {
            createGenreSection(genre, shuffleArray(genreCache[type][genre]), getGenreIcon(genre), type)
            return
        }

        try {
            const apiUrl = type === "movies" ? apiUrlMovies : apiUrlSeries
            const data = await fetchWithCache(`${apiUrl}?search=generos=${encodeURIComponent(genre)}&limit=20&random=true`)

            if (data.success && data.data.length > 0) {
                genreCache[type][genre] = data.data
                rememberItems(type, data.data)
                createGenreSection(genre, shuffleArray(data.data), getGenreIcon(genre), type)
            }
        } catch (error) { /* omitir género */ }
    }

    function createGenreSection(genreTitle, content, icon = "fas fa-film", type, wideOverride = null) {
        // Mientras se construye la vista de una pestaña, guardar qué filas
        // la componen para poder restaurarla al instante más tarde
        const sectionIndex = genreCollector ? genreCollector.length : 0
        const sectionWide = wideOverride !== null ? wideOverride : sectionIndex % 4 === 3
        if (genreCollector) genreCollector.push({ genreTitle, content: content.slice(), icon, wide: sectionWide })
        // La mezcla es por CATEGORÍA completa: 3 filas de pósters y luego una
        // fila entera de miniaturas (el ciclo se repite)
        const section = document.createElement("div")
        section.className = "genre-section fadeInUp"

        const sectionHeader = document.createElement("div")
        sectionHeader.className = "section-header"

        const title = document.createElement("h2")
        title.className = "section-title"
        title.innerHTML = `<i class="${icon}"></i> ${genreTitle}`

        const carouselNav = document.createElement("div")
        carouselNav.className = "carousel-nav"

        const prevBtn = document.createElement("button")
        prevBtn.className = "carousel-btn"
        prevBtn.setAttribute("aria-label", "Anterior")
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>'

        const nextBtn = document.createElement("button")
        nextBtn.className = "carousel-btn"
        nextBtn.setAttribute("aria-label", "Siguiente")
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>'

        carouselNav.appendChild(prevBtn)
        carouselNav.appendChild(nextBtn)

        sectionHeader.appendChild(title)
        sectionHeader.appendChild(carouselNav)

        const row = document.createElement("div")
        row.className = "movies-row"

        content.slice(0, 20).forEach(item => {
            const card = document.createElement("div")
            const rating = stableRating(getItemId(item))

            if (sectionWide) {
                // Fila de miniaturas: tarjetas horizontales 16:9 idénticas a
                // las de "Continuar viendo" (mismo CSS, no el de los pósters)
                card.className = "continue-card"
                card.innerHTML = `
                    <div class="continue-thumb-wrap">
                        <img class="continue-thumb" src="${item.miniature || item.post}" alt="${cleanTitle(item.titulo)}" loading="lazy">
                        <span class="continue-type-badge"><i class="fas ${type === "movies" ? "fa-film" : "fa-tv"}"></i> ${type === "movies" ? "Película" : "Serie"}</span>
                    </div>
                    <div class="continue-info">
                        <h3 class="continue-title">${cleanTitle(item.titulo)}</h3>
                        <span class="genre-mini-meta"><i class="fas fa-star"></i> ${rating} · <i class="far fa-calendar-alt"></i> ${item.ano || ""}</span>
                    </div>`
            } else {
                card.className = "movie-card"
                card.innerHTML = `
                    <div class="movie-poster-container">
                        <img class="movie-poster" src="${item.post}" alt="${cleanTitle(item.titulo)}" loading="lazy">
                        <div class="movie-overlay">
                            <button class="movie-play-btn" aria-label="Ver ${cleanTitle(item.titulo)}">
                                <i class="fas fa-play"></i>
                            </button>
                        </div>
                        <span class="movie-type"><i class="fas ${type === "movies" ? "fa-film" : "fa-tv"}"></i> ${type === "movies" ? "Película" : "Serie"}</span>
                    </div>
                    <div class="movie-info">
                        <h3 class="movie-title">${cleanTitle(item.titulo)}</h3>
                        <div class="movie-meta">
                            <div class="movie-rating">
                                <i class="fas fa-star"></i>
                                <span>${rating}</span>
                            </div>
                            <div class="movie-year">
                                <i class="far fa-calendar-alt"></i>
                                <span>${item.ano || ""}</span>
                            </div>
                        </div>
                    </div>`
            }

            card.addEventListener("click", () => openDetails(type, item))
            row.appendChild(card)
        })

        prevBtn.addEventListener("click", () => row.scrollBy({ left: -600, behavior: "smooth" }))
        nextBtn.addEventListener("click", () => row.scrollBy({ left: 600, behavior: "smooth" }))

        section.appendChild(sectionHeader)
        section.appendChild(row)
        contentContainer.appendChild(section)
    }

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    // ============================================================
    // Búsqueda
    // ============================================================
    async function searchContent(query) {
        isSearchActive = true
        loadingElement.style.display = "flex"
        contentContainer.innerHTML = ""
        heroSection.style.display = "none"
        tabs.style.display = "none"

        try {
            const dataMovies = await fetchWithCache(`${apiUrlMovies}?search=titulo=${encodeURIComponent(query)}`)
            const dataSeries = await fetchWithCache(`${apiUrlSeries}?search=titulo=${encodeURIComponent(query)}`)

            const hasMovies = dataMovies.success && dataMovies.data.length > 0
            const hasSeries = dataSeries.success && dataSeries.data.length > 0

            if (hasMovies || hasSeries) {
                if (hasMovies) {
                    rememberItems("movies", dataMovies.data)
                    createGenreSection(`Películas para: "${query}"`, dataMovies.data, "fas fa-film", "movies")
                }
                if (hasSeries) {
                    rememberItems("series", dataSeries.data)
                    createGenreSection(`Series para: "${query}"`, dataSeries.data, "fas fa-tv", "series")
                }

                const backButton = document.createElement("div")
                backButton.style.textAlign = "center"
                backButton.style.margin = "30px 0"
                backButton.innerHTML = `
                    <button class="btn btn-glass">
                        <i class="fas fa-arrow-left"></i> Volver al inicio
                    </button>`
                backButton.querySelector("button").addEventListener("click", volverAlInicio)
                contentContainer.appendChild(backButton)
            } else {
                contentContainer.innerHTML = `
                    <div class="empty-state fadeInUp">
                        <i class="fas fa-search"></i>
                        <h2>No se encontraron resultados para "${query}"</h2>
                        <p>Intenta con otro término de búsqueda o explora nuestras categorías.</p>
                        <button class="btn btn-primary" id="back-home-btn">
                            <i class="fas fa-home"></i> Volver al inicio
                        </button>
                    </div>`
                document.getElementById("back-home-btn").addEventListener("click", volverAlInicio)
            }
        } catch (error) {
            contentContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-wifi"></i>
                    <h2>Error al buscar</h2>
                    <p>Por favor, intenta de nuevo más tarde.</p>
                </div>`
        } finally {
            isLoading = false
            loadingElement.style.display = "none"
        }
    }

    function volverAlInicio() {
        loadContent(currentContentType)
        searchInput.value = ""
        isSearchActive = false
    }
    window.volverAlInicio = volverAlInicio

    // Volver desde otra página usando la caché del navegador (BFCache): la
    // página se restaura tal cual estaba, SIN volver a ejecutar loadContent,
    // así que la fila de "Continuar viendo" quedaba desactualizada o faltaba.
    // Al restaurarse, refrescamos la fila y el estado del body.
    window.addEventListener("pageshow", e => {
        document.body.style.overflow = ""
        if (!e.persisted) return
        try {
            if (currentContentType !== "channels") renderContinueWatching()
        } catch (err) {}
    })

    searchBtn.addEventListener("click", () => {
        const query = searchInput.value.trim()
        if (query) {
            searchContent(query)
        } else {
            volverAlInicio()
        }
    })

    searchInput.addEventListener("keypress", e => {
        if (e.key === "Enter") {
            const query = searchInput.value.trim()
            if (query) {
                searchContent(query)
            } else {
                volverAlInicio()
            }
        }
    })

    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            navTabs.forEach(t => t.classList.remove("active"))
            tab.classList.add("active")
            const contentType = tab.getAttribute("data-content")

            // Sin limpiar cachés: cambiar de pestaña reutiliza la vista
            // construida (viewData) y no vuelve a cargar todo el index
            if (contentType !== "channels") {
                currentCountryChannels = []
            }
            loadContent(contentType)
        })
    })

    // ============================================================
    // Modal de géneros
    // ============================================================
    const genresModal = document.getElementById("genres-modal")
    const genresModalClose = document.getElementById("genres-modal-close")

    function loadGenresModal() {
        const genresGrid = document.querySelector(".genres-grid")
        genresGrid.innerHTML = ""

        allGenres.forEach(genre => {
            const genreCard = document.createElement("div")
            genreCard.className = "genre-card"

            const icon = getGenreIcon(genre)

            genreCard.innerHTML = `
                <div class="genre-icon"><i class="${icon}"></i></div>
                <div class="genre-name">${genre}</div>`

            genreCard.addEventListener("click", async () => {
                genresModal.style.display = "none"
                document.body.style.overflow = "auto"

                contentContainer.innerHTML = ""
                heroSection.style.display = "none"
                loadingElement.style.display = "flex"

                try {
                    const apiUrl = currentContentType === "movies" ? apiUrlMovies : apiUrlSeries
                    const cacheKey = `genre_detail_${currentContentType}_${genre}`
                    let data = getFromCache(cacheKey)

                    if (!data) {
                        const response = await fetch(`${apiUrl}?search=generos=${encodeURIComponent(genre)}&limit=50`)
                        data = await response.json()
                        if (data.success) saveToCache(cacheKey, data)
                    }

                    loadingElement.style.display = "none"

                    if (data.success && data.data.length > 0) {
                        rememberItems(currentContentType, data.data)
                        createGenreSection(genre, data.data, icon, currentContentType)

                        const backButton = document.createElement("div")
                        backButton.style.textAlign = "center"
                        backButton.style.margin = "30px 0"
                        backButton.innerHTML = `<button class="btn btn-glass"><i class="fas fa-home"></i> Volver al inicio</button>`
                        backButton.querySelector("button").addEventListener("click", volverAlInicio)
                        contentContainer.appendChild(backButton)
                    } else {
                        contentContainer.innerHTML = `
                            <div class="empty-state fadeInUp">
                                <i class="${icon}"></i>
                                <h2>No se encontraron resultados para "${genre}"</h2>
                                <p>Intenta con otro género o explora nuestras categorías.</p>
                                <button class="btn btn-primary" id="back-home-btn2">
                                    <i class="fas fa-home"></i> Volver al inicio
                                </button>
                            </div>`
                        document.getElementById("back-home-btn2").addEventListener("click", volverAlInicio)
                    }
                } catch (error) {
                    loadingElement.style.display = "none"
                    contentContainer.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-wifi"></i>
                            <h2>Error al cargar el género</h2>
                            <p>Por favor, intenta de nuevo más tarde.</p>
                        </div>`
                }
            })

            genresGrid.appendChild(genreCard)
        })
    }

    feedbackBtn.addEventListener("click", () => {
        const email = document.querySelector(".newsletter-input").value.trim()
        if (email) {
            window.location.href = `mailto:filmsgapsplusdevelopers@gmail.com?subject=Feedback%20FilmsGapsPlus&body=Mi%20correo:%20${email}%0A%0AMi%20feedback:%20`
        } else {
            window.open("mailto:filmsgapsplusdevelopers@gmail.com?subject=Feedback%20FilmsGapsPlus", "_blank")
        }
    })

    function abrirModalGeneros() {
        loadGenresModal()
        genresModal.style.display = "block"
        document.body.style.overflow = "hidden"
    }

    // El enlace del footer dispara este evento en el index; en otras páginas
    // navega hacia index.html#generos y aquí se abre al aterrizar
    document.addEventListener("fgp:open-genres", abrirModalGeneros)
    if (location.hash === "#generos" || location.hash === "#genres") {
        const abrirCuandoListo = intentos => {
            if (Array.isArray(allGenres) && allGenres.length > 0) {
                abrirModalGeneros()
                history.replaceState(null, "", location.pathname)
            } else if (intentos < 40) {
                setTimeout(() => abrirCuandoListo(intentos + 1), 150)
            }
        }
        abrirCuandoListo(0)
    }

    genresModalClose.addEventListener("click", () => {
        genresModal.style.display = "none"
        document.body.style.overflow = "auto"
    })

    window.addEventListener("click", e => {
        if (e.target === genresModal) {
            genresModal.style.display = "none"
            document.body.style.overflow = "auto"
        }
    })

    // Cerrar reproductor de canal con Escape
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            if (channelPlayerContainer.classList.contains("open")) closeChannelPlayer()
            if (countriesModal.style.display === "block") closeCountriesModal()
            if (genresModal.style.display === "block") {
                genresModal.style.display = "none"
                document.body.style.overflow = "auto"
            }
        }
    })

    // Inicializar la aplicación
    initializeApp()
})
