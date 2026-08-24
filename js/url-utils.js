// Utilidades de URL compartidas (index/details)
// - Tipos cortos: movies→m, series→s (param "t")
// - Compresión de ids: si el id es hexadecimal que decodifica a texto ASCII
//   imprimible, se guarda como base64url del texto con prefijo "~".
//   Ej: "656c6d656a6f72696e666172746f64656d6976696461" (44) → "~ZWxtZWpvcmluZmFydG9kZW1pdmlkYQ" (31)
;(function () {
    function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
        }
        return bytes
    }

    function b64urlEncodeBytes(bytes) {
        let bin = ""
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
        return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    }

    function b64urlDecodeToBytes(str) {
        const b64 = str.replace(/-/g, "+").replace(/_/g, "/")
        const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : ""
        const bin = atob(b64 + pad)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        return bytes
    }

    // Comprime un id para URLs compartidas (idempotente y sin ambigüedad: usa "~")
    function compressId(rawId) {
        const id = String(rawId || "")
        if (!id || id.startsWith("~")) return id
        if (/^[0-9a-fA-F]+$/.test(id) && id.length % 2 === 0 && id.length >= 4) {
            try {
                const bytes = hexToBytes(id)
                const asciiChars = []
                let printable = true
                for (let i = 0; i < bytes.length; i++) {
                    if (bytes[i] < 0x20 || bytes[i] > 0x7e) { printable = false; break }
                    asciiChars.push(String.fromCharCode(bytes[i]))
                }
                if (printable) {
                    const encoded = "~" + b64urlEncodeBytes(bytes)
                    if (encoded.length < id.length) return encoded
                }
            } catch (e) { /* caer al id original */ }
        }
        return id
    }

    // Reconstruye el id original desde una URL compartida
    function decompressId(value) {
        let val = String(value == null ? "" : value)
        try { val = decodeURIComponent(val) } catch (e) { /* ya legible */ }
        if (!val.startsWith("~")) return val
        try {
            const bytes = b64urlDecodeToBytes(val.slice(1))
            let text = ""
            let hex = ""
            for (let i = 0; i < bytes.length; i++) {
                if (bytes[i] > 0x7e) return val // no era nuestro formato
                text += String.fromCharCode(bytes[i])
                hex += bytes[i].toString(16).padStart(2, "0")
            }
            return text ? hex : val
        } catch (e) {
            return val
        }
    }

    function shortType(type) {
        return type === "series" ? "s" : "m"
    }

    function typeFromShort(short) {
        if (short === "s") return "series"
        if (short === "m") return "movies"
        return null
    }

    // URL compacta canónica hacia la página de detalle
    function buildDetailUrl(type, rawId) {
        const t = shortType(type)
        const id = encodeURIComponent(compressId(rawId))
        return `details.html?t=${t}&id=${id}`
    }

    window.FGPUrl = { compressId, decompressId, shortType, typeFromShort, buildDetailUrl }
})()
