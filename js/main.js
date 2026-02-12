document.addEventListener("DOMContentLoaded", () => {
    // Elementos del DOM
    const heroSection = document.getElementById("hero-section")
    const contentContainer = document.getElementById("content-container")
    const loadingElement = document.getElementById("loading")
    const searchInput = document.getElementById("search-input")
    const searchBtn = document.getElementById("search-btn")
    const movieModal = document.getElementById("movie-modal")
    const modalClose = document.getElementById("modal-close")
    const navTabs = document.querySelectorAll(".nav-tab")
    const tabs = document.getElementById("tabs")
    const playerContainer = document.getElementById("player-container")
    const playerIframe = document.getElementById("player-iframe")
    const playerClose = document.getElementById("player-close")
    const playerTitle = document.getElementById("player-title")
    const feedbackBtn = document.getElementById("feedback-btn")

    const channelPlayerContainer = document.getElementById("channel-player-container")
    const channelVideo = document.getElementById("channel-video")
    const channelPlayerClose = document.getElementById("channel-player-close")
    const channelPlayerTitle = document.getElementById("channel-player-title")
    const channelPlayerLogo = document.getElementById("channel-player-logo")
    const channelVideoLoading = document.getElementById("channel-video-loading")
    const channelVideoError = document.getElementById("channel-video-error")
    const channelRetryBtn = document.getElementById("channel-retry-btn")

    const countriesModal = document.getElementById("countries-modal")
    const countriesModalClose = document.getElementById("countries-modal-close")
    const countriesGridModal = document.getElementById("countries-grid-modal")
    const countriesSearch = document.getElementById("countries-search")

    // URL base inicial
    let apiBaseUrl = "https://anusdbs.onrender.com";

    // Variables para las URLs de la API
    let apiUrlMovies = "";
    let apiUrlSeries = "";
    let apiUrlChannels = "";
    let apiUrlChannelsByIso = "";

    const apiUrlIpCountry = "https://api.ipaddress.com/iptocountry?format=json"

    // Configuración del caché
    const CACHE_DURATION = 72 * 60 * 60 * 1000; // 72 horas
    const CACHE_PREFIX = 'filmsgapsplus_';

    // ========== LOCAL STORAGE PARA PROGRESO DE EPISODIOS ==========
    const STORAGE_KEY_PROGRESS = 'filmsgapsplus_series_progress';

    // Función para obtener el progreso de episodios
    function getEpisodeProgress(serieId, seasonNum, episodeNum) {
        try {
            const progressData = localStorage.getItem(STORAGE_KEY_PROGRESS);
            if (!progressData) return null;

            const data = JSON.parse(progressData);
            const key = `${serieId}_S${seasonNum}E${episodeNum}`;
            return data[key] || null;
        } catch (error) {
            console.error('Error al obtener progreso:', error);
            return null;
        }
    }

    // Función para guardar el progreso de un episodio
    function saveEpisodeProgress(serieId, seasonNum, episodeNum, episodeTitle, timestamp) {
        try {
            const progressData = localStorage.getItem(STORAGE_KEY_PROGRESS) || '{}';
            const data = JSON.parse(progressData);

            const key = `${serieId}_S${seasonNum}E${episodeNum}`;
            data[key] = {
                serieId,
                seasonNum,
                episodeNum,
                episodeTitle,
                timestamp: timestamp || Date.now(),
                lastWatched: new Date().toISOString()
            };

            localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error al guardar progreso:', error);
            return false;
        }
    }

    // Función para eliminar progreso de un episodio
    function clearEpisodeProgress(serieId, seasonNum, episodeNum) {
        try {
            const progressData = localStorage.getItem(STORAGE_KEY_PROGRESS) || '{}';
            const data = JSON.parse(progressData);

            const key = `${serieId}_S${seasonNum}E${episodeNum}`;
            delete data[key];

            localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error al eliminar progreso:', error);
            return false;
        }
    }

    // Función para obtener todos los episodios vistos
    function getAllWatchedEpisodes() {
        try {
            const progressData = localStorage.getItem(STORAGE_KEY_PROGRESS);
            return progressData ? JSON.parse(progressData) : {};
        } catch (error) {
            console.error('Error al obtener episodios vistos:', error);
            return {};
        }
    }

    // Funciones para manejar el caché
    function getFromCache(key) {
        try {
            const cacheKey = CACHE_PREFIX + key;
            const cachedData = localStorage.getItem(cacheKey);
            if (!cachedData) return null;
            const { data, timestamp } = JSON.parse(cachedData);
            if (Date.now() - timestamp > CACHE_DURATION) {
                localStorage.removeItem(cacheKey);
                return null;
            }
            return data;
        } catch (error) {
            return null;
        }
    }

    function saveToCache(key, data) {
        try {
            const cacheKey = CACHE_PREFIX + key;
            const cacheData = { data, timestamp: Date.now() };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            // Silenciar errores de caché
        }
    }

    function clearExpiredCache() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CACHE_PREFIX)) {
                    try {
                        const cachedData = JSON.parse(localStorage.getItem(key));
                        if (Date.now() - cachedData.timestamp > CACHE_DURATION) {
                            keysToRemove.push(key);
                        }
                    } catch (e) {
                        keysToRemove.push(key);
                    }
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            // Silenciar errores
        }
    }

    clearExpiredCache();

    function initializeApiUrls() {
        apiUrlMovies = `${apiBaseUrl}/api/movies`;
        apiUrlSeries = `${apiBaseUrl}/api/series`;
        apiUrlChannels = `${apiBaseUrl}/api/channels`;
        apiUrlChannelsByIso = `${apiBaseUrl}/api/channels/iso/`;
    }

    function getApiUrl(type) {
        return type === "movies" ? apiUrlMovies : apiUrlSeries;
    }

    const allGenres = [
        "Accion", "Animacion", "Anime", "Aventura", "Belica", "Ciencia Ficcion",
        "Comedia", "Crimen", "Documental", "Drama", "Familia", "Fantasia",
        "Historia", "Infantil", "Misterio", "Musica", "News", "Película de TV",
        "Politica", "Reality", "Romance", "Suspenso", "Talk", "Telenovela",
        "Terror", "Western",
    ]

    let isLoading = false
    let featuredContent = null
    let searchResultsMovies = []
    let searchResultsSeries = []
    let isSearchActive = false
    let currentContentType = "movies"

    let genreCache = { movies: {}, series: {} }

    let allCountries = []
    let currentCountryIso = null
    let currentCountryChannels = []
    let userCountryIso = null
    let hlsInstance = null
    let currentChannelUrl = null

    const Hls = window.Hls

    async function fetchWithCache(url, options = {}) {
        const cacheKey = `fetch_${url}_${JSON.stringify(options)}`;
        const cachedData = getFromCache(cacheKey);
        if (cachedData) return cachedData;

        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            saveToCache(cacheKey, data);
            return data;
        } catch (error) {
            const oldCachedData = getFromCache(cacheKey);
            if (oldCachedData) return oldCachedData;
            throw error;
        }
    }

    async function checkUrlAvailability(url) {
        try {
            const faviconUrl = `${url}/favicon.ico`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(faviconUrl, { method: 'HEAD', signal: controller.signal, cache: 'no-cache' });
            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async function initializeApp() {
        try {
            loadingElement.style.display = "flex";
            heroSection.style.display = "none";
            contentContainer.style.display = "none";
            tabs.style.display = "none";

            const response = await fetch("https://filmsgapsplus.github.io/web/cloudflared.json");
            const data = await response.json();

            if (data.server_url) {
                const isRemoteAvailable = await checkUrlAvailability(data.server_url);
                if (isRemoteAvailable) apiBaseUrl = data.server_url;
            }
            initializeApiUrls();
            loadContent("movies");
        } catch (err) {
            initializeApiUrls();
            loadContent("movies");
        }
    }

    async function loadContent(type) {
        currentContentType = type
        isLoading = true
        isSearchActive = false

        heroSection.style.display = "none"
        contentContainer.style.display = "none"
        tabs.style.display = "none"
        loadingElement.style.display = "flex"
        contentContainer.innerHTML = ""

        try {
            if (type === "channels") {
                await loadChannelsSection()
            } else {
                await loadFeaturedContent(type)
                await organizeContentByGenre(type)
            }
        } catch (error) {
            contentContainer.innerHTML = `<p>Error al cargar el contenido. Por favor, intenta de nuevo más tarde.</p>`
        } finally {
            isLoading = false
            loadingElement.style.display = "none"
            tabs.style.display = "flex"
            if (type !== "channels") heroSection.style.display = "block"
            contentContainer.style.display = "block"
            scrollToTop()
        }
    }

    async function loadFeaturedContent(type) {
        try {
            const apiUrl = getApiUrl(type)
            const data = await fetchWithCache(`${apiUrl}?limit=1&random=true`)
            if (data.success && data.data.length > 0) {
                featuredContent = data.data[0]
                updateHeroSection(featuredContent, type)
            }
        } catch (error) {
            // Silenciar error
        }
    }

    async function loadChannelsSection() {
        try {
            if (!userCountryIso) {
                try {
                    const ipResponse = await fetch(apiUrlIpCountry);
                    const ipData = await ipResponse.json();
                    userCountryIso = ipData.country_code.toLowerCase();
                } catch (e) {
                    userCountryIso = "us";
                }
            }

            if (allCountries.length === 0) {
                const countriesResponse = await fetch(apiUrlChannels);
                const countriesData = await countriesResponse.json();
                if (countriesData.success && countriesData.data.length > 0) {
                    allCountries = countriesData.data[0].countries;
                }
            }

            if (!currentCountryIso) {
                const userCountryExists = allCountries.find((c) => c.iso === userCountryIso);
                currentCountryIso = userCountryExists ? userCountryIso : allCountries[0]?.iso || "us";
            }

            await loadChannelsByCountry(currentCountryIso);
            renderChannelsUI();
        } catch (error) {
            contentContainer.innerHTML = `<p>Error al cargar los canales. Por favor, intenta de nuevo más tarde.</p>`;
        }
    }

    async function loadChannelsByCountry(iso) {
        try {
            const response = await fetch(`${apiUrlChannelsByIso}${iso}`)
            const data = await response.json()
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

    function renderChannelsUI() {
        contentContainer.innerHTML = ""
        const currentCountry = allCountries.find((c) => c.iso === currentCountryIso)

        const channelsSection = document.createElement("div")
        channelsSection.className = "channels-section fadeInUp"
        channelsSection.innerHTML = `
        <div class="channels-header-container">
            <div class="channels-header-left">
                <h2 class="countries-title"><i class="fas fa-globe"></i> Canales de TV en Vivo</h2>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                    Transmisiones en directo de canales de todo el mundo
                </p>
            </div>
            <div class="channels-header-right">
                <button class="country-selector-btn" id="open-countries-modal">
                    <span class="country-flag">${currentCountry?.flag || "🌍"}</span>
                    <div class="country-details">
                        <div class="country-name">${currentCountry?.name || "Seleccionar país"}</div>
                        <div class="country-channels-count">
                            <i class="fas fa-tv"></i> ${currentCountry?.server_count || 0} canales disponibles
                        </div>
                    </div>
                    <i class="fas fa-chevron-down change-country-icon"></i>
                </button>
            </div>
        </div>
        `
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
                <span style="font-size: 0.9rem; color: var(--text-muted); margin-left: 0.5rem;">
                    (${currentCountryChannels.length} disponibles)
                </span>
            </h2>
            `

            const channelsGridContainer = document.createElement("div")
            channelsGridContainer.className = "channels-grid"

            currentCountryChannels.forEach((channel) => {
                const channelCard = document.createElement("div")
                channelCard.className = "channel-card"
                channelCard.innerHTML = `
                <div class="channel-logo-container">
                    <img class="channel-logo" src="${channel.logo}" alt="${channel.titulo}" loading="lazy"
                        onerror="this.src='/tv-channel-logo.jpg'">
                    <div class="channel-overlay">
                        <button class="channel-play-btn">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                    <div class="channel-live-badge">EN VIVO</div>
                    ${channel.calidad ? `<div class="channel-quality">${channel.calidad}</div>` : ""}
                </div>
                <div class="channel-info">
                    <h3 class="channel-title">${channel.titulo}</h3>
                    <div class="channel-meta">
                        <span><i class="fas fa-signal"></i> Streaming</span>
                    </div>
                </div>
                `
                channelCard.addEventListener("click", () => playChannel(channel))
                channelsGridContainer.appendChild(channelCard)
            })

            channelsGrid.appendChild(channelsHeader)
            channelsGrid.appendChild(channelsGridContainer)
            contentContainer.appendChild(channelsGrid)
        } else {
            const noChannels = document.createElement("div")
            noChannels.className = "fadeInUp"
            noChannels.style.textAlign = "center"
            noChannels.style.padding = "3rem 1rem"
            noChannels.innerHTML = `
            <i class="fas fa-tv" style="font-size: 3rem; color: var(--accent-color); margin-bottom: 1rem;"></i>
            <h2>No hay canales disponibles</h2>
            <p style="color: var(--text-secondary); margin: 1rem 0;">
                No se encontraron canales para este país. Intenta seleccionar otro país.
            </p>
            <button class="btn btn-primary" id="select-another-country">
                <i class="fas fa-globe"></i> Seleccionar otro país
            </button>
            `
            contentContainer.appendChild(noChannels)
            const selectAnotherBtn = document.getElementById("select-another-country")
            if (selectAnotherBtn) selectAnotherBtn.addEventListener("click", openCountriesModal)
        }
    }

    function openCountriesModal() {
        countriesModal.style.display = "block"
        document.body.style.overflow = "hidden"
        renderCountriesInModal()
        if (countriesSearch) {
            countriesSearch.value = ""
            countriesSearch.focus()
        }
    }

    function closeCountriesModal() {
        countriesModal.style.display = "none"
        document.body.style.overflow = "auto"
    }

    function renderCountriesInModal(filter = "") {
        if (!countriesGridModal) return
        countriesGridModal.innerHTML = ""

        const filteredCountries = filter
            ? allCountries.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
            : allCountries

        if (filteredCountries.length === 0) {
            countriesGridModal.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                No se encontraron países con "${filter}"
            </div>
            `
            return
        }

        filteredCountries.forEach((country) => {
            const countryCard = document.createElement("div")
            countryCard.className = `country-card-modal ${country.iso === currentCountryIso ? "active" : ""}`
            countryCard.innerHTML = `
            <span class="country-flag">${country.flag}</span>
            <div class="country-info">
                <div class="country-name">${country.name}</div>
                <div class="country-channels">
                    <i class="fas fa-tv"></i> ${country.server_count} canales
                </div>
            </div>
            `
            countryCard.addEventListener("click", async () => {
                if (country.iso !== currentCountryIso) {
                    closeCountriesModal()
                    loadingElement.style.display = "flex"
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

    if (countriesModalClose) countriesModalClose.addEventListener("click", closeCountriesModal)
    if (countriesModal) {
        countriesModal.addEventListener("click", (e) => {
            if (e.target === countriesModal) closeCountriesModal()
        })
    }
    if (countriesSearch) {
        countriesSearch.addEventListener("input", (e) => renderCountriesInModal(e.target.value))
    }

    function playChannel(channel) {
        currentChannelUrl = channel.url
        channelPlayerContainer.style.display = "block"
        document.body.style.overflow = "hidden"

        channelPlayerTitle.innerHTML = `<i class="fas fa-broadcast-tower"></i> <span>${channel.titulo}</span>`
        channelPlayerLogo.src = channel.logo
        channelPlayerLogo.onerror = function () { this.src = "/tv-channel-logo.jpg" }

        channelVideoLoading.style.display = "flex"
        channelVideoError.style.display = "none"

        if (hlsInstance) {
            hlsInstance.destroy()
            hlsInstance = null
        }

        if (Hls && Hls.isSupported()) {
            hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 })
            hlsInstance.loadSource(channel.url)
            hlsInstance.attachMedia(channelVideo)
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                channelVideoLoading.style.display = "none"
                channelVideo.play().catch(() => { })
            })
            hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR: hlsInstance.startLoad(); break
                        case Hls.ErrorTypes.MEDIA_ERROR: hlsInstance.recoverMediaError(); break
                        default:
                            channelVideoLoading.style.display = "none"
                            channelVideoError.style.display = "flex"
                            break
                    }
                }
            })
        } else if (channelVideo.canPlayType("application/vnd.apple.mpegurl")) {
            channelVideo.src = channel.url
            channelVideo.addEventListener("loadedmetadata", () => {
                channelVideoLoading.style.display = "none"
                channelVideo.play()
            })
            channelVideo.addEventListener("error", () => {
                channelVideoLoading.style.display = "none"
                channelVideoError.style.display = "flex"
            })
        } else {
            channelVideoLoading.style.display = "none"
            channelVideoError.style.display = "flex"
        }
    }

    function closeChannelPlayer() {
        channelPlayerContainer.style.display = "none"
        document.body.style.overflow = "auto"
        if (hlsInstance) {
            hlsInstance.destroy()
            hlsInstance = null
        }
        channelVideo.pause()
        channelVideo.src = ""
        currentChannelUrl = null
    }

    if (channelPlayerClose) channelPlayerClose.addEventListener("click", closeChannelPlayer)
    if (channelRetryBtn) {
        channelRetryBtn.addEventListener("click", () => {
            if (currentChannelUrl) {
                const channel = currentCountryChannels.find((c) => c.url === currentChannelUrl)
                if (channel) playChannel(channel)
            }
        })
    }
    if (channelPlayerContainer) {
        channelPlayerContainer.addEventListener("click", (e) => {
            if (e.target === channelPlayerContainer) closeChannelPlayer()
        })
    }

    function updateHeroSection(content, type) {
        if (!content) return
        heroSection.innerHTML = `
        <img class="hero-backdrop" src="${content.miniature || content.post}" alt="${content.titulo}">
        <div class="hero-overlay"></div>
        <div class="hero-content fadeInUp">
            <h1 class="hero-title">${content.titulo}</h1>
            <div class="hero-meta">
                <span><i class="far fa-calendar-alt"></i> ${content.ano}</span>
                ${content.duracion ? `<span><i class="far fa-clock"></i> ${content.duracion}</span>` : ""}
                <span><i class="fas fa-star"></i> ${(Math.random() * 2 + 7).toFixed(1)}</span>
                <span><i class="fas fa-tag"></i> ${type === "movies" ? "Película" : "Serie"}</span>
            </div>
            <div class="hero-buttons">
                <button class="btn btn-red" onclick="window.openContentModalByContent('${type}', ${JSON.stringify(content).replace(/"/g, "&quot;")})">
                    <i class="fas fa-play"></i> Ver ahora
                </button>
            </div>
        </div>
        `
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

    async function organizeContentByGenre(type) {
        const apiUrl = getApiUrl(type)
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
                const yearShown = releaseContent[0].ano || currentYear
                const shuffledReleases = shuffleArray(releaseContent)
                createGenreSection(`Estrenos ${yearShown}`, shuffledReleases, "fas fa-fire", type)
            }
        } catch (error) { }

        const initialGenres = allGenres.slice(0, 3)
        const remainingGenres = allGenres.slice(3)
        await Promise.all(initialGenres.map(genre => loadGenreContent(genre, type)))
        for (const genre of remainingGenres) {
            loadGenreContent(genre, type)
        }
    }

    async function loadGenreContent(genre, type) {
        const cacheKey = `${type}_${genre}`
        if (genreCache[type][genre]) {
            const shuffledContent = shuffleArray(genreCache[type][genre])
            createGenreSection(genre, shuffledContent, getGenreIcon(genre), type)
            return
        }
        try {
            const apiUrl = getApiUrl(type)
            const data = await fetchWithCache(`${apiUrl}?search=generos=${encodeURIComponent(genre)}&limit=20&random=true`)
            if (data.success && data.data.length > 0) {
                genreCache[type][genre] = data.data
                const shuffledContent = shuffleArray(data.data)
                createGenreSection(genre, shuffledContent, getGenreIcon(genre), type)
            }
        } catch (error) { }
    }

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

    function createGenreSection(genreTitle, content, icon = "fas fa-film", type) {
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
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>'

        const nextBtn = document.createElement("button")
        nextBtn.className = "carousel-btn"
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>'

        const seeAll = document.createElement("a")
        seeAll.className = "see-all"
        seeAll.href = "#"

        carouselNav.appendChild(prevBtn)
        carouselNav.appendChild(nextBtn)
        carouselNav.appendChild(seeAll)

        sectionHeader.appendChild(title)
        sectionHeader.appendChild(carouselNav)

        const row = document.createElement("div")
        row.className = "movies-row"

        content.slice(0, 20).forEach((item) => {
            const card = document.createElement("div")
            card.className = "movie-card"
            const rating = (Math.random() * 2 + 7).toFixed(1)
            card.innerHTML = `
            <div class="movie-poster-container">
                <img class="movie-poster" src="${item.post}" alt="${item.titulo}" loading="lazy">
                <div class="movie-overlay">
                    <button class="movie-play-btn">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <div class="movie-type">${type === "movies" ? "PELÍCULA" : "SERIE"}</div>
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${item.titulo}</h3>
                <div class="movie-meta">
                    <div class="movie-rating">
                        <i class="fas fa-star"></i>
                        <span>${rating}</span>
                    </div>
                    <div class="movie-year">
                        <i class="far fa-calendar-alt"></i>
                        <span>${item.ano}</span>
                    </div>
                </div>
            </div>
            `
            card.addEventListener("click", () => window.openContentModalByContent(type, item))
            row.appendChild(card)
        })

        prevBtn.addEventListener("click", () => row.scrollBy({ left: -600, behavior: "smooth" }))
        nextBtn.addEventListener("click", () => row.scrollBy({ left: 600, behavior: "smooth" }))

        section.appendChild(sectionHeader)
        section.appendChild(row)
        contentContainer.appendChild(section)
    }

    function scrollToTop() {
        if ("scrollBehavior" in document.documentElement.style) {
            window.scrollTo({ top: 0, behavior: "smooth" })
        } else {
            const scrollDuration = 500
            const scrollStep = -window.scrollY / (scrollDuration / 15)
            const scrollInterval = setInterval(() => {
                if (window.scrollY !== 0) window.scrollBy(0, scrollStep)
                else clearInterval(scrollInterval)
            }, 15)
        }
    }

    async function searchContent(query) {
        isLoading = true
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
                    searchResultsMovies = dataMovies.data
                    createGenreSection(`Películas para: "${query}"`, dataMovies.data, "fas fa-film", "movies")
                }
                if (hasSeries) {
                    searchResultsSeries = dataSeries.data
                    createGenreSection(`Series para: "${query}"`, dataSeries.data, "fas fa-tv", "series")
                }
                const backButton = document.createElement("div")
                backButton.innerHTML = `
                <div style="text-align: center; margin: 30px 0;">
                    <button class="btn btn-primary" onclick="volverAlInicio()"
                        style="padding: 10px 20px; font-size: 1rem; border-radius: 0.5rem;">
                        <i class="fas fa-home"></i> Volver al inicio
                    </button>
                </div>
                `
                contentContainer.appendChild(backButton)
            } else {
                contentContainer.innerHTML = `
                <div class="fadeInUp" style="text-align: center; padding: 3rem 1rem;">
                    <i class="fas fa-search" style="font-size: 3rem; color: var(--accent-color); margin-bottom: 1rem;"></i>
                    <h2>No se encontraron resultados para "${query}"</h2>
                    <p style="color: var(--text-secondary); margin: 1rem 0;">Intenta con otro término de búsqueda o explora nuestras categorías.</p>
                    <button class="btn btn-primary" onclick="volverAlInicio()"
                        style="padding: 10px 20px; font-size: 1rem; border-radius: 0.5rem;">
                        <i class="fas fa-home"></i> Volver al inicio
                    </button>
                </div>
                `
            }
        } catch (error) {
            contentContainer.innerHTML = "<p>Error al buscar el contenido</p>"
        } finally {
            isLoading = false
            loadingElement.style.display = "none"
            tabs.style.display = "none"
        }
    }

    window.volverAlInicio = () => {
        loadContent(currentContentType)
        tabs.style.display = "flex"
        if (currentContentType !== "channels") heroSection.style.display = "block"
        searchInput.value = ""
        isSearchActive = false
    }

    // ========== FUNCIÓN MEJORADA PARA ABRIR MODAL ==========
    window.openContentModalByContent = (type, content) => {
        if (typeof content === 'string') content = JSON.parse(content.replace(/&quot;/g, '"'))
        if (!content) return

        // Elementos del modal
        const backdrop = document.getElementById("modal-backdrop")
        const poster = document.getElementById("modal-poster")
        const title = document.getElementById("modal-title")
        const yearSpan = document.getElementById("modal-year").querySelector("span")
        const durationSpan = document.getElementById("modal-duration")
        const durationText = document.getElementById("modal-duration").querySelector("span")
        const ratingSpan = document.getElementById("modal-rating").querySelector("span")
        const typeSpan = document.getElementById("modal-type").querySelector("span")
        const description = document.getElementById("modal-description")
        const typeBadge = document.getElementById("modal-type-badge")
        const movieServersSection = document.getElementById("movie-servers-section")
        const seriesSeasonsSection = document.getElementById("series-seasons-section")

        // Asignar valores
        backdrop.src = content.miniature || content.post
        poster.src = content.post
        title.textContent = content.titulo || "Sin título"
        yearSpan.textContent = content.ano || "Año desconocido"

        if (content.duracion) {
            durationSpan.style.display = "inline-flex"
            durationText.textContent = content.duracion
        } else {
            durationSpan.style.display = "none"
        }

        ratingSpan.textContent = (Math.random() * 2 + 7).toFixed(1)
        typeSpan.textContent = type === "movies" ? "Película" : "Serie"
        typeBadge.textContent = type === "movies" ? "PELÍCULA" : "SERIE"
        description.textContent = content.descripcion || "Sin descripción disponible."

        // Mostrar sección correspondiente
        movieServersSection.style.display = type === "movies" ? "block" : "none"
        seriesSeasonsSection.style.display = type === "series" ? "block" : "none"

        // Géneros
        const genresContainer = document.getElementById("modal-genres")
        genresContainer.innerHTML = ""
        if (content.generos) {
            const genres = typeof content.generos === "string" ? content.generos.split(" - ") : content.generos
            genres.forEach((genre) => {
                const genreTag = document.createElement("span")
                genreTag.className = "genre-tag"
                genreTag.textContent = genre
                genresContainer.appendChild(genreTag)
            })
        }

        // Reparto
        const castContainer = document.getElementById("cast-list")
        castContainer.innerHTML = ""
        if (content.actores && content.actores.length > 0) {
            content.actores.slice(0, 10).forEach((actor) => {
                const castMember = document.createElement("span")
                castMember.className = "cast-member"
                castMember.innerHTML = `<i class="fas fa-user-alt"></i> ${actor}`
                castContainer.appendChild(castMember)
            })
            if (content.actores.length > 10) {
                const moreCast = document.createElement("span")
                moreCast.className = "cast-member"
                moreCast.innerHTML = `<i class="fas fa-users"></i> +${content.actores.length - 10} más`
                castContainer.appendChild(moreCast)
            }
        } else {
            const noCast = document.createElement("p")
            noCast.textContent = "Información del reparto no disponible."
            noCast.style.color = "var(--text-muted)"
            castContainer.appendChild(noCast)
        }

        // Cargar contenido específico
        if (type === "movies") {
            loadMovieServers(content)
        } else {
            loadSeriesSeasons(content)
        }

        // Mostrar modal
        movieModal.style.display = "block"
        document.body.style.overflow = "hidden"
        movieModal.scrollTop = 0
    }

    // ========== FUNCIÓN MEJORADA PARA SERVIDORES DE PELÍCULAS ==========
    function loadMovieServers(movie) {
        const serverTabsContainer = document.getElementById("server-tabs")
        const serverContentsContainer = document.getElementById("server-contents-full")
        serverTabsContainer.innerHTML = ""
        serverContentsContainer.innerHTML = ""

        if (movie.servidores && movie.servidores.length > 0) {
            const serversByLanguage = {}
            movie.servidores.forEach((server) => {
                if (!serversByLanguage[server.idioma]) serversByLanguage[server.idioma] = []
                serversByLanguage[server.idioma].push(server)
            })

            let firstTab = true
            for (const [language, servers] of Object.entries(serversByLanguage)) {
                const tab = document.createElement("div")
                tab.className = `server-tab ${firstTab ? "active" : ""}`
                let langIcon = "fas fa-globe"
                if (language.toLowerCase().includes("español") || language.toLowerCase().includes("latino")) langIcon = "fas fa-language"
                else if (language.toLowerCase().includes("inglés") || language.toLowerCase().includes("english")) langIcon = "fas fa-language"
                else if (language.toLowerCase().includes("subtitulado")) langIcon = "fas fa-closed-captioning"
                tab.innerHTML = `<i class="${langIcon}"></i> ${language}`

                tab.addEventListener("click", () => {
                    document.querySelectorAll(".server-tab").forEach((t) => t.classList.remove("active"))
                    tab.classList.add("active")
                    document.querySelectorAll(".server-content").forEach((c) => c.classList.remove("active"))
                    document.getElementById(`server-content-${language.replace(/\s+/g, "-")}`).classList.add("active")
                })
                serverTabsContainer.appendChild(tab)

                const content = document.createElement("div")
                content.className = `server-content ${firstTab ? "active" : ""}`
                content.id = `server-content-${language.replace(/\s+/g, "-")}`

                servers.forEach((server) => {
                    const serverOption = document.createElement("div")
                    serverOption.className = "server-option"
                    let serverIcon = "fas fa-server"
                    if (server.nombre.toLowerCase().includes("mega")) serverIcon = "fas fa-cloud-download-alt"
                    else if (server.nombre.toLowerCase().includes("google")) serverIcon = "fab fa-google-drive"
                    else if (server.nombre.toLowerCase().includes("fembed")) serverIcon = "fas fa-play-circle"

                    serverOption.innerHTML = `
                    <div class="server-info">
                        <span class="server-name"><i class="${serverIcon}"></i> ${server.nombre}</span>
                        <div class="server-meta">
                            <span><i class="fas fa-video"></i> ${server.calidad}</span>
                            <span><i class="fas fa-closed-captioning"></i> ${server.idioma}</span>
                            <span><i class="fas fa-file-video"></i> ${server.tipo}</span>
                        </div>
                    </div>
                    <button class="watch-btn" data-url="${server.shorter}" data-title="${movie.titulo}">
                        <i class="fas fa-play"></i> Ver ahora
                    </button>
                    `
                    content.appendChild(serverOption)
                })
                serverContentsContainer.appendChild(content)
                firstTab = false
            }

            document.querySelectorAll(".watch-btn").forEach((btn) => {
                btn.addEventListener("click", (e) => {
                    const url = e.currentTarget.getAttribute("data-url")
                    if (url) window.open(url, "_blank")
                })
            })
        } else {
            serverTabsContainer.innerHTML = "<p>No hay servidores disponibles para esta película.</p>"
        }
    }

    // ========== FUNCIÓN MEJORADA PARA TEMPORADAS Y EPISODIOS CON PROGRESO ==========
    function loadSeriesSeasons(serie) {
        const seasonsTabsContainer = document.getElementById("seasons-tabs")
        const seasonsContentsContainer = document.getElementById("seasons-contents")
        seasonsTabsContainer.innerHTML = ""
        seasonsContentsContainer.innerHTML = ""

        if (serie.temporadas && serie.temporadas.length > 0) {
            let firstTab = true

            serie.temporadas.forEach((season) => {
                // Crear pestaña de temporada (vertical)
                const tab = document.createElement("div")
                tab.className = `season-tab ${firstTab ? "active" : ""}`
                tab.innerHTML = `<i class="fas fa-layer-group"></i> ${season.titulo}`

                tab.addEventListener("click", () => {
                    document.querySelectorAll(".season-tab").forEach((t) => t.classList.remove("active"))
                    tab.classList.add("active")
                    document.querySelectorAll(".season-content").forEach((c) => c.classList.remove("active"))
                    document.getElementById(`season-content-${season.numero}`).classList.add("active")
                })
                seasonsTabsContainer.appendChild(tab)

                // Crear contenido de la temporada
                const content = document.createElement("div")
                content.className = `season-content ${firstTab ? "active" : ""}`
                content.id = `season-content-${season.numero}`

                const episodeList = document.createElement("div")
                episodeList.className = "episode-list-full"

                if (season.episodios && season.episodios.length > 0) {
                    season.episodios.forEach((episode) => {
                        const serieId = serie.id || serie.titulo
                        const progress = getEpisodeProgress(serieId, season.numero, episode.numero)

                        const episodeItem = document.createElement("div")
                        episodeItem.className = `episode-item ${progress ? 'has-progress' : ''}`

                        // Header del episodio
                        const episodeHeader = document.createElement("div")
                        episodeHeader.className = "episode-header"
                        episodeHeader.innerHTML = `
                        <img class="episode-thumbnail" src="${episode.miniatura || episode.imagen || serie.post}" alt="${episode.titulo}">
                        <div class="episode-info">
                            <div class="episode-title">
                                ${episode.titulo}
                                <span class="episode-number">${episode.numero_completo}</span>
                            </div>
                            <div class="episode-description">${episode.descripcion || "Sin descripción disponible."}</div>
                            ${progress ? `
                                <div class="episode-progress-indicator">
                                    <i class="fas fa-history"></i> Visto: ${new Date(progress.timestamp).toLocaleDateString()}
                                </div>
                            ` : ''}
                        </div>
                        `
                        episodeItem.appendChild(episodeHeader)

                        // Botón para marcar como visto/no visto
                        const markWatchedBtn = document.createElement("div")
                        markWatchedBtn.className = "episode-servers"
                        markWatchedBtn.style.justifyContent = "space-between"
                        markWatchedBtn.style.alignItems = "center"

                        const markBtn = document.createElement("button")
                        markBtn.className = progress ? "btn btn-secondary" : "btn btn-primary"
                        markBtn.style.padding = "0.5rem 1rem"
                        markBtn.style.borderRadius = "20px"
                        markBtn.style.fontSize = "0.85rem"
                        markBtn.innerHTML = progress
                            ? '<i class="fas fa-check-circle"></i> Marcar como no visto'
                            : '<i class="fas fa-eye"></i> Marcar como visto'

                        markBtn.addEventListener("click", (e) => {
                            e.stopPropagation()
                            if (progress) {
                                clearEpisodeProgress(serieId, season.numero, episode.numero)
                            } else {
                                saveEpisodeProgress(serieId, season.numero, episode.numero, episode.titulo)
                            }
                            // Recargar la sección para actualizar el estado
                            loadSeriesSeasons(serie)
                        })

                        markWatchedBtn.appendChild(markBtn)

                        // Servidores del episodio
                        if (episode.servidores && episode.servidores.length > 0) {
                            const serversContainer = document.createElement("div")
                            serversContainer.className = "episode-servers"
                            serversContainer.style.display = "flex"
                            serversContainer.style.flexWrap = "wrap"
                            serversContainer.style.gap = "0.5rem"

                            episode.servidores.forEach((server) => {
                                const serverBtn = document.createElement("div")
                                serverBtn.className = "episode-server"
                                let serverIcon = "fas fa-server"
                                if (server.nombre.toLowerCase().includes("mega")) serverIcon = "fas fa-cloud-download-alt"
                                else if (server.nombre.toLowerCase().includes("google")) serverIcon = "fab fa-google-drive"
                                else if (server.nombre.toLowerCase().includes("hyper")) serverIcon = "fas fa-play-circle"

                                serverBtn.innerHTML = `<i class="${serverIcon}"></i> ${server.nombre} - ${server.idioma}`

                                serverBtn.addEventListener("click", () => {
                                    // Guardar progreso al reproducir
                                    saveEpisodeProgress(serieId, season.numero, episode.numero, episode.titulo)
                                    window.open(server.shorter || server.url, "_blank")
                                })
                                serversContainer.appendChild(serverBtn)
                            })
                            episodeItem.appendChild(serversContainer)
                        } else {
                            const noServers = document.createElement("div")
                            noServers.className = "episode-servers"
                            noServers.innerHTML = "<p style='color: var(--text-muted);'>No hay servidores disponibles para este episodio.</p>"
                            episodeItem.appendChild(noServers)
                        }

                        episodeItem.appendChild(markWatchedBtn)
                        episodeList.appendChild(episodeItem)
                    })
                } else {
                    episodeList.innerHTML = "<p style='padding: 1rem; color: var(--text-muted);'>No hay episodios disponibles para esta temporada.</p>"
                }

                content.appendChild(episodeList)
                seasonsContentsContainer.appendChild(content)
                firstTab = false
            })
        } else {
            seasonsTabsContainer.innerHTML = "<p>No hay temporadas disponibles para esta serie.</p>"
        }
    }

    // Event listeners
    modalClose.addEventListener("click", () => {
        movieModal.style.display = "none"
        document.body.style.overflow = "auto"
    })

    playerClose.addEventListener("click", () => {
        playerContainer.style.display = "none"
        playerIframe.src = ""
        document.body.style.overflow = "auto"
    })

    window.addEventListener("click", (e) => {
        if (e.target === movieModal) {
            movieModal.style.display = "none"
            document.body.style.overflow = "auto"
        }
        if (e.target === playerContainer) {
            playerContainer.style.display = "none"
            playerIframe.src = ""
            document.body.style.overflow = "auto"
        }
    })

    searchBtn.addEventListener("click", () => {
        const query = searchInput.value.trim()
        if (query) searchContent(query)
        else loadContent(currentContentType)
    })

    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            const query = searchInput.value.trim()
            if (query) searchContent(query)
            else loadContent(currentContentType)
        }
    })

    navTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            navTabs.forEach((t) => t.classList.remove("active"))
            tab.classList.add("active")
            const contentType = tab.getAttribute("data-content")
            genreCache[contentType] = {}
            loadContent(contentType)
        })
    })

    initializeApp();

    // Modal de géneros
    const genresModal = document.getElementById("genres-modal")
    const genresModalClose = document.getElementById("genres-modal-close")
    const genresLink = document.getElementById("genres-link")

    async function loadGenresModal() {
        const genresGrid = document.querySelector(".genres-grid")
        genresGrid.innerHTML = ""
        allGenres.forEach((genre) => {
            const genreCard = document.createElement("div")
            genreCard.className = "genre-card"
            const icon = getGenreIcon(genre)
            genreCard.innerHTML = `
            <div class="genre-icon"><i class="${icon}"></i></div>
            <div class="genre-name">${genre}</div>
            `
            genreCard.addEventListener("click", async () => {
                genresModal.style.display = "none"
                document.body.style.overflow = "auto"
                contentContainer.innerHTML = ""
                heroSection.style.display = "none"
                loadingElement.style.display = "flex"

                try {
                    const apiUrl = getApiUrl(currentContentType)
                    const cacheKey = `genre_detail_${currentContentType}_${genre}`
                    let data = getFromCache(cacheKey)
                    if (!data) {
                        const response = await fetch(`${apiUrl}?search=generos=${encodeURIComponent(genre)}&limit=50`)
                        data = await response.json()
                        if (data.success) saveToCache(cacheKey, data)
                    }
                    loadingElement.style.display = "none"
                    if (data.success && data.data.length > 0) {
                        createGenreSection(genre, data.data, icon, currentContentType)
                        const backButton = document.createElement("div")
                        backButton.innerHTML = `
                        <div style="text-align: center; margin: 30px 0;">
                            <button class="btn btn-primary" onclick="volverAlInicio()"
                                style="padding: 10px 20px; font-size: 1rem; border-radius: 0.5rem;">
                                <i class="fas fa-home"></i> Volver al inicio
                            </button>
                        </div>
                        `
                        contentContainer.appendChild(backButton)
                    } else {
                        contentContainer.innerHTML = `
                        <div class="fadeInUp" style="text-align: center; padding: 3rem 1rem;">
                            <i class="${icon}" style="font-size: 3rem; color: var(--accent-color); margin-bottom: 1rem;"></i>
                            <h2>No se encontraron resultados para "${genre}"</h2>
                            <p style="color: var(--text-secondary); margin: 1rem 0;">Intenta con otro género o explora nuestras categorías.</p>
                            <button class="btn btn-primary" onclick="volverAlInicio()"
                                style="padding: 10px 20px; font-size: 1rem; border-radius: 0.5rem;">
                                <i class="fas fa-home"></i> Volver al inicio
                            </button>
                        </div>
                        `
                    }
                } catch (error) {
                    loadingElement.style.display = "none"
                    contentContainer.innerHTML = `<p>Error al cargar el contenido del género.</p>`
                }
            })
            genresGrid.appendChild(genreCard)
        })
    }

    if (feedbackBtn) {
        feedbackBtn.addEventListener("click", () => {
            const email = document.querySelector(".newsletter-input").value.trim()
            if (email) {
                window.location.href = `mailto:filmsgapsplusdevelopers@gmail.com?subject=Feedback%20FilmsGapsPlus&body=Mi%20correo:%20${email}%0A%0AMi%20feedback:%20`
            } else {
                window.open("mailto:filmsgapsplusdevelopers@gmail.com?subject=Feedback%20FilmsGapsPlus", "_blank")
            }
        })
    }

    if (genresLink) {
        genresLink.addEventListener("click", (e) => {
            e.preventDefault()
            loadGenresModal()
            genresModal.style.display = "block"
            document.body.style.overflow = "hidden"
        })
    }

    if (genresModalClose) {
        genresModalClose.addEventListener("click", () => {
            genresModal.style.display = "none"
            document.body.style.overflow = "auto"
        })
    }

    window.addEventListener("click", (e) => {
        if (e.target === genresModal) {
            genresModal.style.display = "none"
            document.body.style.overflow = "auto"
        }
    })
})