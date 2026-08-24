<img src="img/icon_filmsgapsplus.png" alt="FilmsGapsPlus" width="35" height="35" align="left" />

# FilmsGapsPlus — Plataforma de Películas y Series Online

FilmsGapsPlus es una plataforma de streaming que ofrece un catálogo completo de películas y series en alta calidad, con una interfaz intuitiva estilo *Liquid Glass* y una experiencia de usuario optimizada para móvil y escritorio.

**Sin anuncios · Sin registro · 100% gratis**

---

## ✨ Características Principales

### Contenido
- 🎬 **Catálogo extenso**: Películas y series organizadas por géneros, con modal de exploración por género desde cualquier página
- 🔥 **Destacado hoy**: Carrusel automático que rota los títulos destacados cada pocos segundos, con puntos de navegación manual; si no hay conexión usa el último contenido guardado
- 🔍 **Búsqueda en vivo**: Resultados instantáneos mientras escribes
- 🌐 **Múltiples servidores**: Opciones de calidad HD y diferentes idiomas por episodio o película

### Experiencia
- ▶️ **Continuar viendo con posición exacta**: Retoma la serie justo en la temporada y el episodio donde lo dejaste — activa la pestaña correcta, desplaza hasta el episodio y lo resalta; además, un botón dedicado aparece en la página de detalles
- 👥 **Reparto con fotos reales**: Los actores consultan Wikipedia automáticamente; si la imagen falla se muestra un icono limpio de usuario
- 📺 **Episodios al estilo YouTube**: Barra roja de progreso sobre la miniatura de los episodios vistos y badge de numeración S01E01
- 💾 **Historial persistente**: Lo visto se guarda localmente con migración automática y liberación inteligente de espacio cuando el almacenamiento se llena
- 📱 **Responsive real**: Layout adaptado a escritorio, tablet y Android (logo centrado, búsqueda a ancho completo, descripciones de episodios reorganizadas)
- 🟢 **Página de estado**: Monitorización del servicio en tiempo real vía Uptime Robot con auto-refresco
- 🔗 **Compartir bonito**: Meta etiquetas Open Graph y Twitter dinámicas por título — al compartir un enlace se muestra el póster y nombre correctos

### Privacidad
- 🔒 **Privacidad garantizada**: No recopilamos datos personales; todo el historial vive solo en tu navegador

---

## 🛠 Tecnologías Utilizadas

| Área | Tecnología |
|---|---|
| Frontend | HTML5 · CSS3 (variables personalizadas) · JavaScript ES6+ |
| Diseño | Sistema *Liquid Glass* propio, sin frameworks ni librerías de UI |
| Iconos / Fuentes | Font Awesome 6 · Inter (Google Fonts) |
| APIs externas | API de catálogo propia · REST de Wikipedia (fotos de reparto) · Uptime Robot (estado) |
| Almacenamiento | `localStorage` (historial, caché de portadas) |
| Despliegue | GitHub Pages |

> El sitio es **estático y sin proceso de build**: basta un servidor de archivos estáticos para desarrollarlo.

---

## 📁 Estructura del Proyecto

```
web/
├── index.html                 # Inicio: destacados, filas por categoría, continuar viendo
├── details.html               # Detalles de película/serie (?t=m|s&id=…)
├── estado.html                # Estado del servicio (Uptime Robot)
├── terminos.html              # Términos
├── privacidad.html            # Privacidad
├── css/
│   └── styles.css             # Estilos: tokens Liquid Glass, componentes, responsive
├── js/
│   ├── main.js                # Inicio: catálogo, búsqueda, carrusel destacados,
│   │                          #  continuar viendo y modal de géneros
│   ├── details.js             # Detalles: temporadas/episodios, servidores, reparto
│   │                          #  (Wikipedia), reanudar posición y meta OG dinámico
│   ├── history.js             # Historial y "visto" persistentes con control de cuota
│   ├── url-utils.js           # Utilidades de URL y enlaces para compartir
│   ├── footer.js              # Footer compartido entre todas las páginas
│   └── status.js              # Estado del servicio (auto-refresco)
├── img/                       # Assets visuales
└── com.filmsgapsplus.android.json
```

---

## 🚀 Instalación y Uso

No se requiere instalación. La plataforma está disponible directamente en:

- 🔗 [FilmsGapsPlus Web](https://filmsgapsplus.github.io/web)

### Desarrollo local

```bash
# Desde la raíz del proyecto, cualquier servidor estático sirve:
python3 -m http.server 8080
# → http://localhost:8080
```

---

## 📬 Contacto y redes sociales

Para soporte técnico, reporte de errores o sugerencias:

- 📷 [Instagram](https://www.instagram.com/filmsgapsplus)
- ✈️ [Telegram](https://t.me/FilmsGapsPlusSoporte)
- 💻 [GitHub](https://github.com/FilmsGapsPlus/web)

---

## ❤️ Donaciones

Si te gusta el proyecto, puedes apoyarlo:

- [PayPal](https://www.paypal.com/donate/?hosted_button_id=PGFHSUNXYZPDJ)

---

© 2023–2026 FilmsGapsPlus — Todos los derechos reservados.
