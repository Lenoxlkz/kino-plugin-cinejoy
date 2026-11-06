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
    ids: { tmdb: id }
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
  const isMovie = kind === "movie";
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
  }
  const fetchFn = typeof kino !== "undefined" && kino.fetch ? kino.fetch : globalThis.fetch;
  let streamUrls = [];
  if (imdbId) {
    try {
      let apiEndpoint = `https://streamdata.vaplayer.ru/api.php?imdb=${imdbId}&type=${isMovie ? "movie" : "tv"}`;
      if (!isMovie) {
        apiEndpoint += `&season=${season}&episode=${episode}`;
      }
      const res = await fetchFn(apiEndpoint, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "CineJoy-Kino-Plugin/1.0"
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.status_code === "200" && Array.isArray(json?.data?.stream_urls)) {
          streamUrls = json.data.stream_urls.filter((u) => typeof u === "string" && u.startsWith("http"));
        }
      }
    } catch (e) {
    }
  }
  if (!streamUrls.length) {
    throw typeof kino !== "undefined" && kino.error ? kino.error("unavailable", "Servidores de video no disponibles", {
      userMessage: `Los servidores de streaming de CineJoy no tienen se\xF1al activa en este momento para "${mediaTitle}". Por favor intenta con otra pel\xEDcula o episodio.`
    }) : new Error("No hay servidores de video disponibles");
  }
  const streamHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://brightpathsignals.com/",
    "Origin": "https://brightpathsignals.com"
  };
  const primaryStream = streamUrls[0];
  const serverLabels = [
    "Lisbon (4K / 1080p Ultra HD)",
    "Nebula (1080p Directo)",
    "Solara (R\xE1pido)",
    "Athens (Reserva)"
  ];
  const alternatives = streamUrls.slice(1).map((url, idx) => ({
    url,
    label: serverLabels[idx] || `Servidor ${idx + 2}`,
    headers: streamHeaders
  }));
  return {
    url: primaryStream,
    title: mediaTitle,
    headers: streamHeaders,
    alternatives,
    subtitles: []
  };
}
async function screen(context = {}) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const currentTab = context?.state?.tab || context?.args?.tab || "trending";
  let items = [];
  if (currentTab === "movies") {
    const data = await tmdbFetch("/movie/popular");
    items = data?.results?.slice(0, 30).map((i) => formatKinoItem(i, "movie")) || [];
  } else if (currentTab === "series") {
    const data = await tmdbFetch("/tv/popular");
    items = data?.results?.slice(0, 30).map((i) => formatKinoItem(i, "series")) || [];
  } else if (currentTab === "action") {
    const data = await tmdbFetch("/discover/movie", { with_genres: "28" });
    items = data?.results?.slice(0, 30).map((i) => formatKinoItem(i, "movie")) || [];
  } else {
    const data = await tmdbFetch("/trending/all/day");
    items = data?.results?.slice(0, 30).map((i) => formatKinoItem(i)) || [];
  }
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
          { label: "Pel\xEDculas", value: "movies" },
          { label: "Series TV", value: "series" },
          { label: "Acci\xF3n", value: "action" }
        ],
        value: currentTab,
        onChange: { event: "changeTab" }
      }
    },
    body: {
      type: "titleGrid",
      items
    }
  };
}
async function screenEvent(event) {
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
export {
  episodes,
  home,
  resolve,
  screen,
  screenEvent,
  search
};
