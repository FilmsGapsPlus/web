// Historial de "Continuar viendo" compartido (index/details)
// - Mezcla películas y series; la fila del index siempre muestra ambos tipos
// - Los episodios vistos se guardan en un mapa INDEPENDIENTE ("seen"),
//   así borrar una entrada o el tope de la lista NUNCA reinicia lo ya visto
// - Formato nuevo: { items: { movies:{}, series:{} }, seen: { serieId: { S01E01:true } } }
//   (migración automática desde el formato antiguo con seenEpisodes dentro de la entrada)
;(function () {
    const HISTORY_KEY = "fgp_watch_history_v1"
    const MAX_PER_TYPE = 25

    function normalize(raw) {
        const out = { items: { movies: {}, series: {} }, seen: {} }
        if (!raw || typeof raw !== "object") return out

        const legacyItems = raw.items || { movies: raw.movies || {}, series: raw.series || {} }
        ;["movies", "series"].forEach(type => {
            Object.keys(legacyItems[type] || {}).forEach(id => {
                out.items[type][id] = legacyItems[type][id]
            })
        })

        // Migrar seenEpisodes del formato viejo + respetar mapa seen nuevo
        ;["movies", "series"].forEach(type => {
            Object.values(out.items[type]).forEach(entry => {
                if (entry && entry.seenEpisodes) {
                    out.seen[entry.id] = Object.assign(out.seen[entry.id] || {}, entry.seenEpisodes)
                    delete entry.seenEpisodes
                }
            })
        })
        if (raw.seen && typeof raw.seen === "object") {
            Object.keys(raw.seen).forEach(sid => {
                out.seen[sid] = Object.assign(out.seen[sid] || {}, raw.seen[sid])
            })
        }
        return out
    }

    function load() {
        try {
            return normalize(JSON.parse(localStorage.getItem(HISTORY_KEY)))
        } catch (e) { /* corrupto */ }
        return normalize(null)
    }

    // Cuota llena de localStorage (típico en móvil con muchas cachés de red):
    // sin liberar espacio, el guardado del historial/vistos falla en silencio y
    // al recargar todo se pierde. Descartamos la mitad más antigua de las
    // cachés de red (prefijo filmsgapsplus_fetch_) y reintentamos una vez.
    function freeCacheSpace() {
        try {
            const entries = []
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (!key || key.indexOf("filmsgapsplus_fetch_") !== 0) continue
                let ts = 0
                try { ts = (JSON.parse(localStorage.getItem(key)) || {}).timestamp || 0 } catch (err) {}
                entries.push({ key, ts })
            }
            entries.sort((a, b) => a.ts - b.ts)
            entries.slice(0, Math.ceil(entries.length / 2)).forEach(e => {
                try { localStorage.removeItem(e.key) } catch (err) {}
            })
        } catch (e) {}
    }

    function save(history) {
        const payload = JSON.stringify(history)
        try {
            localStorage.setItem(HISTORY_KEY, payload)
        } catch (e) {
            freeCacheSpace()
            try { localStorage.setItem(HISTORY_KEY, payload) } catch (err) { /* nada más que hacer */ }
        }
    }

    // entry: { type:"movies"|"series", id, titulo, post, miniature,
    //          seasonIdx?, epIdx?, epTitle?, epNumero? }
    function add(entry) {
        if (!entry || !entry.type || !entry.id) return
        const history = load()
        const bucket = history.items[entry.type] || (history.items[entry.type] = {})
        const prev = bucket[entry.id] || {}
        const merged = { ...prev, ...entry, ts: Date.now() }
        if (prev.seasonIdx !== undefined && entry.seasonIdx === undefined) {
            merged.seasonIdx = prev.seasonIdx
            merged.epIdx = prev.epIdx
            merged.epTitle = prev.epTitle
            merged.epNumero = prev.epNumero
        }
        bucket[entry.id] = merged

        // Tope por tipo (los más viejos fuera); "seen" vive aparte y no se toca
        const keys = Object.keys(bucket)
        if (keys.length > MAX_PER_TYPE) {
            keys.sort((a, b) => (bucket[a].ts || 0) - (bucket[b].ts || 0))
            keys.slice(0, keys.length - MAX_PER_TYPE).forEach(k => delete bucket[k])
        }
        save(history)
        return merged
    }

    function remove(type, id) {
        const history = load()
        if (history.items[type]) {
            delete history.items[type][id]
            save(history)
        }
    }

    function clear() {
        try { localStorage.removeItem(HISTORY_KEY) } catch (e) { /* noop */ }
    }

    // Lista combinada películas + series, más recientes primero
    function listAll() {
        const history = load()
        const all = []
        Object.keys(history.items.movies).forEach(id => all.push(history.items.movies[id]))
        Object.keys(history.items.series).forEach(id => all.push(history.items.series[id]))
        return all.sort((a, b) => (b.ts || 0) - (a.ts || 0))
    }

    function markEpisodeSeen(seriesId, epNumero) {
        if (!seriesId || !epNumero) return
        const history = load()
        history.seen[seriesId] = history.seen[seriesId] || {}
        history.seen[seriesId][epNumero] = true
        save(history)
    }

    function isEpisodeSeen(seriesId, epNumero) {
        if (!seriesId || !epNumero) return false
        const history = load()
        return !!(history.seen[seriesId] && history.seen[seriesId][epNumero])
    }

    window.FGPHistory = { load, add, remove, clear, listAll, markEpisodeSeen, isEpisodeSeen }
})()
