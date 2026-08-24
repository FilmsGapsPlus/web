// Footer unificado: se inyecta en <div id="footer-root"></div> de todas las páginas
;(function () {
    function injectFooter() {
        const root = document.getElementById("footer-root")
        if (!root || root.dataset.fgpFooter === "done") return
        root.dataset.fgpFooter = "done"

        const year = new Date().getFullYear()

        const linksCol = (title, items) => `
            <div class="sf-col">
                <h3 class="footer-title">${title}</h3>
                <ul class="footer-links">
                    ${items}
                </ul>
            </div>
        `

        root.innerHTML = `
            <footer class="site-footer">
                <div class="footer-content sf-top">
                    <div class="sf-brand">
                        <div class="logo2">FilmsGaps <span>Plus</span></div>
                        <p class="footer-description">
                            Películas, series y canales en vivo en alta calidad.
                            Buscador e indexador de contenido alojado en servidores de terceros.
                        </p>
                        <div class="footer-social">
                            <a href="https://www.tiktok.com/@filmsgapsplus" class="social-icon" aria-label="TikTok" target="_blank" rel="noopener"><i class="fab fa-tiktok"></i></a>
                            <a href="https://github.com/FilmsGapsPlus/web" class="social-icon" aria-label="GitHub" target="_blank" rel="noopener"><i class="fab fa-github"></i></a>
                            <a href="https://t.me/FilmsGapsPlusSoporte" class="social-icon" aria-label="Telegram" target="_blank" rel="noopener"><i class="fab fa-telegram"></i></a>
                        </div>
                    </div>
                    ${linksCol("Explorar", `
                        <li><a href="/"><i class="fas fa-chevron-right"></i> Inicio</a></li>
                        <li><a href="#" id="genres-link"><i class="fas fa-chevron-right"></i> Géneros</a></li>
                    `)}
                    ${linksCol("Servicio", `
                        <li><a href="estado.html"><i class="fas fa-signal"></i> Estado del servicio</a></li>
                        <li><a href="https://stats.uptimerobot.com/JeBldYwWkh/802124050" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i> Monitor oficial</a></li>
                    `)}
                    ${linksCol("Legal", `
                        <li><a href="terminos.html"><i class="fas fa-file-alt"></i> Términos</a></li>
                        <li><a href="privacidad.html"><i class="fas fa-shield-alt"></i> Privacidad</a></li>
                    `)}
                    <div class="sf-col">
                        <h3 class="footer-title">Feedback</h3>
                        <p class="sf-feedback-desc">
                            Envíanos tus comentarios y sugerencias para mejorar nuestra plataforma.
                        </p>
                        <div class="newsletter-form">
                            <input type="email" class="newsletter-input" placeholder="Tu correo electrónico">
                            <button class="newsletter-btn" id="feedback-btn" aria-label="Enviar feedback"><i class="fas fa-paper-plane"></i></button>
                        </div>
                        <p class="footer-small-text">
                            O escríbenos directamente a:<br>filmsgapsplusdevelopers@gmail.com
                        </p>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>© ${year} FilmsGapsPlus. Todos los derechos reservados.</p>
                    <p class="footer-bottom-note">Sin anuncios · Sin registro · 100% gratis</p>
                </div>
            </footer>
        `

        // Re-disparar el binding de #feedback-btn que hace cada página
        document.dispatchEvent(new CustomEvent("fgp:footer-injected"))

        bindBackLinks()
        bindGenresLink()
    }

    // "Géneros" funciona desde cualquier página: en el index dispara el modal;
    // fuera de él, lleva al index con el hash #generos y allí se abre solo
    function bindGenresLink() {
        const link = document.getElementById("genres-link")
        if (!link || link.dataset.fgpGenres === "done") return
        link.dataset.fgpGenres = "done"
        link.addEventListener("click", e => {
            e.preventDefault()
            if (document.getElementById("genres-modal")) {
                document.dispatchEvent(new CustomEvent("fgp:open-genres"))
            } else {
                // Raíz del sitio: el servidor sirve index.html automáticamente
                window.location.href = "/#generos"
            }
        })
    }

    // Enlaces de retroceso en todas las páginas: history.back() sin recargar;
    // si no hay historial previo, carga index.html directamente
    function bindBackLinks() {
        document.querySelectorAll('a[data-back], .legal-back[href="/"], header.legal-header a[href="/"], a.back-float[href="/"]').forEach(link => {
            if (link.dataset.fgpBack === "done") return
            link.dataset.fgpBack = "done"
            const href = link.getAttribute("href") || "/"
            link.addEventListener("click", e => {
                e.preventDefault()
                if (window.history && window.history.length > 1) {
                    window.history.back()
                    setTimeout(() => { window.location.href = href }, 900)
                } else {
                    window.location.href = href
                }
            })
        })
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectFooter)
    } else {
        injectFooter()
    }
})()
