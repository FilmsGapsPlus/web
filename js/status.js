// Página de estado del servicio (estado.html)
// Consume la API pública de la página de estado de Uptime Robot
// (CORS abierto, sin clave) con auto-refresco cada 60 segundos.
;(function () {
    const API_URL = "https://stats.uptimerobot.com/api/getMonitor/JeBldYwWkh?m=802124050"
    const OFFICIAL_URL = "https://stats.uptimerobot.com/JeBldYwWkh/802124050"
    const REFRESH_MS = 60000

    const STATUS_TEXT = {
        success: "Operativo",
        danger: "Interrupción detectada",
        warning: "Operación degradada",
        paused: "Monitoreo pausado"
    }

    const els = {}

    function pct(v) {
        const n = parseFloat(v)
        return isNaN(n) ? "—" : n.toFixed(2) + "%"
    }

    function fmtDate(iso) {
        try {
            return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
        } catch (e) {
            return iso || ""
        }
    }

    function barColor(ratio, color) {
        if (color === "green") return "#22c55e"
        if (color === "orange" || color === "yellow") return "#f59e0b"
        if (color === "red") return "#ef4444"
        const r = parseFloat(ratio)
        if (isNaN(r)) return "#3f3f46"
        if (r >= 99.5) return "#22c55e"
        if (r >= 95) return "#f59e0b"
        return "#ef4444"
    }

    async function fetchData() {
        if (typeof window.fetch !== "function") throw new Error("sin fetch")
        const res = await window.fetch(API_URL, { cache: "no-store" })
        if (!res.ok) throw new Error("HTTP " + res.status)
        return res.json()
    }

    function renderError() {
        els.loading.style.display = "none"
        els.error.style.display = "flex"
        const link = els.error.querySelector("#official-link")
        if (link) link.href = OFFICIAL_URL
    }

    // Gráfica SVG de tiempo de respuesta (últimas N muestras)
    function renderSparkline(times) {
        const wrap = document.getElementById("resp-spark")
        if (!wrap) return
        const W = 600, H = 110, PAD = 6
        const values = times.map(t => t.value).filter(v => typeof v === "number").slice(-90)
        wrap.innerHTML = ""
        if (values.length < 2) {
            wrap.innerHTML = '<p class="status-empty">Sin datos suficientes para la gráfica.</p>'
            return
        }
        const min = Math.min(...values), max = Math.max(...values)
        const span = max - min || 1
        const stepX = (W - PAD * 2) / (values.length - 1)
        const points = values.map((v, i) => {
            const x = PAD + i * stepX
            const y = H - PAD - ((v - min) / span) * (H - PAD * 2)
            return `${x.toFixed(1)},${y.toFixed(1)}`
        })

        const NS = "http://www.w3.org/2000/svg"
        const svg = document.createElementNS(NS, "svg")
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
        svg.setAttribute("preserveAspectRatio", "none")
        svg.classList.add("spark-svg")

        const defs = document.createElementNS(NS, "defs")
        defs.innerHTML = `
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#22c55e" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
            </linearGradient>`
        svg.appendChild(defs)

        const area = document.createElementNS(NS, "polygon")
        area.setAttribute("points", `${PAD},${H - PAD} ${points.join(" ")} ${(W - PAD).toFixed(1)},${H - PAD}`)
        area.setAttribute("fill", "url(#sparkFill)")
        svg.appendChild(area)

        const line = document.createElementNS(NS, "polyline")
        line.setAttribute("class", "spark-line")
        line.setAttribute("points", points.join(" "))
        svg.appendChild(line)

        wrap.appendChild(svg)
        const range = document.createElement("p")
        range.className = "spark-range"
        range.textContent = `${min} ms mín · ${max} ms máx (últimas ${values.length} comprobaciones)`
        wrap.appendChild(range)
    }

    function render(data) {
        const m = (data && data.monitor) || {}
        const cls = STATUS_TEXT[m.statusClass] ? m.statusClass : "unknown"

        els.hero.className = `status-card status-hero status-${cls}`
        els.pill.querySelector(".status-dot").className = `status-dot dot-${cls}`
        els.pill.querySelector(".status-text").textContent =
            STATUS_TEXT[m.statusClass] || "Estado desconocido"
        els.sub.textContent = [m.name, m.type, m.checkInterval].filter(Boolean).join(" · ")

        const rows = [
            ["1dRatio", "Últimas 24 horas"],
            ["7dRatio", "Últimos 7 días"],
            ["30dRatio", "Últimos 30 días"],
            ["90dRatio", "Últimos 90 días"]
        ]
        // La API devuelve {ratio, label, color} o string según el periodo
        els.uptimeGrid.innerHTML = rows.map(([k, label]) => {
            const raw = m[k]
            const val = raw && typeof raw === "object" ? raw.ratio : raw
            return `
            <div class="uptime-card">
                <span class="uptime-value">${pct(val)}</span>
                <span class="uptime-label">${label}</span>
            </div>`
        }).join("")

        const stats = m.responseTimeStats || {}
        document.getElementById("resp-avg").textContent =
            stats.avg_response_time != null ? stats.avg_response_time + " ms" : "—"
        document.getElementById("resp-min").textContent =
            stats.min_response_time != null ? stats.min_response_time + " ms" : "—"
        document.getElementById("resp-max").textContent =
            stats.max_response_time != null ? stats.max_response_time + " ms" : "—"
        document.getElementById("resp-total").textContent =
            stats.total_requests != null ? Number(stats.total_requests).toLocaleString("es-MX") : "—"
        renderSparkline(Array.isArray(m.responseTimes) ? m.responseTimes : [])

        const ratios = Array.isArray(m.dailyRatios) ? m.dailyRatios : []
        els.bars.innerHTML = ratios.map(d => `
            <span class="history-bar" title="${d.date}: ${pct(d.ratio)}" style="background:${barColor(d.ratio, d.color)}"></span>`).join("")
        els.barsCount.textContent = ratios.length > 0 ? `${ratios.length} días monitoreados` : "Sin historial disponible"

        const logs = Array.isArray(m.logs) ? m.logs.slice(0, 7) : []
        els.events.innerHTML = logs.length === 0
            ? '<li class="event-item"><i class="fas fa-circle-info"></i> Sin eventos registrados recientemente.</li>'
            : logs.map(l => {
                const up = l.label === "up"
                const reason = l.reason || {}
                const short = reason.detail ? reason.detail.short || "" : ""
                return `
                    <li class="event-item">
                        <span class="event-icon ${up ? "ev-up" : "ev-down"}"><i class="fas ${up ? "fa-arrow-up" : "fa-triangle-exclamation"}"></i></span>
                        <div class="event-body">
                            <p class="event-title">${up ? "Comprobación exitosa" : `Caída detectada${reason.code ? ` · HTTP ${reason.code}` : ""}${short ? ` — ${short}` : ""}`}</p>
                            <p class="event-date">${fmtDate(l.dateGMTISO)}</p>
                        </div>
                    </li>`
            }).join("")

        els.updated.textContent = `Actualizado a las ${new Date().toLocaleTimeString("es-MX")} · refresco automático cada minuto`
        els.loading.style.display = "none"
        els.main.style.display = "block"
    }

    async function load() {
        try {
            const data = await fetchData()
            render(data)
        } catch (e) {
            renderError()
        }
    }

    function init() {
        els.main = document.getElementById("status-main")
        els.hero = document.getElementById("status-hero")
        els.pill = document.getElementById("status-pill")
        els.sub = document.getElementById("status-sub")
        els.uptimeGrid = document.getElementById("uptime-grid")
        els.bars = document.getElementById("history-bars")
        els.barsCount = document.getElementById("history-count")
        els.events = document.getElementById("events-list")
        els.updated = document.getElementById("status-updated")
        els.error = document.getElementById("status-error")
        els.loading = document.getElementById("status-loading")
        if (!els.main) return

        const officialLinks = document.querySelectorAll("[data-official-link]")
        officialLinks.forEach(a => { a.href = OFFICIAL_URL })

        load()
        setInterval(load, REFRESH_MS)
    }

    window.FGPStatus = { load, render, fetchData, init, OFFICIAL_URL }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init)
    } else {
        init()
    }
})()
