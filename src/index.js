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

// Servidores oficiales de streaming de Cinejoy
const CINEJOY_SERVERS = [
  { id: "Lisbon", name: "Lisbon", quality: "4K Ultra HD", speed: "Rápido" },
  { id: "secret", name: "Secret", quality: "4K Ultra HD", speed: "Ultra" },
  { id: "Nebula", name: "Nebula", quality: "1080p Full HD", speed: "Estable" },
  { id: "Solara", name: "Solara", quality: "1080p Rápido", speed: "Rápido" },
  { id: "Athens", name: "Athens", quality: "HD", speed: "Reserva" }
];

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
    ids: { tmdb: id },
    open: {
      screen: {
        args: { ref }
      }
    }
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
// 4. RESOLVE: Enlace reproducible en alta calidad
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

  // Consultar metadatos para obtener título exacto e IMDb ID
  let mediaTitle = "CineJoy Media";
  let imdbId = null;

  try {
    const details = await tmdbFetch(`/${kind === "tv" ? "tv" : "movie"}/${id}`);
    if (details) {
      mediaTitle = details.title || details.name || "CineJoy Media";
      imdbId = details.imdb_id || null;
    }
  } catch (e) {
    // Continuar con resolución
  }

  // Fuentes principales
  const isMovie = kind === "movie";
  
  const primaryStream = isMovie
    ? `https://vidsrc.me/embed/movie?tmdb=${id}`
    : `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`;

  const lisbon4k = isMovie
    ? `https://vidlink.pro/movie/${id}`
    : `https://vidlink.pro/tv/${id}/${season}/${episode}`;

  const autoEmbed = isMovie
    ? `https://autoembed.co/movie/tmdb/${id}`
    : `https://autoembed.co/tv/tmdb/${id}/${season}/${episode}`;

  const superEmbed = isMovie
    ? `https://player.smashystream.com/movie/${id}`
    : `https://player.smashystream.com/tv/${id}/${season}/${episode}`;

  return {
    url: primaryStream,
    title: mediaTitle,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://cinejoy.pk/"
    },
    alternatives: [
      {
        label: "Lisbon (4K Ultra HD)",
        url: lisbon4k
      },
      {
        label: "AutoEmbed (1080p HD)",
        url: autoEmbed
      },
      {
        label: "Smashy (1080p Rápido)",
        url: superEmbed
      }
    ],
    subtitles: [
      {
        lang: "es",
        label: "Español Latino",
        url: `https://subtitles.cinejoy.pk/sub/${imdbId || id}/es.vtt`,
        default: true
      },
      {
        lang: "en",
        label: "English",
        url: `https://subtitles.cinejoy.pk/sub/${imdbId || id}/en.vtt`
      }
    ]
  };
}

// ==========================================
// 5. SCREEN: Pantalla nativa interactiva (apiVersion 14)
// ==========================================
export async function screen(params = {}) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());

  const args = params.args || params.query || {};
  const currentTab = args.tab || "trending";

  // Si se solicita el detalle de una película/serie
  if (args.ref) {
    return await renderDetailScreen(args.ref);
  }

  // Pantalla principal: obtener contenido de la pestaña seleccionada
  let items = [];
  if (currentTab === "movies") {
    const data = await tmdbFetch("/movie/popular");
    items = data?.results?.slice(0, 18).map(i => formatKinoItem(i, "movie")) || [];
  } else if (currentTab === "series") {
    const data = await tmdbFetch("/tv/popular");
    items = data?.results?.slice(0, 18).map(i => formatKinoItem(i, "series")) || [];
  } else if (currentTab === "action") {
    const data = await tmdbFetch("/discover/movie", { with_genres: "28" });
    items = data?.results?.slice(0, 18).map(i => formatKinoItem(i, "movie")) || [];
  } else {
    // Trending por defecto
    const data = await tmdbFetch("/trending/all/day");
    items = data?.results?.slice(0, 18).map(i => formatKinoItem(i)) || [];
  }

  // Construir rejilla de títulos
  const gridChildren = items.map(item => ({
    type: "Card",
    variant: "outlined",
    onTap: {
      event: "openDetail",
      arg: item.ref
    },
    children: [
      {
        type: "Column",
        children: [
          {
            type: "Image",
            src: item.poster || "https://cinejoy.pk/meta.png",
            fit: "cover",
            height: 180,
            radius: 8
          },
          {
            type: "Text",
            text: item.title,
            style: "label",
            weight: "bold",
            maxLines: 1,
            canRequestFocus: true
          },
          {
            type: "Row",
            justify: "spaceBetween",
            children: [
              {
                type: "Text",
                text: item.year ? String(item.year) : "",
                style: "caption"
              },
              {
                type: "Text",
                text: item.rating ? `★ ${item.rating}` : "",
                style: "caption",
                weight: "bold"
              }
            ]
          }
        ]
      }
    ]
  }));

  // Árbol Scaffold completo conforme a la especificación de Kino
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      title: "CineJoy",
      mergeWithKinoBar: true,
      dense: true,
      leading: {
        type: "IconButton",
        icon: "close",
        labelText: "Cerrar",
        onPressed: {
          go: { close: true }
        }
      },
      bottom: {
        type: "TabBar",
        active: currentTab,
        onChange: { event: "changeTab" },
        tabs: [
          { label: "Tendencias", value: "trending" },
          { label: "Películas", value: "movies" },
          { label: "Series TV", value: "series" },
          { label: "Acción", value: "action" }
        ]
      }
    },
    body: {
      type: "SingleChildScrollView",
      children: [
        {
          type: "Column",
          children: [
            // Banner de bienvenida estilo Card
            {
              type: "Card",
              variant: "filled",
              children: [
                {
                  type: "Row",
                  align: "center",
                  children: [
                    {
                      type: "Icon",
                      icon: "play_circle_filled",
                      size: 32
                    },
                    {
                      type: "Column",
                      children: [
                        {
                          type: "Text",
                          text: "CineJoy: Películas y Series en Streaming",
                          style: "h4",
                          weight: "bold",
                          canRequestFocus: true
                        },
                        {
                          type: "Text",
                          text: "Explora estrenos, series completas y películas con subtítulos en español.",
                          style: "caption",
                          canRequestFocus: true
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            // Rejilla de contenido
            {
              type: "GridView",
              columns: 3,
              children: gridChildren
            }
          ]
        }
      ]
    }
  };
}

// Pantalla de detalle de una película o serie
async function renderDetailScreen(ref) {
  const parts = ref.split(":");
  const kind = parts[0];
  const id = parts[1];

  const data = await tmdbFetch(`/${kind === "tv" ? "tv" : "movie"}/${id}`);
  if (!data) {
    return {
      type: "Scaffold",
      appBar: {
        type: "AppBar",
        title: "No encontrado",
        mergeWithKinoBar: true,
        dense: true,
        leading: {
          type: "IconButton",
          icon: "arrow_back",
          labelText: "Atrás",
          onPressed: { event: "backToMain" }
        }
      },
      body: {
        type: "Text",
        text: "El título solicitado no está disponible.",
        style: "p"
      }
    };
  }

  const title = data.title || data.name || "Detalle";
  const year = (data.release_date || data.first_air_date || "").slice(0, 4);
  const rating = data.vote_average ? `${Math.round(data.vote_average * 10) / 10}` : "";
  const overview = data.overview || "Sin sinopsis disponible.";
  const backdrop = data.backdrop_path ? `${TMDB_BACKDROP_BASE}${data.backdrop_path}` : undefined;

  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      title: title,
      mergeWithKinoBar: true,
      dense: true,
      leading: {
        type: "IconButton",
        icon: "arrow_back",
        labelText: "Volver",
        onPressed: {
          event: "backToMain"
        }
      }
    },
    body: {
      type: "SingleChildScrollView",
      children: [
        {
          type: "Column",
          children: [
            ifPresent(backdrop, {
              type: "Image",
              src: backdrop,
              fit: "cover",
              height: 200,
              radius: 12
            }),
            {
              type: "Row",
              justify: "spaceBetween",
              align: "center",
              children: [
                {
                  type: "Text",
                  text: `${title} (${year})`,
                  style: "h3",
                  weight: "bold",
                  canRequestFocus: true
                },
                {
                  type: "Badge",
                  label: `★ ${rating}`
                }
              ]
            },
            {
              type: "Button",
              label: "Reproducir ahora en CineJoy",
              variant: "primary",
              onPressed: {
                go: {
                  play: { id: ref.replace(/:/g, "_") }
                }
              }
            },
            {
              type: "Text",
              text: overview,
              style: "p",
              canRequestFocus: true
            }
          ].filter(Boolean)
        }
      ]
    }
  };
}

function ifPresent(cond, val) {
  return cond ? val : undefined;
}

// ==========================================
// 6. SCREEN EVENT: Manejador de eventos de usuario
// ==========================================
export async function screenEvent({ event, data }) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());

  if (event === "changeTab") {
    const newTab = data?.value || "trending";
    const newScreen = await screen({ args: { tab: newTab } });
    return {
      update: newScreen
    };
  }

  if (event === "openDetail") {
    const detailScreen = await renderDetailScreen(data?.ref);
    return {
      push: detailScreen
    };
  }

  if (event === "backToMain") {
    const mainScreen = await screen({ args: { tab: "trending" } });
    return {
      update: mainScreen
    };
  }

  return {};
}
