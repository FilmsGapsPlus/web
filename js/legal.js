// Páginas legales: índice de contenido automático + resaltado de sección visible
;(function () {
    function buildLegalToc() {
        const sections = Array.from(document.querySelectorAll(".legal-section[id]")).filter(s => s.querySelector("h3"))
        if (!sections.length) return

        const items = sections.map((s, i) => {
            const num = String(i + 1).padStart(2, "0")
            return `<li><a class="toc-link" href="#${s.id}"><span>${num}</span>${s.querySelector("h3").textContent.trim()}</a></li>`
        }).join("")

        const asideList = document.querySelector(".legal-toc ol")
        if (asideList && !asideList.children.length) asideList.innerHTML = items
        const mobileList = document.querySelector(".legal-toc-mobile ol")
        if (mobileList && !mobileList.children.length) mobileList.innerHTML = items

        // Resaltar la sección visible mientras se hace scroll
        const links = Array.from(document.querySelectorAll(".toc-link"))
        if (!links.length) return
        const activate = id => links.forEach(l => l.classList.toggle("active", l.getAttribute("href") === "#" + id))
        activate(sections[0].id)

        if ("IntersectionObserver" in window) {
            const visible = new Set()
            let ticking = false
            const io = new IntersectionObserver(entries => {
                entries.forEach(en => {
                    if (en.isIntersecting) visible.add(en.target.id)
                    else visible.delete(en.target.id)
                })
                if (!ticking) {
                    ticking = true
                    requestAnimationFrame(() => {
                        ticking = false
                        const current = sections.find(s => visible.has(s.id))
                        if (current) activate(current.id)
                    })
                }
            }, { rootMargin: "-90px 0px -62% 0px" })
            sections.forEach(s => io.observe(s))
        }

        // Al hacer clic, marcar el destino de inmediato
        links.forEach(l => l.addEventListener("click", () => activate(l.getAttribute("href").slice(1))))
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", buildLegalToc)
    } else {
        buildLegalToc()
    }
})()
