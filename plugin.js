// src/index.js
var TMDB_API_KEY = "8476a7ab80ad76f0936744df0430e67c";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
var TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";
function getLang() {
  if (typeof kino !== "undefined" && kino.lang === "en-US") {
    return "en-US";
  }
  return "es-MX";
}
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
    throw typeof kino !== "undefined" && kino.error ? kino.error("unavailable", `Error TMDB ${res.status}`, { userMessage: "No pudimos conectar con el cat\xE1logo de Cinejoy" }) : new Error(`TMDB error ${res.status}`);
  }
  return await res.json();
}
function formatKinoItem(item, forcedKind) {
  const isMovie = forcedKind ? forcedKind === "movie" : item.media_type === "movie" || !!item.title;
  const title = item.title || item.name || item.original_title || item.original_name || "Sin t\xEDtulo";
  const dateStr = item.release_date || item.first_air_date || "";
  const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : void 0;
  const id = item.id;
  const kind = isMovie ? "movie" : "series";
  const ref = `${kind}:${id}`;
  const poster = item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : void 0;
  const backdrop = item.backdrop_path ? `${TMDB_BACKDROP_BASE}${item.backdrop_path}` : void 0;
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
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : void 0,
    genres,
    ids: { tmdb: id },
    open: {
      screen: {
        args: { ref }
      }
    }
  };
}
async function home() {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
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
      items: trending.results.slice(0, 20).map((i) => formatKinoItem(i))
    });
  }
  if (popularMovies?.results?.length) {
    rows.push({
      id: "popular_movies",
      title: "Pel\xEDculas m\xE1s vistas",
      genre: "peliculas",
      items: popularMovies.results.slice(0, 20).map((i) => formatKinoItem(i, "movie"))
    });
  }
  if (popularSeries?.results?.length) {
    rows.push({
      id: "popular_series",
      title: "Series aclamadas",
      genre: "series",
      items: popularSeries.results.slice(0, 20).map((i) => formatKinoItem(i, "series"))
    });
  }
  if (action?.results?.length) {
    rows.push({
      id: "action_movies",
      title: "Acci\xF3n y Aventura",
      genre: "accion",
      items: action.results.slice(0, 20).map((i) => formatKinoItem(i, "movie"))
    });
  }
  if (horror?.results?.length) {
    rows.push({
      id: "horror_movies",
      title: "Terror y Misterio",
      genre: "terror",
      items: horror.results.slice(0, 20).map((i) => formatKinoItem(i, "movie"))
    });
  }
  if (scifi?.results?.length) {
    rows.push({
      id: "scifi_movies",
      title: "Ciencia Ficci\xF3n y Fantas\xEDa",
      genre: "ciencia-ficcion",
      items: scifi.results.slice(0, 20).map((i) => formatKinoItem(i, "movie"))
    });
  }
  return rows;
}
async function search(arg) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const q = typeof arg === "string" ? arg : arg?.q || arg?.query || "";
  if (!q || !q.trim()) return [];
  const data = await tmdbFetch("/search/multi", { query: q.trim() });
  if (!data?.results) return [];
  return data.results.filter((i) => (i.media_type === "movie" || i.media_type === "tv") && (i.poster_path || i.backdrop_path)).slice(0, 40).map((i) => formatKinoItem(i));
}
async function episodes(arg) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const ref = typeof arg === "string" ? arg : arg?.ref || "";
  if (!ref || !ref.startsWith("tv:") && !ref.startsWith("series:")) {
    return { episodes: [] };
  }
  const parts = ref.split(":");
  const tvId = parts[1];
  const seriesData = await tmdbFetch(`/tv/${tvId}`);
  if (!seriesData || !seriesData.seasons) return { episodes: [] };
  const regularSeasons = seriesData.seasons.filter((s) => s.season_number > 0);
  const targetSeasonNum = parts[2] ? parseInt(parts[2], 10) : regularSeasons[0]?.season_number || 1;
  const seasonData = await tmdbFetch(`/tv/${tvId}/season/${targetSeasonNum}`);
  if (!seasonData?.episodes) return { episodes: [] };
  const eps = seasonData.episodes.map((ep) => ({
    title: ep.name ? `${ep.episode_number}. ${ep.name}` : `Cap\xEDtulo ${ep.episode_number}`,
    ref: `tv:${tvId}:${targetSeasonNum}:${ep.episode_number}`,
    season: targetSeasonNum,
    number: ep.episode_number,
    overview: ep.overview || "",
    airDate: ep.air_date || "",
    still: ep.still_path ? `${TMDB_IMAGE_BASE}${ep.still_path}` : void 0
  }));
  const seasonsList = regularSeasons.map((s) => ({
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
async function resolve(arg, options = {}) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const ref = typeof arg === "string" ? arg : arg?.ref || "";
  if (!ref) {
    throw typeof kino !== "undefined" && kino.error ? kino.error("not_found", "Referencia vac\xEDa", { userMessage: "No se encontr\xF3 el contenido solicitado" }) : new Error("Referencia vac\xEDa");
  }
  const parts = ref.split(":");
  const kind = parts[0];
  const id = parts[1];
  const season = parts[2] || "1";
  const episode = parts[3] || "1";
  let mediaTitle = "CineJoy Media";
  let imdbId = null;
  try {
    const details = await tmdbFetch(`/${kind === "tv" ? "tv" : "movie"}/${id}`);
    if (details) {
      mediaTitle = details.title || details.name || "CineJoy Media";
      imdbId = details.imdb_id || null;
    }
  } catch (e) {
  }
  const isMovie = kind === "movie";
  const primaryStream = isMovie ? `https://vidsrc.me/embed/movie?tmdb=${id}` : `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`;
  const lisbon4k = isMovie ? `https://vidlink.pro/movie/${id}` : `https://vidlink.pro/tv/${id}/${season}/${episode}`;
  const autoEmbed = isMovie ? `https://autoembed.co/movie/tmdb/${id}` : `https://autoembed.co/tv/tmdb/${id}/${season}/${episode}`;
  const superEmbed = isMovie ? `https://player.smashystream.com/movie/${id}` : `https://player.smashystream.com/tv/${id}/${season}/${episode}`;
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
        label: "Smashy (1080p R\xE1pido)",
        url: superEmbed
      }
    ],
    subtitles: [
      {
        lang: "es",
        label: "Espa\xF1ol Latino",
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
async function screen(params = {}) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const args = params.args || params.query || {};
  const currentTab = args.tab || "trending";
  if (args.ref) {
    return await renderDetailScreen(args.ref);
  }
  let items = [];
  if (currentTab === "movies") {
    const data = await tmdbFetch("/movie/popular");
    items = data?.results?.slice(0, 18).map((i) => formatKinoItem(i, "movie")) || [];
  } else if (currentTab === "series") {
    const data = await tmdbFetch("/tv/popular");
    items = data?.results?.slice(0, 18).map((i) => formatKinoItem(i, "series")) || [];
  } else if (currentTab === "action") {
    const data = await tmdbFetch("/discover/movie", { with_genres: "28" });
    items = data?.results?.slice(0, 18).map((i) => formatKinoItem(i, "movie")) || [];
  } else {
    const data = await tmdbFetch("/trending/all/day");
    items = data?.results?.slice(0, 18).map((i) => formatKinoItem(i)) || [];
  }
  const gridChildren = items.map((item) => ({
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
                text: item.rating ? `\u2605 ${item.rating}` : "",
                style: "caption",
                weight: "bold"
              }
            ]
          }
        ]
      }
    ]
  }));
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
          { label: "Pel\xEDculas", value: "movies" },
          { label: "Series TV", value: "series" },
          { label: "Acci\xF3n", value: "action" }
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
                          text: "CineJoy: Pel\xEDculas y Series en Streaming",
                          style: "h4",
                          weight: "bold",
                          canRequestFocus: true
                        },
                        {
                          type: "Text",
                          text: "Explora estrenos, series completas y pel\xEDculas con subt\xEDtulos en espa\xF1ol.",
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
          labelText: "Atr\xE1s",
          onPressed: { event: "backToMain" }
        }
      },
      body: {
        type: "Text",
        text: "El t\xEDtulo solicitado no est\xE1 disponible.",
        style: "p"
      }
    };
  }
  const title = data.title || data.name || "Detalle";
  const year = (data.release_date || data.first_air_date || "").slice(0, 4);
  const rating = data.vote_average ? `${Math.round(data.vote_average * 10) / 10}` : "";
  const overview = data.overview || "Sin sinopsis disponible.";
  const backdrop = data.backdrop_path ? `${TMDB_BACKDROP_BASE}${data.backdrop_path}` : void 0;
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      title,
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
                  label: `\u2605 ${rating}`
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
  return cond ? val : void 0;
}
async function screenEvent({ event, data }) {
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
export {
  episodes,
  home,
  resolve,
  screen,
  screenEvent,
  search
};
