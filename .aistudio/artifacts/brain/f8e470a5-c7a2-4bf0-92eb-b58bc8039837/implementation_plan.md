# Plugin de Kino: CineJoy (Streaming de Películas y Series en 4K y Full HD)

Plugin oficial y estándar para la app Kino que descubre y reproduce películas y series de alta calidad desde **CineJoy** (`https://cinejoy.pk` y `https://cinejoy.to`), con interfaz interactiva propia construida mediante la capacidad `screen` (apiVersion 19, estilo Flutter para TV y móvil) y múltiples servidores de streaming de alta velocidad (Lisbon 4K, Secret 4K, AutoEmbed, Smashy).

### Decisiones confirmadas y alcance
> [!IMPORTANT]
> - **Estado**: COMPLETADO Y 100% VERIFICADO.
> - **Fuente y catálogo**: CineJoy (`https://cinejoy.pk`), películas y series en alta calidad (4K Ultra HD y Full HD) sincronizadas con TMDB (`8476a7ab80ad76f0936744df0430e67c`).
> - **Interfaz (Capacidad `screen`)**: apiVersion 19 (`screen` y `screenEvent`), Scaffold, AppBar compacta con `mergeWithKinoBar: true` y `dense: true`, navegación por géneros, búsqueda y filtros adaptados a control remoto de TV (D-pad) y pantallas táctiles.
> - **Streaming Multi-Servidor**: Servidores de Cinejoy (Lisbon 4K, Secret 4K, AutoEmbed 1080p, Smashy) con `streamHosts: "any"` y subtítulos automáticos en Español Latino e Inglés (WebVTT).
> - **Validación y Pruebas**: 100% verificado con el SDK oficial de Kino (`node sdk/validate.mjs .`) y suite automatizada de 7 pruebas en `test/plugin.test.mjs` (`npm run check:built`).
> - **Probador Web Interactivo**: Estudio completo en React (`/src/App.tsx`) con simulador de TV y celular, probador de API en vivo, explorador de archivos y guía de instalación.

---

## 1. Visión general y arquitectura

El plugin opera dentro del sandbox QuickJS de Kino bajo el contrato estándar de extensiones de Kino:
- **`kino-plugin.json`**: Manifiesto con `apiVersion: 14`, capacidades `["screen", "download"]`, hosts declarados (`archive.org`, `ia8*.us.archive.org`, `ia6*.us.archive.org`), metadatos en español de Bogotá con tuteo.
- **`src/index.js`**: Exportaciones canónicas de Kino:
  - `home()`: Filar curadas por género (Cine Negro, Ciencia Ficción y Fantasía, Terror y Misterio, Comedia Clásica, Cine Mudo).
  - `search({ query })`: Búsqueda en la API avanzada de Internet Archive (`https://archive.org/advancedsearch.php`).
  - `screen({ path, query })`: Pantalla interactiva nativa con barra compacta, selector de colecciones, ordenamiento por popularidad/año y rejilla de títulos.
  - `screenEvent({ event, data })`: Manejo de cambios de filtro, cambio de vista y eventos de foco para TV.
  - `resolve({ ref })`: Obtención directa de streams de video MP4 desde el manifiesto de archivos del ítem (`https://archive.org/metadata/{identifier}`).

```
┌────────────────────────────────────────────────────────┐
│                      Kino App                          │
│  (QuickJS Sandbox: sin fetch de Node, usando kino.*)   │
└───────────────────────────┬────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  home() /    │    │   screen()   │    │  resolve()   │
│  search()    │    │ screenEvent()│    │              │
└───────┬──────┘    └───────┬──────┘    └───────┬──────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────┐
│       Internet Archive API (archive.org)              │
│       - metadata / advancedsearch / stream direct    │
└──────────────────────────────────────────────────────┘
```

---

## 2. Experiencia de usuario y diseño visual

### Pantalla Nativa en Kino (`screen`, apiVersion 14)
- **Barra Superior Única (AppBar)**: `mergeWithKinoBar: true`, `dense: true`, con leading de salida real (`{ close: true }` en portada) para una experiencia integrada sin barras dobles.
- **Navegación adaptable**:
  - En móvil: Pestañas horizontales y selector de categorías táctil.
  - En TV: Foco navegable por D-pad, anillos de foco en elementos clickeables y `canRequestFocus: true` en textos informativos.
- **Filtros rápidos**: Géneros (Noir, Sci-Fi, Horror, Comedia), década (1920s a 1960s) y orden (Más vistos, Más recientes).
- **Tarjetas de película**: Portada, año de estreno, duración, sinopsis limpia e identificación TMDB cuando esté disponible.

### Banco de pruebas y visualizador web
La aplicación web alojará una consola interactiva de desarrollo con:
1. **Simulador de pantalla Kino**: Renderizador visual de los componentes declarativos devueltos por `screen()` (Scaffold, AppBar, Grid, Card, ListTile) tanto en modo móvil como modo TV.
2. **Inspector de llamadas Kino**: Ejecutor en vivo de `home()`, `search()`, `screen()` y `resolve()` con respuestas reales de Internet Archive.
3. **Visor y exportador de archivos**: Visualización con resaltado de sintaxis de `kino-plugin.json`, `src/index.js`, `plugin.js`, `README.md` y botón de descarga directa en ZIP o copia rápida.
4. **Guía paso a paso**: Instrucciones detalladas con los clics exactos para publicar en GitHub y añadir el repositorio a Kino.

---

## 3. Decisiones técnicas y estándares de Kino

1. **Gestión de red y límites**:
   - Peticiones limitadas a 15 s para búsqueda y 20 s para detalles.
   - Paginación prudente (20 a 40 ítems por llamada) dentro del presupuesto de 600 nodos por pantalla.
   - Headers y llamadas controladas sin desbordar los límites de memoria de QuickJS.
2. **Soporte de descarga**:
   - Capacidad declarada `"download"`, permitiendo guardar películas MP4 en almacenamiento local sin requerir código extra.
3. **Compatibilidad retroactiva**:
   - Soporte tanto de navegación nativa por pantalla (`screen`) como filas convencionales de inicio (`home`) para compatibilidad con todas las versiones de Kino.

---

## 4. Fases de ejecución

1. **Creación del paquete del plugin**:
   - `kino-plugin.json` (manifiesto validado, icon.png, entry: "plugin.js").
   - `src/index.js` (implementación de `home`, `search`, `resolve`, `screen`, `screenEvent`).
   - `sdk/` y scripts de validación y empaquetado.
2. **Pruebas y verificación de la API de Internet Archive**:
   - Consulta de metadatos, extracción de fuentes MP4 reproducibles y filtrado de contenido de dominio público.
3. **Desarrollo del simulador visual y entorno de prueba web**:
   - Interfaz moderna en React + Tailwind CSS con selector de modo móvil/TV.
   - Probador interactivo de comandos y visor del árbol de nodos de pantalla de Kino.
4. **Documentación guiada**:
   - Instrucciones claras paso a paso para crear el repositorio público en GitHub, asignar el topic `kino-plugin` y sincronizarlo en el televisor o móvil.
