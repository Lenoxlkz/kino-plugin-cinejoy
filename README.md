# CineJoy — Plugin Oficial para Kino TV

Plugin nativo de streaming y catálogo para la aplicación [Kino](https://kinotvapp.github.io/kino-plugins/) (Android TV, Google TV, Fire TV y celulares Android/iOS), basado en el catálogo y servidores de alta velocidad de CineJoy (`cinejoy.pk`).

![CineJoy Kino Plugin](icon.png)

## Características Principales

- **Películas y Series**: Catálogo completo sincronizado con TMDB, pósteres en alta resolución, sinopsis en español e información de actores y géneros.
- **Pantalla Nativa (`apiVersion 19`)**: Interfaz construida con la capacidad declarativa `screen` de Kino, con soporte para control remoto D-pad en televisores y navegación táctil en celulares.
- **Barra Compacta**: AppBar integrada con `mergeWithKinoBar: true` y `dense: true` con navegación limpia y salida directa.
- **Streaming directo para el reproductor nativo**: `resolve()` consulta el resolvedor de CineJoy y acepta únicamente URLs HTTPS reconocidas como HLS (`.m3u8`) o MP4 directo. Las páginas HTML de embeds no se entregan al reproductor ExoPlayer. Las copias alternativas recibidas del resolvedor aparecen en el menú de servidores de Kino y usan las mismas cabeceras de origen.
- **Cabeceras de CDN**: Referer, Origin y User-Agent se adjuntan a las solicitudes de reproducción.
- **Guía de Episodios**: Desglose por temporadas y capítulos individuales con miniaturas y fechas de emisión.

## Requisitos de Compatibilidad

- **Kino**: Versión 0.9.81 o superior (requerida por `apiVersion: 19` para `mergeWithKinoBar`).
- **Dispositivos**: Google TV, Android TV, Amazon Fire TV Stick, teléfonos y tabletas Android/iOS.

## Instalación en Kino

### 1. En Celulares / Tablets (Táctil)
1. Abre Kino y toca el menú lateral (☰) arriba a la izquierda.
2. Selecciona **Plugins** y luego presiona el botón **+** (o *Agregar*).
3. Escribe el nombre del repositorio público de GitHub: `TU_USUARIO/TU_REPO`.
4. Toca **Instalar**. Kino descargará y verificará `kino-plugin.json` y `plugin.js`.
5. CineJoy aparecerá en tu pantalla de inicio y en la sección de complementos.

### 2. En Android TV / Google TV / Fire TV (Control Remoto)
1. Con el control remoto, ve a **Ajustes** (icono de engranaje) o a la pestaña **Plugins**.
2. Selecciona **Agregar Plugin**.
3. Ingresa `TU_USUARIO/TU_REPO` con el teclado en pantalla.
4. Presiona **Aceptar**. La aplicación verificará las firmas y permisos, y activará el plugin.

## Desarrollo y Verificación

```bash
# Instalar dependencias
npm install

# Compilar plugin.js con esbuild
npm run build:plugin

# Validar contrato con el SDK de Kino
npm run validate

# Ejecutar pruebas unitarias automatizadas
npm test

# Ejecutar verificación completa (compilar + validar + pruebas)
npm run check:built
```

## Estructura de Archivos

```
├── kino-plugin.json      # Manifiesto oficial del plugin (apiVersion 19, hosts, capacidades)
├── icon.png              # Icono 256x256 con fondo transparente o sólido
├── plugin.js             # Módulo ES final empaquetado para QuickJS
├── src/
│   └── index.js          # Código fuente modular (home, search, episodes, resolve, screen)
├── sdk/                  # Herramientas de prueba oficiales de Kino (validate.mjs, run.mjs)
├── test/
│   └── plugin.test.mjs   # Pruebas automatizadas de contrato y respuestas
└── contract.json         # Especificación canónica del contrato de Kino
```

## Licencia

Distribuido bajo la licencia MIT. Catálogo y enlaces provistos conforme a los términos de uso de CineJoy y TMDB.
