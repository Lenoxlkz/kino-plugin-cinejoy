/**
 * CineJoy Plugin for Kino (Video, TV, Movies & Series)
 * apiVersion: 14 (Screen UI, Flutter-style components for Mobile and TV)
 * Catálogo y streaming de películas y series de alta calidad de Cinejoy (cinejoy.pk)
 */

// Clave oficial extraída del cliente de Cinejoy
const TMDB_API_KEY = "8476a7ab80ad76f0936744df0430e67c";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";

// Ayudante para idioma según la configuración de Kino
function getLang() {
  if (typeof kino !== "undefined" && kino.lang === "en-US") {
    return "en-US";
  }
  return "es-MX";
}

// Cliente seguro para TMDB con kino.fetch
async function tmdbFetch(endpoint, queryParams = {}) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: getLang(),
    include_adult: "false",
    ...queryParams
  });

  const url = `${TMDB_BASE_URL}${endpoint}?${params.toString()}`;
  
  const fetchFn = typeof kino !== "undefined" && kino.fetch ? kino.fetch : globalThis.fetch;
  const res = await fetchFn(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "CineJoy-Kino-Plugin/1.0"
    }
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw (typeof kino !== "undefined" && kino.error) 
      ? kino.error("unavailable", `Error TMDB ${res.status}`, { userMessage: "No pudimos conectar con el catálogo de Cinejoy" })
      : new Error(`TMDB error ${res.status}`);
  }

  return await res.json();
}

// Mapeo canónico de película o serie al formato de Kino
function formatKinoItem(item, forcedKind) {
  const isMovie = forcedKind ? forcedKind === "movie" : (item.media_type === "movie" || !!item.title);
  const title = item.title || item.name || item.original_title || item.original_name || "Sin título";
  const dateStr = item.release_date || item.first_air_date || "";
  const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : undefined;
  const id = item.id;
  const kind = isMovie ? "movie" : "series";
  const ref = `${kind}:${id}`;

  const poster = item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined;
  const backdrop = item.backdrop_path ? `${TMDB_BACKDROP_BASE}${item.backdrop_path}` : undefined;

  // Asignar categorías de Kino
  const genres = [kind === "movie" ? "peliculas" : "series"];
  if (item.genre_ids && Array.isArray(item.genre_ids)) {
    if (item.genre_ids.includes(28) || item.genre_ids.includes(10759)) genres.push("accion");
    if (item.genre_ids.includes(35)) genres.push("comedia");
    if (item.genre_ids.includes(18)) genres.push("drama");
    if (item.genre_ids.includes(27) || item.genre_ids.includes(9648)) genres.push("terror");
    if (item.genre_ids.includes(878) || item.genre_ids.includes(10765)) genres.push("ciencia-ficcion");
    if (item.genre_ids.includes(16)) genres.push("animacion");
  }

  return {
    id: `${kind}_${id}`,
    title,
    ref,
    kind,
    year,
    poster,
    backdrop,
    overview: item.overview || "",
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : undefined,
    genres,
    ids: { tmdb: id }
  };
}

// ==========================================
// 1. HOME: Filas destacadas de la portada
// ==========================================
export async function home() {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());

  // Consultar en paralelo secciones clave de CineJoy
  const [trending, popularMovies, popularSeries, action, horror, scifi] = await Promise.all([
    tmdbFetch("/trending/all/week"),
    tmdbFetch("/movie/popular"),
    tmdbFetch("/tv/popular"),
    tmdbFetch("/discover/movie", { with_genres: "28", sort_by: "popularity.desc" }),
    tmdbFetch("/discover/movie", { with_genres: "27", sort_by: "popularity.desc" }),
    tmdbFetch("/discover/movie", { with_genres: "878", sort_by: "popularity.desc" })
  ]);

  const rows = [];

  if (trending?.results?.length) {
    rows.push({
      id: "trending",
      title: "CineJoy: Tendencias y Estrenos",
      genre: "estrenos",
      items: trending.results.slice(0, 20).map(i => formatKinoItem(i))
    });
  }

  if (popularMovies?.results?.length) {
    rows.push({
      id: "popular_movies",
      title: "Películas más vistas",
      genre: "peliculas",
      items: popularMovies.results.slice(0, 20).map(i => formatKinoItem(i, "movie"))
    });
  }

  if (popularSeries?.results?.length) {
    rows.push({
      id: "popular_series",
      title: "Series aclamadas",
      genre: "series",
      items: popularSeries.results.slice(0, 20).map(i => formatKinoItem(i, "series"))
    });
  }

  if (action?.results?.length) {
    rows.push({
      id: "action_movies",
      title: "Acción y Aventura",
      genre: "accion",
      items: action.results.slice(0, 20).map(i => formatKinoItem(i, "movie"))
    });
  }

  if (horror?.results?.length) {
    rows.push({
      id: "horror_movies",
      title: "Terror y Misterio",
      genre: "terror",
      items: horror.results.slice(0, 20).map(i => formatKinoItem(i, "movie"))
    });
  }

  if (scifi?.results?.length) {
    rows.push({
      id: "scifi_movies",
      title: "Ciencia Ficción y Fantasía",
      genre: "ciencia-ficcion",
      items: scifi.results.slice(0, 20).map(i => formatKinoItem(i, "movie"))
    });
  }

  return rows;
}

// ==========================================
// 2. SEARCH: Búsqueda unificada en el catálogo
// ==========================================
export async function search(arg) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());

  const q = typeof arg === "string" ? arg : (arg?.q || arg?.query || "");
  if (!q || !q.trim()) return [];

  const data = await tmdbFetch("/search/multi", { query: q.trim() });
  if (!data?.results) return [];

  return data.results
    .filter(i => (i.media_type === "movie" || i.media_type === "tv") && (i.poster_path || i.backdrop_path))
    .slice(0, 40)
    .map(i => formatKinoItem(i));
}

// ==========================================
// 3. EPISODES: Guía de temporadas y capítulos
// ==========================================
export async function episodes(arg) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());

  const ref = typeof arg === "string" ? arg : (arg?.ref || "");
  if (!ref || (!ref.startsWith("tv:") && !ref.startsWith("series:"))) {
    return { episodes: [] };
  }

  const parts = ref.split(":");
  const tvId = parts[1];

  // Obtener información de temporadas de la serie
  const seriesData = await tmdbFetch(`/tv/${tvId}`);
  if (!seriesData || !seriesData.seasons) return { episodes: [] };

  // Filtrar temporadas oficiales (excluyendo especiales si se desea, o incluyéndolas)
  const regularSeasons = seriesData.seasons.filter(s => s.season_number > 0);
  const targetSeasonNum = parts[2] ? parseInt(parts[2], 10) : (regularSeasons[0]?.season_number || 1);

  // Consultar capítulos de la temporada objetivo
  const seasonData = await tmdbFetch(`/tv/${tvId}/season/${targetSeasonNum}`);
  if (!seasonData?.episodes) return { episodes: [] };

  const eps = seasonData.episodes.map(ep => ({
    title: ep.name ? `${ep.episode_number}. ${ep.name}` : `Capítulo ${ep.episode_number}`,
    ref: `tv:${tvId}:${targetSeasonNum}:${ep.episode_number}`,
    season: targetSeasonNum,
    number: ep.episode_number,
    overview: ep.overview || "",
    airDate: ep.air_date || "",
    still: ep.still_path ? `${TMDB_IMAGE_BASE}${ep.still_path}` : undefined
  }));

  const seasonsList = regularSeasons.map(s => ({
    id: `season_${s.season_number}`,
    number: s.season_number,
    title: s.name || `Temporada ${s.season_number}`,
    ref: `tv:${tvId}:${s.season_number}`
  }));

  return {
    episodes: eps,
    seasons: seasonsList
  };
}

// ==========================================
// 4. RESOLVE: Enlace reproducible en alta calidad (HLS .m3u8 nativo para ExoPlayer)
// ==========================================
export async function resolve(arg, options = {}) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());

  const ref = typeof arg === "string" ? arg : (arg?.ref || "");
  if (!ref) {
    throw (typeof kino !== "undefined" && kino.error)
      ? kino.error("not_found", "Referencia vacía", { userMessage: "No se encontró el contenido solicitado" })
      : new Error("Referencia vacía");
  }

  const parts = ref.split(":");
  const kind = parts[0];
  const id = parts[1];
  const season = parts[2] || "1";
  const episode = parts[3] || "1";
  const isMovie = kind === "movie";

  // Consultar metadatos en TMDB incluyendo external_ids para obtener IMDb ID
  let mediaTitle = "CineJoy Media";
  let imdbId = null;

  try {
    const details = await tmdbFetch(`/${isMovie ? "movie" : "tv"}/${id}`, {
      append_to_response: "external_ids"
    });
    if (details) {
      mediaTitle = details.title || details.name || "CineJoy Media";
      if (!isMovie) {
        mediaTitle += ` - T${season}:E${episode}`;
      }
      imdbId = details.external_ids?.imdb_id || details.imdb_id || null;
    }
  } catch (e) {
    // Si falla TMDB, continuar
  }

  const fetchFn = typeof kino !== "undefined" && kino.fetch ? kino.fetch : globalThis.fetch;
  let streams = [];

  // Solo aceptamos recursos multimedia directos. Una página HTML de embed (o una respuesta
  // de error del resolvedor) no es reproducible por ExoPlayer aunque tenga una URL HTTPS.
  const parseDirectStream = (entry) => {
    const item = typeof entry === "string" ? { url: entry } : entry;
    if (!item || typeof item !== "object") return null;

    const url = item.url || item.stream_url || item.src || item.file || item.master_m3u8;
    if (typeof url !== "string") return null;
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return null;
    }
    if (parsed.protocol !== "https:" || !parsed.hostname) return null;

    const declaredMime = String(item.mime || item.mime_type || item.content_type || "").toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const isHls = path.endsWith(".m3u8") || declaredMime.includes("mpegurl") || declaredMime.includes("vnd.apple.mpegurl");
    const isMp4 = path.endsWith(".mp4") || declaredMime.startsWith("video/mp4");
    if (!isHls && !isMp4) return null;

    return {
      url,
      // Media3 / ExoPlayer's canonical HLS MIME. The vendor alias is valid too, but the
      // canonical value avoids older player builds treating an HLS URL as progressive media.
      mime: isHls ? "application/x-mpegURL" : "video/mp4",
      label: typeof item.label === "string" ? item.label : typeof item.server === "string" ? item.server : undefined,
      headers: item.headers && typeof item.headers === "object" && !Array.isArray(item.headers) ? item.headers : {}
    };
  };

  // 1. Obtener flujos HLS/MP4 directos desde el resolvedor CDN de CineJoy.
  if (imdbId) {
    try {
      const params = new URLSearchParams({ imdb: imdbId, type: isMovie ? "movie" : "tv" });
      if (!isMovie) {
        params.set("season", season);
        params.set("episode", episode);
      }
      const apiEndpoint = `https://streamdata.vaplayer.ru/api.php?${params.toString()}`;
      const res = await fetchFn(apiEndpoint, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "CineJoy-Kino-Plugin/1.0"
        }
      });

      if (res.ok) {
        const json = await res.json();
        const statusCode = String(json?.status_code ?? json?.status ?? "");
        const entries = json?.data?.stream_urls ?? json?.stream_urls;
        if ((statusCode === "200" || statusCode.toLowerCase() === "success") && Array.isArray(entries)) {
          const seen = new Set();
          streams = entries.map(parseDirectStream).filter(stream => {
            if (!stream || seen.has(stream.url)) return false;
            seen.add(stream.url);
            return true;
          }).slice(0, 9);
        }
      }
    } catch (e) {
      // Fall through to the user-facing unavailable error below.
    }
  }

  // 2. Si no hay streams directos encontrados
  if (!streams.length) {
    throw (typeof kino !== "undefined" && kino.error)
      ? kino.error("unavailable", "Servidores de video no disponibles", {
          userMessage: `Los servidores de streaming de CineJoy no tienen señal activa en este momento para "${mediaTitle}". Por favor intenta con otra película o episodio.`
        })
      : new Error("No hay servidores de video disponibles");
  }

  // Cabeceras indispensables para que ExoPlayer en Android y TV no sea rechazado por el CDN
  const streamHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://brightpathsignals.com/",
    "Origin": "https://brightpathsignals.com"
  };

  const primary = streams[0];
  const alternatives = streams.slice(1, 9).map((stream, idx) => ({
    url: stream.url,
    mime: stream.mime,
    label: stream.label || `Servidor alternativo ${idx + 1}`,
    headers: { ...streamHeaders, ...stream.headers }
  }));

  return {
    url: primary.url,
    mime: primary.mime,
    label: primary.label || "Servidor principal",
    title: mediaTitle,
    headers: { ...streamHeaders, ...primary.headers },
    alternatives,
    subtitles: []
  };
}

// ==========================================
// 5. SCREEN: Pantalla nativa interactiva (apiVersion 14)
// ==========================================
export async function screen(context = {}) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());

  const currentTab = context?.state?.tab || context?.args?.tab || "trending";

  // Consultar catálogo según la pestaña seleccionada
  let items = [];
  if (currentTab === "movies") {
    const data = await tmdbFetch("/movie/popular");
    items = data?.results?.slice(0, 30).map(i => formatKinoItem(i, "movie")) || [];
  } else if (currentTab === "series") {
    const data = await tmdbFetch("/tv/popular");
    items = data?.results?.slice(0, 30).map(i => formatKinoItem(i, "series")) || [];
  } else if (currentTab === "action") {
    const data = await tmdbFetch("/discover/movie", { with_genres: "28" });
    items = data?.results?.slice(0, 30).map(i => formatKinoItem(i, "movie")) || [];
  } else {
    // Trending por defecto
    const data = await tmdbFetch("/trending/all/day");
    items = data?.results?.slice(0, 30).map(i => formatKinoItem(i)) || [];
  }

  // Árbol Scaffold nativo con titleGrid (pósteres en 2:3, D-pad en TV y go.title automático)
  return {
    type: "scaffold",
    appBar: {
      type: "appBar",
      title: "CineJoy",
      mergeWithKinoBar: true,
      dense: true,
      leading: {
        type: "button",
        variant: "icon",
        icon: "close",
        label: "Cerrar",
        onTap: {
          go: { close: true }
        }
      },
      bottom: {
        type: "tabs",
        tabs: [
          { label: "Tendencias", value: "trending" },
          { label: "Películas", value: "movies" },
          { label: "Series TV", value: "series" },
          { label: "Acción", value: "action" }
        ],
        value: currentTab,
        onChange: { event: "changeTab" }
      }
    },
    body: {
      type: "titleGrid",
      items: items
    }
  };
}

// ==========================================
// 6. SCREEN EVENT: Manejador de eventos de usuario
// ==========================================
export async function screenEvent(event) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());

  const name = event?.name || (typeof event === "string" ? event : "");
  if (name === "changeTab") {
    const tab = event?.value || event?.arg || "trending";
    return {
      state: { tab }
    };
  }

  return {};
}
