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

    // Encriptación de las URLs de la API en base64
    const apiUrlMoviesBase64 = "aHR0cHM6Ly9hbnVzZGJzLm9ucmVuZGVyLmNvbS9tb3ZpZXM/YXBpLWtleT01NDA0MzgzYWI="
    const apiUrlSeriesBase64 = "aHR0cHM6Ly9hbnVzZGJzLm9ucmVuZGVyLmNvbS9zZXJpZXMvP2FwaS1rZXk9NTQwNDM4M2Fi"

    // Función para decodificar las URLs de la API
    function getApiUrl(type) {
        return type === "movies" ? atob(apiUrlMoviesBase64): atob(apiUrlSeriesBase64)
    }

    // Lista de géneros disponibles
    const allGenres = [
        "Accion",
        "Animacion",
        "Anime",
        "Aventura",
        "Belica",
        "Ciencia Ficcion",
        "Comedia",
        "Crimen",
        "Documental",
        "Drama",
        "Familia",
        "Fantasia",
        "Historia",
        "Infantil",
        "Misterio",
        "Musica",
        "News",
        "Película de TV",
        "Politica",
        "Reality",
        "Romance",
        "Suspenso",
        "Talk",
        "Telenovela",
        "Terror",
        "Western",
    ]

    // Variables para el estado de la aplicación
    let isLoading = false
    let allMovies = []
    let allSeries = []
    let featuredContent = null
    let searchResultsMovies = []
    let searchResultsSeries = []
    let isSearchActive = false
    let currentContentType = "movies" // 'movies', 'series' o 'all'
    heroSection.style.display = "none"
    contentContainer.style.display = "none"
    tabs.style.display = "none"

    // Función para cargar contenido según el tipo
    async function loadContent(type) {
        currentContentType = type
        isLoading = true
        isSearchActive = false // Resetear estado de búsqueda

        // Ocultar todo excepto el loading al inicio
        /* heroSection.style.display = "flex"
    contentContainer.style.display = "flex"
    tabs.style.display = "flex" */
        loadingElement.style.display = "flex"
        contentContainer.innerHTML = ""

        try {
            // Si es la primera vez que cargamos películas o series, hacemos la petición
            if (type === "movies" && allMovies.length === 0) {
                const apiUrl = getApiUrl("movies")
                const response = await fetch(`${apiUrl}&limit=1000&random`)
                const data = await response.json()
                if (data.success && data.data.length > 0) {
                    allMovies = data.data
                }
            }

            if ((type === "series" || type === "all") && allSeries.length === 0) {
                const apiUrl = getApiUrl("series")
                const response = await fetch(`${apiUrl}&limit=1000&random`)
                const data = await response.json()
                if (data.success && data.data.length > 0) {
                    allSeries = data.data
                }
            }

            // Seleccionar contenido destacado
            if (type === "movies" && allMovies.length > 0) {
                featuredContent = allMovies[Math.floor(Math.random() * allMovies.length)]
                updateHeroSection(featuredContent, "movies")
            } else if (type === "series" && allSeries.length > 0) {
                featuredContent = allSeries[Math.floor(Math.random() * allSeries.length)]
                updateHeroSection(featuredContent, "series")
            } else if (type === "all") {
                // Para "Todo", elegimos aleatoriamente entre películas y series mezcladas
                const allContent = [...allMovies,
                    ...allSeries];
                shuffleArray(allContent);
                if (allContent.length > 0) {
                    featuredContent = allContent[0]; // Ahora ya está mezclado
                    const contentType = allMovies.includes(featuredContent) ? "movies": "series";
                    updateHeroSection(featuredContent, contentType);
                }
            }

            // Organizar contenido por género según el tipo
            if (type === "movies") {
                organizeContentByGenre("movies")
            } else if (type === "series") {
                organizeContentByGenre("series")
            } else if (type === "all") {
                // Para "Todo", mostramos tanto películas como series
                organizeAllContentByGenre()
            }
        } catch (error) {
            console.error(`Error al cargar contenido:`, error)
            contentContainer.innerHTML = `<p>Error al cargar el contenido. Por favor, intenta de nuevo más tarde.</p>`
        } finally {
            isLoading = false
            loadingElement.style.display = "none"
            // Mostrar los elementos después de cargar
            tabs.style.display = "flex"
            heroSection.style.display = "block"
            contentContainer.style.display = "block"
            // Hacer scroll suave hasta arriba
            scrollToTop()
        }
    }

    // Función para organizar todo el contenido (películas y series) por género
    function organizeAllContentByGenre() {
        // Primero mostramos los estrenos recientes (películas y series)
        const recentMovies = allMovies.filter((item) => item.año === "2025" || item.año === "2026");
        const recentSeries = allSeries.filter((item) => item.año === "2025" || item.año === "2026");

        if (recentMovies.length > 0 || recentSeries.length > 0) {
            const recentContent = [...recentMovies,
                ...recentSeries];
            // Mezclar los estrenos
            shuffleArray(recentContent);
            createGenreSection("Estrenos", recentContent, "fas fa-fire", "mixed");
        }

        // Luego agrupamos por género
        allGenres.forEach((genre) => {
            const moviesInGenre = allMovies.filter((item) => item.generos && item.generos.includes(genre));
            const seriesInGenre = allSeries.filter((item) => item.generos && item.generos.includes(genre));

            // Si hay contenido en este género, lo mostramos
            if (moviesInGenre.length > 0 || seriesInGenre.length > 0) {
                const contentInGenre = [...moviesInGenre,
                    ...seriesInGenre];
                // Mezclar el contenido dentro del género
                shuffleArray(contentInGenre);

                // Asignar iconos según el género
                let icon = "fas fa-film";
                if (genre === "Accion") icon = "fas fa-running";
                else if (genre === "Comedia") icon = "fas fa-laugh";
                else if (genre === "Terror") icon = "fas fa-ghost";
                else if (genre === "Ciencia Ficcion") icon = "fas fa-robot";
                else if (genre === "Romance") icon = "fas fa-heart";
                else if (genre === "Animacion" || genre === "Anime") icon = "fas fa-child";

                createGenreSection(genre, contentInGenre, icon, "mixed");
            }
        });
    }

    // Función para mezclar un array (algoritmo Fisher-Yates)
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i],
                array[j]] = [array[j],
                array[i]];
        }
        return array;
    }

    // Función para actualizar la sección hero
    function updateHeroSection(content, type) {
        if (!content) return

        heroSection.innerHTML = `
        <img class="hero-backdrop" src="${content.miniature || content.post}" alt="${content.titulo}">
        <div class="hero-overlay"></div>
        <div class="hero-content fadeInUp">
        <h1 class="hero-title">${content.titulo}</h1>
        <div class="hero-meta">
        <span><i class="far fa-calendar-alt"></i> ${content.año}</span>
        ${content.duracion ? `<span><i class="far fa-clock"></i> ${content.duracion}</span>`: ""}
        <span><i class="fas fa-star"></i> ${(Math.random() * 2 + 7).toFixed(1)}</span>
        <span><i class="fas fa-tag"></i> ${type === "movies" ? "Película": "Serie"}</span>
        </div>
        <!-- <p class="hero-description">${content.descripcion || "Sin descripción disponible."}</p> -->
        <div class="hero-buttons">
        <button class="btn btn-red" onclick="openContentModal('${type}', ${type === "movies" ? allMovies.indexOf(content): allSeries.indexOf(content)})">
        <i class="fas fa-play"></i> Ver ahora
        </button>
        <!-- <button class="btn btn-secondary" onclick="openContentModal('${type}', ${type === "movies" ? allMovies.indexOf(content): allSeries.indexOf(content)})">
        <i class="fas fa-info-circle"></i> Más información
        </button> -->
        </div>
        </div>
        `
    }

    // Función para organizar contenido por género
    function organizeContentByGenre(type) {
        // Primero agrupamos el contenido por género
        const contentByGenre = {}
        const contentArray = type === "movies" ? allMovies: allSeries

        allGenres.forEach((genre) => {
            contentByGenre[genre] = contentArray.filter((item) => item.generos && item.generos.includes(genre))
        })

        // Ahora mostramos cada género que tenga contenido
        displayGenresWithContent(contentByGenre, type)
    }

    // Función para mostrar géneros con su contenido
    function displayGenresWithContent(contentByGenre, type) {
        contentContainer.innerHTML = ""

        // Mostrar primero el contenido más reciente
        const contentArray = type === "movies" ? allMovies: type === "series" ? allSeries: [...allMovies,
            ...allSeries]
        const recentContent = contentArray.filter((item) => item.año === "2025" || item.año === "2026")
        if (recentContent.length > 0) {
            createGenreSection("Estrenos", recentContent, "fas fa-fire", type)
        }

        // Luego mostrar los géneros
        for (const [genre, content] of Object.entries(contentByGenre)) {
            if (content.length > 0) {
                let icon = "fas fa-film"

                // Asignar iconos según el género
                if (genre === "Accion") icon = "fas fa-running"
                else if (genre === "Comedia") icon = "fas fa-laugh"
                else if (genre === "Terror") icon = "fas fa-ghost"
                else if (genre === "Ciencia Ficcion") icon = "fas fa-robot"
                else if (genre === "Romance") icon = "fas fa-heart"
                else if (genre === "Animacion" || genre === "Anime") icon = "fas fa-child"

                createGenreSection(genre, content, icon, type)
            }
        }
    }

    // Función para crear una sección de género con su contenido
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
        /* seeAll.innerHTML = 'Ver todo <i class="fas fa-arrow-right"></i>'; */

        carouselNav.appendChild(prevBtn)
        carouselNav.appendChild(nextBtn)
        carouselNav.appendChild(seeAll)

        sectionHeader.appendChild(title)
        sectionHeader.appendChild(carouselNav)

        const row = document.createElement("div")
        row.className = "movies-row"

        // Mostrar hasta 20 items por género
        content.slice(0, 100).forEach((item, index) => {
            const card = document.createElement("div")
            card.className = "movie-card"

            // Generar una calificación aleatoria entre 7 y 9
            const rating = (Math.random() * 2 + 7).toFixed(1)

            // Determinar si es película o serie
            const contentType = type === "mixed" ? (allMovies.includes(item) ? "movies": "series"): type

            card.innerHTML = `
            <div class="movie-poster-container">
            <img class="movie-poster" src="${item.post}" alt="${item.titulo}" loading="lazy">
            <div class="movie-overlay">
            <button class="movie-play-btn">
            <i class="fas fa-play"></i>
            </button>
            </div>
            <div class="movie-type">${contentType === "movies" ? "PELÍCULA": "SERIE"}</div>
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
            <span>${item.año}</span>
            </div>
            </div>
            </div>
            `

            card.addEventListener("click", () => {
                let contentArray, realIndex

                if (isSearchActive) {
                    contentArray = contentType === "movies" ? searchResultsMovies: searchResultsSeries
                } else {
                    contentArray = contentType === "movies" ? allMovies: allSeries
                }

                realIndex = contentArray.findIndex((c) => c.titulo === item.titulo && c.año === item.año)
                openContentModal(contentType, realIndex)
            })

            row.appendChild(card)
        })

        // Configurar navegación del carrusel
        prevBtn.addEventListener("click", () => {
            row.scrollBy({
                left: -600,
                behavior: "smooth",
            })
        })

        nextBtn.addEventListener("click", () => {
            row.scrollBy({
                left: 600,
                behavior: "smooth",
            })
        })

        section.appendChild(sectionHeader)
        section.appendChild(row)
        contentContainer.appendChild(section)
    }

    // Función para hacer scroll suave hasta arriba
    function scrollToTop() {
        // Verificar si el navegador soporta 'behavior: smooth'
        if ("scrollBehavior" in document.documentElement.style) {
            // Método moderno (Chrome, Firefox, Edge, Safari)
            window.scrollTo({
                top: 0,
                behavior: "smooth",
            })
        } else {
            // Fallback para navegadores antiguos (IE, Safari antiguo)
            const scrollDuration = 500 // Duración en milisegundos
            const scrollStep = -window.scrollY / (scrollDuration / 15)

            const scrollInterval = setInterval(() => {
                if (window.scrollY !== 0) {
                    window.scrollBy(0, scrollStep)
                } else {
                    clearInterval(scrollInterval)
                }
            },
                15)
        }
    }

    // Función para buscar contenido
    async function searchContent(query) {
        isLoading = true
        isSearchActive = true // Activar modo búsqueda
        loadingElement.style.display = "flex"
        contentContainer.innerHTML = ""
        heroSection.style.display = "none"
        tabs.style.display = "none"

        try {
            // Buscar en películas
            const apiUrlMovies = getApiUrl("movies")
            const responseMovies = await fetch(`${apiUrlMovies}&search=titulo=${encodeURIComponent(query)}`)
            const dataMovies = await responseMovies.json()

            // Buscar en series
            const apiUrlSeries = getApiUrl("series")
            const responseSeries = await fetch(`${apiUrlSeries}&search=titulo=${encodeURIComponent(query)}`)
            const dataSeries = await responseSeries.json()

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

                // Agrega esto justo después de crear las secciones de resultados (dentro del if (hasMovies || hasSeries))
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
            console.error("Error al buscar contenido:", error)
            contentContainer.innerHTML = "<p>Error al buscar el contenido</p>"
        } finally {
            isLoading = false
            loadingElement.style.display = "none"
            tabs.style.display = "none"
        }
    }

    // Función para volver al inicio
    window.volverAlInicio = () => {
        loadContent(currentContentType) // Recarga el contenido principal
        tabs.style.display = "flex" // Muestra las tabs
        heroSection.style.display = "block" // Muestra el hero
        searchInput.value = "" // Limpia el campo de búsqueda
        isSearchActive = false
    }

    // Función para abrir el modal con los detalles del contenido
    window.openContentModal = (type, contentIndex) => {
        const content = isSearchActive
        ? type === "movies"
        ? searchResultsMovies[contentIndex]: searchResultsSeries[contentIndex]: type === "movies"
        ? allMovies[contentIndex]: allSeries[contentIndex]
        if (!content) return

        document.getElementById("modal-backdrop").src = content.miniature || content.post
        document.getElementById("modal-poster").src = content.post
        document.getElementById("modal-title").textContent = content.titulo || "Sin título"
        document.getElementById("modal-year").querySelector("span").textContent = content.año || "Año desconocido"

        if (content.duracion) {
            document.getElementById("modal-duration").style.display = "inline-flex"
            document.getElementById("modal-duration").querySelector("span").textContent = content.duracion
        } else {
            document.getElementById("modal-duration").style.display = "none"
        }

        document.getElementById("modal-rating").querySelector("span").textContent = (Math.random() * 2 + 7).toFixed(1)
        document.getElementById("modal-type").querySelector("span").textContent = type === "movies" ? "Película": "Serie"
        document.getElementById("modal-description").textContent = content.descripcion || "Sin descripción disponible."

        // Mostrar u ocultar secciones según el tipo de contenido
        document.getElementById("movie-servers-section").style.display = type === "movies" ? "block": "none"
        document.getElementById("series-seasons-section").style.display = type === "series" ? "block": "none"

        // Limpiar y cargar géneros
        const genresContainer = document.getElementById("modal-genres")
        genresContainer.innerHTML = ""

        if (content.generos) {
            const genres = typeof content.generos === "string" ? content.generos.split(" - "): content.generos
            genres.forEach((genre) => {
                const genreTag = document.createElement("span")
                genreTag.className = "genre-tag"
                genreTag.textContent = genre
                genresContainer.appendChild(genreTag)
            })
        }

        // Limpiar y cargar reparto
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

        if (type === "movies") {
            // Cargar servidores para películas
            loadMovieServers(content)
        } else {
            // Cargar temporadas para series
            loadSeriesSeasons(content)
        }

        // Mostrar el modal
        movieModal.style.display = "block"
        document.body.style.overflow = "hidden"
    }

    // Función para cargar servidores de películas
    function loadMovieServers(movie) {
        const serverTabsContainer = document.getElementById("server-tabs")
        const serverContentsContainer = document.getElementById("server-contents")
        serverTabsContainer.innerHTML = ""
        serverContentsContainer.innerHTML = ""

        if (movie.servidores && movie.servidores.length > 0) {
            // Agrupar servidores por idioma
            const serversByLanguage = {}
            movie.servidores.forEach((server) => {
                if (!serversByLanguage[server.idioma]) {
                    serversByLanguage[server.idioma] = []
                }
                serversByLanguage[server.idioma].push(server)
            })

            // Crear pestañas y contenidos
            let firstTab = true
            for (const [language, servers] of Object.entries(serversByLanguage)) {
                // Crear pestaña
                const tab = document.createElement("div")
                tab.className = `server-tab ${firstTab ? "active": ""}`

                // Asignar icono según el idioma
                let langIcon = "fas fa-globe"
                if (language.toLowerCase().includes("español") || language.toLowerCase().includes("latino")) {
                    langIcon = "fas fa-language"
                } else if (language.toLowerCase().includes("inglés") || language.toLowerCase().includes("english")) {
                    langIcon = "fas fa-language"
                } else if (language.toLowerCase().includes("subtitulado")) {
                    langIcon = "fas fa-closed-captioning"
                }

                tab.innerHTML = `<i class="${langIcon}"></i> ${language}`

                tab.addEventListener("click", () => {
                    // Remover clase active de todas las pestañas
                    document.querySelectorAll(".server-tab").forEach((t) => t.classList.remove("active"))
                    // Añadir clase active a la pestaña clickeada
                    tab.classList.add("active")
                    // Mostrar el contenido correspondiente
                    document.querySelectorAll(".server-content").forEach((c) => c.classList.remove("active"))
                    document.getElementById(`server-content-${language.replace(/\s+/g, "-")}`).classList.add("active")
                })
                serverTabsContainer.appendChild(tab)

                // Crear contenido
                const content = document.createElement("div")
                content.className = `server-content ${firstTab ? "active": ""}`
                content.id = `server-content-${language.replace(/\s+/g, "-")}`

                servers.forEach((server) => {
                    const serverOption = document.createElement("div")
                    serverOption.className = "server-option"

                    // Asignar icono según el servidor
                    let serverIcon = "fas fa-server"
                    if (server.nombre.toLowerCase().includes("mega")) {
                        serverIcon = "fas fa-cloud-download-alt"
                    } else if (server.nombre.toLowerCase().includes("google")) {
                        serverIcon = "fab fa-google-drive"
                    } else if (server.nombre.toLowerCase().includes("fembed")) {
                        serverIcon = "fas fa-play-circle"
                    }

                    serverOption.innerHTML = `
                    <div class="server-info">
                    <span class="server-name"><i class="${serverIcon}"></i> ${server.nombre}</span>
                    <div class="server-meta">
                    <span><i class="fas fa-video"></i> ${server.calidad}</span>
                    <span><i class="fas fa-closed-captioning"></i> ${server.idioma}</span>
                    <span><i class="fas fa-file-video"></i> ${server.tipo}</span>
                    </div>
                    </div>
                    <button class="watch-btn" data-url="${server.url}" data-title="${movie.titulo}">
                    <i class="fas fa-play"></i> Ver ahora
                    </button>
                    `
                    content.appendChild(serverOption)
                })

                serverContentsContainer.appendChild(content)
                firstTab = false
            }

            // Añadir event listeners a los botones de ver
            document.querySelectorAll(".watch-btn").forEach((btn) => {
                btn.addEventListener("click", (e) => {
                    const url = e.currentTarget.getAttribute("data-url")
                    const title = e.currentTarget.getAttribute("data-title")
                    if (url) {
                        window.open(url, "_blank")
                    }
                })
            })
        } else {
            serverTabsContainer.innerHTML = "<p>No hay servidores disponibles para esta película.</p>"
        }
    }

    // Función para cargar temporadas de series
    function loadSeriesSeasons(serie) {
        const seasonsTabsContainer = document.getElementById("seasons-tabs")
        const seasonsContentsContainer = document.getElementById("seasons-contents")
        seasonsTabsContainer.innerHTML = ""
        seasonsContentsContainer.innerHTML = ""

        if (serie.temporadas && serie.temporadas.length > 0) {
            // Crear pestañas y contenidos para cada temporada
            let firstTab = true
            serie.temporadas.forEach((season) => {
                // Crear pestaña
                const tab = document.createElement("div")
                tab.className = `season-tab ${firstTab ? "active": ""}`
                tab.innerHTML = `<i class="fas fa-layer-group"></i> ${season.titulo}`

                tab.addEventListener("click", () => {
                    // Remover clase active de todas las pestañas
                    document.querySelectorAll(".season-tab").forEach((t) => t.classList.remove("active"))
                    // Añadir clase active a la pestaña clickeada
                    tab.classList.add("active")
                    // Mostrar el contenido correspondiente
                    document.querySelectorAll(".season-content").forEach((c) => c.classList.remove("active"))
                    document.getElementById(`season-content-${season.numero}`).classList.add("active")
                })
                seasonsTabsContainer.appendChild(tab)

                // Crear contenido
                const content = document.createElement("div")
                content.className = `season-content ${firstTab ? "active": ""}`
                content.id = `season-content-${season.numero}`

                // Lista de episodios
                const episodeList = document.createElement("div")
                episodeList.className = "episode-list"

                if (season.episodios && season.episodios.length > 0) {
                    season.episodios.forEach((episode) => {
                        const episodeItem = document.createElement("div")
                        episodeItem.className = "episode-item"

                        // Cabecera del episodio
                        const episodeHeader = document.createElement("div")
                        episodeHeader.className = "episode-header"

                        // Contenido de la cabecera
                        episodeHeader.innerHTML = `
                        <img class="episode-thumbnail" src="${episode.miniatura || episode.imagen || serie.post}" alt="${episode.titulo}">
                        <div class="episode-info">
                        <div class="episode-title">
                        ${episode.titulo}
                        <span class="episode-number">${episode.numero_completo}</span>
                        </div>
                        <div class="episode-description">${episode.descripcion || "Sin descripción disponible."}</div>
                        </div>
                        `

                        episodeItem.appendChild(episodeHeader)

                        // Servidores del episodio
                        if (episode.servidores && episode.servidores.length > 0) {
                            const episodeServers = document.createElement("div")
                            episodeServers.className = "episode-servers"

                            episode.servidores.forEach((server) => {
                                const serverBtn = document.createElement("div")
                                serverBtn.className = "episode-server"

                                // Asignar icono según el servidor
                                let serverIcon = "fas fa-server"
                                if (server.nombre.toLowerCase().includes("mega")) {
                                    serverIcon = "fas fa-cloud-download-alt"
                                } else if (server.nombre.toLowerCase().includes("google")) {
                                    serverIcon = "fab fa-google-drive"
                                } else if (server.nombre.toLowerCase().includes("hyper")) {
                                    serverIcon = "fas fa-play-circle"
                                }

                                serverBtn.innerHTML = `
                                <i class="${serverIcon}"></i> ${server.nombre} - ${server.idioma}
                                `

                                serverBtn.addEventListener("click", () => {
                                    openPlayer(server.url, `${serie.titulo} - ${episode.numero_completo}`)
                                })

                                episodeServers.appendChild(serverBtn)
                            })

                            episodeItem.appendChild(episodeServers)
                        } else {
                            const noServers = document.createElement("div")
                            noServers.className = "episode-servers"
                            noServers.innerHTML = "<p>No hay servidores disponibles para este episodio.</p>"
                            episodeItem.appendChild(noServers)
                        }

                        episodeList.appendChild(episodeItem)
                    })
                } else {
                    episodeList.innerHTML = "<p>No hay episodios disponibles para esta temporada.</p>"
                }

                content.appendChild(episodeList)
                seasonsContentsContainer.appendChild(content)
                firstTab = false
            })
        } else {
            seasonsTabsContainer.innerHTML = "<p>No hay temporadas disponibles para esta serie.</p>"
        }
    }

    // Función para abrir el reproductor
    function openPlayer(url, title) {
        /* playerTitle.innerHTML = `<i class="fas fa-play-circle"></i> ${title || 'Reproduciendo'}`;
    playerIframe.src = url;
    playerContainer.style.display = 'block';
    document.body.style.overflow = 'hidden'; */
        window.open(url, "_blank")
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

    searchBtn.addEventListener("click",
        () => {
            const query = searchInput.value.trim()
            if (query) {
                searchContent(query)
            } else {
                loadContent(currentContentType)
                heroSection.style.display = "block"
            }
        })

    searchInput.addEventListener("keypress",
        (e) => {
            if (e.key === "Enter") {
                const query = searchInput.value.trim()
                if (query) {
                    searchContent(query)
                } else {
                    loadContent(currentContentType)
                    heroSection.style.display = "block"
                }
            }
        })

    // Event listeners para las pestañas de navegación
    navTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            // Remover clase active de todas las pestañas
            navTabs.forEach((t) => t.classList.remove("active"))
            // Añadir clase active a la pestaña clickeada
            tab.classList.add("active")
            // Cargar el contenido correspondiente
            const contentType = tab.getAttribute("data-content")
            loadContent(contentType)
        })
    })

    // Cargar películas al inicio
    loadContent("movies")

    // Elementos para los modales adicionales
    const genresModal = document.getElementById("genres-modal")
    const genresModalClose = document.getElementById("genres-modal-close")
    const genresLink = document.getElementById("genres-link")

    // Función para cargar los géneros en el modal
    function loadGenresModal() {
        const genresGrid = document.querySelector(".genres-grid")
        genresGrid.innerHTML = ""

        allGenres.forEach((genre) => {
            const genreCard = document.createElement("div")
            genreCard.className = "genre-card"

            // Asignar icono según el género
            let icon = "fas fa-film"
            if (genre === "Accion") icon = "fas fa-running"
            else if (genre === "Comedia") icon = "fas fa-laugh"
            else if (genre === "Terror") icon = "fas fa-ghost"
            else if (genre === "Ciencia Ficcion") icon = "fas fa-robot"
            else if (genre === "Romance") icon = "fas fa-heart"
            else if (genre === "Animacion" || genre === "Anime") icon = "fas fa-child"
            else if (genre === "Drama") icon = "fas fa-theater-masks"
            else if (genre === "Aventura") icon = "fas fa-mountain"
            else if (genre === "Fantasia") icon = "fas fa-dragon"
            else if (genre === "Misterio") icon = "fas fa-search"

            genreCard.innerHTML = `
            <div class="genre-icon">
            <i class="${icon}"></i>
            </div>
            <div class="genre-name">${genre}</div>
            `

            genreCard.addEventListener("click", () => {
                // Filtrar contenido por género según el tipo actual
                let filteredContent = []

                if (currentContentType === "movies") {
                    filteredContent = allMovies.filter((item) => item.generos && item.generos.includes(genre))
                } else if (currentContentType === "series") {
                    filteredContent = allSeries.filter((item) => item.generos && item.generos.includes(genre))
                } else if (currentContentType === "all") {
                    const moviesFiltered = allMovies.filter((item) => item.generos && item.generos.includes(genre))
                    const seriesFiltered = allSeries.filter((item) => item.generos && item.generos.includes(genre))
                    filteredContent = [...moviesFiltered,
                        ...seriesFiltered]
                }

                // Mostrar resultados
                genresModal.style.display = "none"
                document.body.style.overflow = "auto"

                contentContainer.innerHTML = ""
                heroSection.style.display = "none"

                if (filteredContent.length > 0) {
                    createGenreSection(
                        `${genre}`,
                        filteredContent,
                        icon,
                        currentContentType === "all" ? "mixed": currentContentType,
                    )

                    // Agregar botón para volver
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
            })

            genresGrid.appendChild(genreCard)
        })
    }

    feedbackBtn.addEventListener('click', () => {
        const email = document.querySelector('.newsletter-input').value.trim();
        if (email) {
            window.location.href = `mailto:filmsgapsplusdevelopers@gmail.com?subject=Feedback%20FilmsGapsPlus&body=Mi%20correo:%20${email}%0A%0AMi%20feedback:%20`;
        } else {
            window.open('mailto:filmsgapsplusdevelopers@gmail.com?subject=Feedback%20FilmsGapsPlus', '_blank');
        }
    })

    // Event listeners para los modales
    genresLink.addEventListener("click",
        (e) => {
            e.preventDefault()
            loadGenresModal()
            genresModal.style.display = "block"
            document.body.style.overflow = "hidden"
        })

    genresModalClose.addEventListener("click",
        () => {
            genresModal.style.display = "none"
            document.body.style.overflow = "auto"
        })

    // Cerrar modales al hacer clic fuera
    window.addEventListener("click",
        (e) => {
            if (e.target === genresModal) {
                genresModal.style.display = "none"
                document.body.style.overflow = "auto"
            }
        })
})