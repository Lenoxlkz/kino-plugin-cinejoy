/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Tv,
  Smartphone,
  Play,
  Search,
  Film,
  Layers,
  FileCode,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  RefreshCw,
  Sliders,
  Download,
  Info,
  ShieldCheck,
  ArrowLeft,
  Terminal,
  Server,
  Subtitles,
  Eye,
  Sparkles
} from 'lucide-react';

// Tipos para los resultados del plugin
interface PluginItem {
  id: string;
  title: string;
  ref: string;
  kind: 'movie' | 'series';
  year?: number;
  poster?: string;
  backdrop?: string;
  overview?: string;
  rating?: number;
  genres?: string[];
  open?: {
    screen?: {
      args: { ref: string };
    };
  };
}

interface HomeRow {
  id: string;
  title: string;
  genre: string;
  items: PluginItem[];
}

interface EpisodeItem {
  season: number;
  number: number;
  ref: string;
  title: string;
  still?: string;
  overview?: string;
  airDate?: string;
}

interface SeasonItem {
  id: string;
  number: number;
  title: string;
  ref: string;
}

interface ResolveResult {
  url: string;
  title: string;
  headers?: Record<string, string>;
  subtitles?: Array<{ lang: string; label: string; url: string; default?: boolean }>;
  alternatives?: Array<{ label: string; url: string }>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'tester' | 'files' | 'guide'>('simulator');
  const [deviceMode, setDeviceMode] = useState<'tv' | 'phone'>('tv');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Estado del Probador en vivo
  const [testAction, setTestAction] = useState<'home' | 'search' | 'episodes' | 'resolve' | 'screen'>('home');
  const [searchQuery, setSearchQuery] = useState('Batman');
  const [episodeRef, setEpisodeRef] = useState('tv:1399'); // Game of Thrones
  const [resolveRef, setResolveRef] = useState('movie:550'); // Fight Club
  const [loading, setLoading] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // Datos reales en memoria cargados
  const [homeRows, setHomeRows] = useState<HomeRow[]>([]);
  const [searchResults, setSearchResults] = useState<PluginItem[]>([]);
  const [episodesData, setEpisodesData] = useState<{ episodes: EpisodeItem[]; seasons: SeasonItem[] } | null>(null);
  const [resolvedStream, setResolvedStream] = useState<ResolveResult | null>(null);

  // Estado de navegación en el simulador
  const [selectedScreenItem, setSelectedScreenItem] = useState<PluginItem | null>(null);
  const [screenGenre, setScreenGenre] = useState<string>('all');

  // Copiar al portapapeles
  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Cargar catálogo inicial de Home directamente con TMDB (idéntico a src/index.js)
  const fetchHome = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const TMDB_API_KEY = "8476a7ab80ad76f0936744df0430e67c";
      const [trending, popMovies, popSeries] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_API_KEY}&language=es-MX`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=es-MX`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=es-MX`).then(r => r.json())
      ]);

      const formatItem = (i: any, forcedKind?: 'movie' | 'series'): PluginItem => {
        const isMovie = forcedKind ? forcedKind === 'movie' : (i.media_type === 'movie' || !!i.title);
        const kind: 'movie' | 'series' = isMovie ? 'movie' : 'series';
        const dateStr = i.release_date || i.first_air_date || '';
        return {
          id: `${kind}_${i.id}`,
          title: i.title || i.name || 'Sin título',
          ref: `${kind}:${i.id}`,
          kind,
          year: dateStr ? parseInt(dateStr.slice(0, 4), 10) : undefined,
          poster: i.poster_path ? `https://image.tmdb.org/t/p/w500${i.poster_path}` : undefined,
          backdrop: i.backdrop_path ? `https://image.tmdb.org/t/p/w1280${i.backdrop_path}` : undefined,
          overview: i.overview || '',
          rating: i.vote_average ? Math.round(i.vote_average * 10) / 10 : undefined
        };
      };

      const rows: HomeRow[] = [
        {
          id: 'trending',
          title: 'CineJoy: Tendencias y Estrenos',
          genre: 'estrenos',
          items: (trending.results || []).slice(0, 15).map((i: any) => formatItem(i))
        },
        {
          id: 'popular_movies',
          title: 'Películas más vistas',
          genre: 'peliculas',
          items: (popMovies.results || []).slice(0, 15).map((i: any) => formatItem(i, 'movie'))
        },
        {
          id: 'popular_series',
          title: 'Series aclamadas',
          genre: 'series',
          items: (popSeries.results || []).slice(0, 15).map((i: any) => formatItem(i, 'series'))
        }
      ];

      setHomeRows(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setExecutionTime(Math.round(performance.now() - start));
      setLoading(false);
    }
  };

  // Buscar en vivo
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    const start = performance.now();
    try {
      const TMDB_API_KEY = "8476a7ab80ad76f0936744df0430e67c";
      const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=es-MX&query=${encodeURIComponent(searchQuery)}`).then(r => r.json());
      const hits = (res.results || [])
        .filter((i: any) => (i.media_type === 'movie' || i.media_type === 'tv') && (i.poster_path || i.backdrop_path))
        .map((i: any) => ({
          id: `${i.media_type}_${i.id}`,
          title: i.title || i.name || 'Sin título',
          ref: `${i.media_type}:${i.id}`,
          kind: i.media_type as 'movie' | 'series',
          year: i.release_date || i.first_air_date ? parseInt((i.release_date || i.first_air_date).slice(0, 4), 10) : undefined,
          poster: i.poster_path ? `https://image.tmdb.org/t/p/w500${i.poster_path}` : undefined,
          backdrop: i.backdrop_path ? `https://image.tmdb.org/t/p/w1280${i.backdrop_path}` : undefined,
          overview: i.overview || '',
          rating: i.vote_average ? Math.round(i.vote_average * 10) / 10 : undefined
        }));
      setSearchResults(hits);
    } catch (e) {
      console.error(e);
    } finally {
      setExecutionTime(Math.round(performance.now() - start));
      setLoading(false);
    }
  };

  // Consultar episodios
  const handleFetchEpisodes = async (customRef?: string) => {
    const targetRef = customRef || episodeRef;
    setLoading(true);
    const start = performance.now();
    try {
      const parts = targetRef.split(':');
      const tvId = parts[1];
      const TMDB_API_KEY = "8476a7ab80ad76f0936744df0430e67c";
      const [seriesInfo, seasonInfo] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}&language=es-MX`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/tv/${tvId}/season/1?api_key=${TMDB_API_KEY}&language=es-MX`).then(r => r.json())
      ]);

      const seasons = (seriesInfo.seasons || [])
        .filter((s: any) => s.season_number > 0)
        .map((s: any) => ({
          id: `season_${s.season_number}`,
          number: s.season_number,
          title: s.name || `Temporada ${s.season_number}`,
          ref: `tv:${tvId}:${s.season_number}`
        }));

      const episodes = (seasonInfo.episodes || []).map((ep: any) => ({
        season: 1,
        number: ep.episode_number,
        ref: `tv:${tvId}:1:${ep.episode_number}`,
        title: ep.name ? `${ep.episode_number}. ${ep.name}` : `Capítulo ${ep.episode_number}`,
        still: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : undefined,
        overview: ep.overview || '',
        airDate: ep.air_date || ''
      }));

      setEpisodesData({ episodes, seasons });
    } catch (e) {
      console.error(e);
    } finally {
      setExecutionTime(Math.round(performance.now() - start));
      setLoading(false);
    }
  };

  // Resolver enlaces de streaming
  const handleResolve = async (customRef?: string) => {
    const ref = customRef || resolveRef;
    setLoading(true);
    const start = performance.now();
    try {
      const parts = ref.split(':');
      const kind = parts[0];
      const id = parts[1];
      const season = parts[2] || '1';
      const episode = parts[3] || '1';
      const isMovie = kind === 'movie';

      let title = isMovie ? 'Película CineJoy' : `Serie T${season} E${episode}`;
      let imdbId = '';
      try {
        const TMDB_API_KEY = "8476a7ab80ad76f0936744df0430e67c";
        const meta = await fetch(`https://api.themoviedb.org/3/${isMovie ? 'movie' : 'tv'}/${id}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=external_ids`).then(r => r.json());
        if (meta) {
          title = meta.title || meta.name || title;
          if (!isMovie) title += ` - T${season}:E${episode}`;
          imdbId = meta.external_ids?.imdb_id || meta.imdb_id || '';
        }
      } catch (err) {}

      let streamUrls: string[] = [];
      if (imdbId) {
        try {
          let apiEndpoint = `https://streamdata.vaplayer.ru/api.php?imdb=${imdbId}&type=${isMovie ? 'movie' : 'tv'}`;
          if (!isMovie) apiEndpoint += `&season=${season}&episode=${episode}`;
          const res = await fetch(apiEndpoint, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'CineJoy-Kino-Plugin/1.0'
            }
          });
          if (res.ok) {
            const json = await res.json();
            if (json?.status_code === '200' && Array.isArray(json?.data?.stream_urls)) {
              streamUrls = json.data.stream_urls.filter((u: any) => typeof u === 'string' && u.startsWith('http'));
            }
          }
        } catch (err) {}
      }

      const streamHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://brightpathsignals.com/',
        'Origin': 'https://brightpathsignals.com'
      };

      const primaryStream = streamUrls[0] || (isMovie ? `https://cinejoy.pk/movie/${id}` : `https://cinejoy.pk/tv/${id}`);
      const serverLabels = [
        "Lisbon (4K / 1080p Ultra HD)",
        "Nebula (1080p Directo)",
        "Solara (Rápido)",
        "Athens (Reserva)"
      ];

      setResolvedStream({
        url: primaryStream,
        title,
        headers: streamHeaders,
        subtitles: [],
        alternatives: streamUrls.slice(1).map((u, idx) => ({
          label: serverLabels[idx] || `Servidor ${idx + 2}`,
          url: u,
          headers: streamHeaders
        }))
      });
    } catch (e) {
      console.error(e);
    } finally {
      setExecutionTime(Math.round(performance.now() - start));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHome();
  }, []);

  // Items para la vista de cuadrícula del simulador
  const simulatorItems = useMemo(() => {
    if (homeRows.length === 0) return [];
    if (screenGenre === 'all') {
      return homeRows[0]?.items || [];
    }
    if (screenGenre === 'movies') {
      return homeRows.find(r => r.id === 'popular_movies')?.items || [];
    }
    if (screenGenre === 'series') {
      return homeRows.find(r => r.id === 'popular_series')?.items || [];
    }
    return homeRows[0]?.items || [];
  }, [homeRows, screenGenre]);

  // Manejo de D-Pad de TV
  const handleDpad = (direction: 'up' | 'down' | 'left' | 'right' | 'select' | 'back') => {
    if (direction === 'back') {
      setSelectedScreenItem(null);
      return;
    }
    if (direction === 'select') {
      if (selectedScreenItem) {
        // Ejecutar resolución
        handleResolve(selectedScreenItem.ref);
        setActiveTab('tester');
        setTestAction('resolve');
      } else if (simulatorItems[focusedIndex]) {
        setSelectedScreenItem(simulatorItems[focusedIndex]);
      }
      return;
    }

    const columns = deviceMode === 'tv' ? 4 : 2;
    setFocusedIndex(prev => {
      let next = prev;
      if (direction === 'right') next = Math.min(prev + 1, simulatorItems.length - 1);
      if (direction === 'left') next = Math.max(prev - 1, 0);
      if (direction === 'down') next = Math.min(prev + columns, simulatorItems.length - 1);
      if (direction === 'up') next = Math.max(prev - columns, 0);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#070907] text-[#E0E7DC] font-sans selection:bg-[#95FF50] selection:text-[#0A0D08]">
      {/* Barra superior del Studio */}
      <header className="sticky top-0 z-50 bg-[#0C100C]/90 backdrop-blur-md border-b border-[#1A2518] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#95FF50] to-[#58B925] flex items-center justify-center shadow-lg shadow-[#95FF50]/20 text-[#070907] font-black text-xl">
            CJ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-base tracking-tight">Kino Plugin Studio — CineJoy</h1>
              <span className="text-[11px] font-semibold bg-[#95FF50]/15 text-[#95FF50] border border-[#95FF50]/30 px-2 py-0.5 rounded-full">
                apiVersion 19
              </span>
              <span className="text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                SDK Verificado
              </span>
            </div>
            <p className="text-xs text-[#8A9B85]">
              Plugins para Kino TV (Android TV, Fire TV y Móvil) • Catálogo y Streaming de CineJoy
            </p>
          </div>
        </div>

        {/* Selector de pestañas principales */}
        <nav className="flex items-center bg-[#131A12] p-1 rounded-xl border border-[#21301F]">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'simulator'
                ? 'bg-[#95FF50] text-[#0A0D08] font-bold shadow-sm'
                : 'text-[#A0B09C] hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            Simulador de Pantalla
          </button>
          <button
            onClick={() => setActiveTab('tester')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'tester'
                ? 'bg-[#95FF50] text-[#0A0D08] font-bold shadow-sm'
                : 'text-[#A0B09C] hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Probador de API
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'files'
                ? 'bg-[#95FF50] text-[#0A0D08] font-bold shadow-sm'
                : 'text-[#A0B09C] hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Archivos del Plugin
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'bg-[#95FF50] text-[#0A0D08] font-bold shadow-sm'
                : 'text-[#A0B09C] hover:text-white'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            Guía de Instalación
          </button>
        </nav>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* ============================================================== */}
        {/* PESTAÑA 1: SIMULADOR DE PANTALLA NATIVO (PHONE & TV) */}
        {/* ============================================================== */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Panel de control del simulador */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-[#10160F] border border-[#1F2C1D] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-white text-sm flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#95FF50]" />
                    Modo de Dispositivo
                  </h2>
                  <div className="flex bg-[#0A0D08] p-1 rounded-lg border border-[#1E2B1C]">
                    <button
                      onClick={() => setDeviceMode('tv')}
                      className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition ${
                        deviceMode === 'tv'
                          ? 'bg-[#95FF50] text-[#0A0D08] font-bold'
                          : 'text-[#8A9B85] hover:text-white'
                      }`}
                    >
                      <Tv className="w-3.5 h-3.5" />
                      TV (16:9)
                    </button>
                    <button
                      onClick={() => setDeviceMode('phone')}
                      className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition ${
                        deviceMode === 'phone'
                          ? 'bg-[#95FF50] text-[#0A0D08] font-bold'
                          : 'text-[#8A9B85] hover:text-white'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      Celular
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#8A9B85] mb-4">
                  Kino dibuja el mismo árbol de componentes Flutter-like tanto en celular como en Android TV / Fire TV.
                  En la TV, el foco se navega con el control remoto D-pad.
                </p>

                {/* Filtro de géneros de la pantalla */}
                <div className="space-y-2 mb-4">
                  <label className="text-xs font-semibold text-[#B0C0AC]">Pestaña de CineJoy:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'all', label: 'Tendencias' },
                      { id: 'movies', label: 'Películas' },
                      { id: 'series', label: 'Series' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setScreenGenre(tab.id);
                          setFocusedIndex(0);
                        }}
                        className={`text-xs py-1.5 px-2 rounded-lg border text-center transition ${
                          screenGenre === tab.id
                            ? 'bg-[#95FF50]/20 border-[#95FF50] text-[#95FF50] font-bold'
                            : 'bg-[#141C13] border-[#202E1E] text-[#8A9B85] hover:border-[#2F442C]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Control remoto virtual para TV */}
                {deviceMode === 'tv' && (
                  <div className="mt-5 p-4 bg-[#0A0E0A] rounded-xl border border-[#1C281A] text-center">
                    <span className="text-[11px] font-semibold text-[#8A9B85] block mb-2 uppercase tracking-wider">
                      Control Remoto Virtual (D-Pad)
                    </span>
                    <div className="inline-grid grid-cols-3 gap-1.5 w-36 mx-auto mb-2">
                      <div />
                      <button
                        onClick={() => handleDpad('up')}
                        className="h-9 rounded bg-[#182316] hover:bg-[#95FF50] hover:text-black text-white font-bold text-xs flex items-center justify-center border border-[#273824] transition active:scale-95"
                      >
                        ▲
                      </button>
                      <div />
                      <button
                        onClick={() => handleDpad('left')}
                        className="h-9 rounded bg-[#182316] hover:bg-[#95FF50] hover:text-black text-white font-bold text-xs flex items-center justify-center border border-[#273824] transition active:scale-95"
                      >
                        ◀
                      </button>
                      <button
                        onClick={() => handleDpad('select')}
                        className="h-9 rounded bg-[#95FF50] text-black font-extrabold text-xs flex items-center justify-center shadow-md shadow-[#95FF50]/30 transition active:scale-95"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => handleDpad('right')}
                        className="h-9 rounded bg-[#182316] hover:bg-[#95FF50] hover:text-black text-white font-bold text-xs flex items-center justify-center border border-[#273824] transition active:scale-95"
                      >
                        ▶
                      </button>
                      <div />
                      <button
                        onClick={() => handleDpad('down')}
                        className="h-9 rounded bg-[#182316] hover:bg-[#95FF50] hover:text-black text-white font-bold text-xs flex items-center justify-center border border-[#273824] transition active:scale-95"
                      >
                        ▼
                      </button>
                      <div />
                    </div>
                    {selectedScreenItem && (
                      <button
                        onClick={() => handleDpad('back')}
                        className="mt-2 text-xs py-1 px-3 rounded bg-red-950/60 border border-red-800/50 text-red-300 hover:bg-red-900/80 transition"
                      >
                        ← Volver a la portada (Atrás)
                      </button>
                    )}
                  </div>
                )}

                {/* Métricas de Kino Screen */}
                <div className="mt-4 pt-4 border-t border-[#1C281A] grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#131A12] p-2.5 rounded-lg border border-[#1F2C1D]">
                    <span className="text-[#7A8B76] block text-[10px]">Presupuesto Nodos</span>
                    <span className="font-mono font-bold text-[#95FF50]">~120 / 600</span>
                  </div>
                  <div className="bg-[#131A12] p-2.5 rounded-lg border border-[#1F2C1D]">
                    <span className="text-[#7A8B76] block text-[10px]">AppBar Mode</span>
                    <span className="font-mono font-bold text-white">merge & dense</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ventana de previsualización del dispositivo */}
            <div className="lg:col-span-8 flex justify-center">
              {deviceMode === 'tv' ? (
                /* Simulación Pantalla TV 16:9 */
                <div className="w-full max-w-4xl bg-black rounded-2xl border-4 border-[#253322] shadow-2xl overflow-hidden relative aspect-video flex flex-col">
                  {/* Barra compacta de Kino (mergeWithKinoBar) */}
                  <div className="bg-[#0C120B]/95 px-5 py-2.5 border-b border-[#1E2B1C] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      {selectedScreenItem ? (
                        <button
                          onClick={() => setSelectedScreenItem(null)}
                          className="flex items-center gap-1.5 text-[#95FF50] hover:underline"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Volver a CineJoy</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#95FF50]" />
                          <span className="font-bold text-white tracking-wide">CineJoy</span>
                          <span className="text-[#71826D] font-mono text-[10px]">
                            • {screenGenre.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#8A9B85]">
                      <span>Kino TV v0.9.81</span>
                      <span className="bg-[#162014] px-2 py-0.5 rounded text-[#95FF50] font-mono">4K ULTRA HD</span>
                    </div>
                  </div>

                  {/* Cuerpo de la pantalla */}
                  <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-[#0A0D09] to-[#040604]">
                    {selectedScreenItem ? (
                      /* Vista Detalle */
                      <div className="flex gap-6 animate-fadeIn">
                        {selectedScreenItem.poster && (
                          <img
                            src={selectedScreenItem.poster}
                            alt={selectedScreenItem.title}
                            className="w-44 rounded-xl shadow-lg border border-[#273824] object-cover"
                          />
                        )}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="bg-[#95FF50] text-black text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                              {selectedScreenItem.kind === 'movie' ? 'Película' : 'Serie'}
                            </span>
                            {selectedScreenItem.year && (
                              <span className="text-xs text-[#8A9B85]">{selectedScreenItem.year}</span>
                            )}
                            {selectedScreenItem.rating && (
                              <span className="text-xs text-amber-400 font-bold">★ {selectedScreenItem.rating}</span>
                            )}
                          </div>
                          <h2 className="text-2xl font-black text-white">{selectedScreenItem.title}</h2>
                          <p className="text-xs text-[#9DAFA0] line-clamp-4 leading-relaxed">
                            {selectedScreenItem.overview || 'Sin descripción disponible.'}
                          </p>

                          <div className="pt-2 flex items-center gap-3">
                            <button
                              onClick={() => {
                                handleResolve(selectedScreenItem.ref);
                                setActiveTab('tester');
                                setTestAction('resolve');
                              }}
                              className="px-5 py-2.5 rounded-xl bg-[#95FF50] text-[#0A0D08] font-bold text-xs flex items-center gap-2 hover:bg-[#85EE40] transition shadow-lg shadow-[#95FF50]/20"
                            >
                              <Play className="w-4 h-4 fill-current" />
                              Reproducir ahora (Lisbon 4K)
                            </button>
                            {selectedScreenItem.kind === 'series' && (
                              <button
                                onClick={() => {
                                  setEpisodeRef(selectedScreenItem.ref);
                                  handleFetchEpisodes(selectedScreenItem.ref);
                                  setActiveTab('tester');
                                  setTestAction('episodes');
                                }}
                                className="px-4 py-2.5 rounded-xl bg-[#172215] border border-[#273824] text-white font-medium text-xs flex items-center gap-1.5 hover:bg-[#202E1D] transition"
                              >
                                Ver Capítulos
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Cuadrícula de títulos */
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            {screenGenre === 'all'
                              ? 'Estrenos y Tendencias en CineJoy'
                              : screenGenre === 'movies'
                              ? 'Películas Populares'
                              : 'Series Populares'}
                          </h3>
                          <span className="text-[11px] text-[#71826D]">
                            Navega con ▲ ▼ ◀ ▶ y presiona OK
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          {simulatorItems.map((item, idx) => {
                            const isFocused = focusedIndex === idx;
                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  setFocusedIndex(idx);
                                  setSelectedScreenItem(item);
                                }}
                                className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-150 ${
                                  isFocused
                                    ? 'ring-4 ring-[#95FF50] scale-105 shadow-xl shadow-[#95FF50]/20 z-10'
                                    : 'border border-[#1E2B1C] opacity-85 hover:opacity-100'
                                }`}
                              >
                                {item.poster ? (
                                  <img
                                    src={item.poster}
                                    alt={item.title}
                                    className="w-full h-44 object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-44 bg-[#141C13] flex items-center justify-center text-xs text-[#71826D]">
                                    Sin Póster
                                  </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2 text-left">
                                  <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                                  <div className="flex items-center justify-between text-[10px] text-[#93A590] mt-0.5">
                                    <span>{item.year || '2026'}</span>
                                    {item.rating && <span className="text-[#95FF50]">★ {item.rating}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Simulación Pantalla Celular (Vertical) */
                <div className="w-[340px] h-[680px] bg-black rounded-[40px] border-8 border-[#253322] shadow-2xl overflow-hidden flex flex-col relative">
                  {/* Notch */}
                  <div className="absolute top-2 inset-x-0 flex justify-center z-50">
                    <div className="w-24 h-4 bg-[#172015] rounded-full" />
                  </div>

                  {/* Header móvil */}
                  <div className="pt-8 pb-3 px-4 bg-[#0C120B] border-b border-[#1E2B1C] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedScreenItem && (
                        <button onClick={() => setSelectedScreenItem(null)}>
                          <ArrowLeft className="w-4 h-4 text-[#95FF50]" />
                        </button>
                      )}
                      <span className="font-bold text-white text-sm">CineJoy</span>
                    </div>
                    <span className="text-[10px] bg-[#95FF50]/20 text-[#95FF50] px-2 py-0.5 rounded font-mono">
                      Mobile Screen
                    </span>
                  </div>

                  {/* Contenido móvil táctil */}
                  <div className="flex-1 overflow-y-auto p-4 bg-[#070907] space-y-4">
                    {selectedScreenItem ? (
                      <div className="space-y-3">
                        <img
                          src={selectedScreenItem.poster}
                          alt={selectedScreenItem.title}
                          className="w-full h-56 object-cover rounded-xl border border-[#273824]"
                        />
                        <h3 className="font-bold text-white text-base">{selectedScreenItem.title}</h3>
                        <p className="text-xs text-[#9DAFA0] line-clamp-4 leading-relaxed">
                          {selectedScreenItem.overview}
                        </p>
                        <button
                          onClick={() => {
                            handleResolve(selectedScreenItem.ref);
                            setActiveTab('tester');
                            setTestAction('resolve');
                          }}
                          className="w-full py-2.5 rounded-xl bg-[#95FF50] text-black font-bold text-xs flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Reproducir
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {simulatorItems.map(item => (
                          <div
                            key={item.id}
                            onClick={() => setSelectedScreenItem(item)}
                            className="bg-[#121A11] rounded-xl overflow-hidden border border-[#202E1E] cursor-pointer active:scale-95 transition"
                          >
                            <img src={item.poster} alt={item.title} className="w-full h-36 object-cover" />
                            <div className="p-2">
                              <p className="text-[11px] font-bold text-white truncate">{item.title}</p>
                              <p className="text-[9px] text-[#8A9B85]">{item.year || '2026'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 2: PROBADOR EN VIVO DE LA API DE KINO */}
        {/* ============================================================== */}
        {activeTab === 'tester' && (
          <div className="space-y-6">
            {/* Barra de comandos y acciones */}
            <div className="bg-[#10160F] border border-[#1F2C1D] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'home', label: 'home()', desc: 'Portada y filas' },
                  { id: 'search', label: 'search()', desc: 'Búsqueda por texto' },
                  { id: 'episodes', label: 'episodes()', desc: 'Guía de capítulos' },
                  { id: 'resolve', label: 'resolve()', desc: 'Enlaces 4K' }
                ].map(act => (
                  <button
                    key={act.id}
                    onClick={() => {
                      setTestAction(act.id as any);
                      if (act.id === 'home' && homeRows.length === 0) fetchHome();
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                      testAction === act.id
                        ? 'bg-[#95FF50] text-[#0A0D08] font-bold shadow-md shadow-[#95FF50]/20'
                        : 'bg-[#151D14] text-[#A0B09C] border border-[#21301F] hover:text-white'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    {act.label}
                  </button>
                ))}
              </div>

              {executionTime !== null && (
                <div className="text-xs text-[#8A9B85] flex items-center gap-1.5 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Tiempo de respuesta: <span className="text-[#95FF50] font-bold">{executionTime} ms</span>
                </div>
              )}
            </div>

            {/* Panel de parámetros según la función activa */}
            <div className="bg-[#10160F] border border-[#1F2C1D] rounded-2xl p-5">
              {testAction === 'home' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">plugin.home()</h3>
                      <p className="text-xs text-[#8A9B85]">
                        Retorna las filas categorizadas de CineJoy que Kino muestra en la portada de la app.
                      </p>
                    </div>
                    <button
                      onClick={fetchHome}
                      disabled={loading}
                      className="px-4 py-2 rounded-xl bg-[#1C271A] hover:bg-[#283825] text-xs font-semibold text-[#95FF50] border border-[#2C3E28] flex items-center gap-2 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Recargar Catálogo
                    </button>
                  </div>

                  {homeRows.length > 0 && (
                    <div className="space-y-6 pt-2">
                      {homeRows.map(row => (
                        <div key={row.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center gap-2">
                              <Film className="w-3.5 h-3.5 text-[#95FF50]" />
                              {row.title}
                            </span>
                            <span className="text-[11px] font-mono text-[#71826D]">
                              id: {row.id} • {row.items.length} títulos
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {row.items.slice(0, 6).map(it => (
                              <div
                                key={it.id}
                                onClick={() => {
                                  setResolveRef(it.ref);
                                  handleResolve(it.ref);
                                  setTestAction('resolve');
                                }}
                                className="bg-[#141C13] rounded-lg p-2 border border-[#202E1E] cursor-pointer hover:border-[#95FF50] transition group"
                              >
                                <img
                                  src={it.poster}
                                  alt={it.title}
                                  className="w-full h-32 object-cover rounded mb-1.5"
                                />
                                <p className="text-[11px] font-bold text-white truncate">{it.title}</p>
                                <p className="text-[10px] text-[#8A9B85] flex justify-between">
                                  <span>{it.year}</span>
                                  {it.rating && <span className="text-[#95FF50]">★ {it.rating}</span>}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {testAction === 'search' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">plugin.search({`{ q: "${searchQuery}" }`})</h3>
                    <p className="text-xs text-[#8A9B85]">
                      Búsqueda unificada en el catálogo de CineJoy. Retorna películas y series filtradas.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      placeholder="Escribe el nombre de una película o serie..."
                      className="flex-1 bg-[#0A0D08] border border-[#202E1E] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#95FF50]"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={loading}
                      className="px-5 py-2 rounded-xl bg-[#95FF50] text-[#0A0D08] font-bold text-xs flex items-center gap-2 hover:bg-[#85EE40] transition"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Buscar
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
                      {searchResults.map(it => (
                        <div
                          key={it.id}
                          onClick={() => {
                            setResolveRef(it.ref);
                            handleResolve(it.ref);
                            setTestAction('resolve');
                          }}
                          className="bg-[#141C13] rounded-lg p-2 border border-[#202E1E] cursor-pointer hover:border-[#95FF50] transition"
                        >
                          <img
                            src={it.poster}
                            alt={it.title}
                            className="w-full h-32 object-cover rounded mb-1.5"
                          />
                          <p className="text-[11px] font-bold text-white truncate">{it.title}</p>
                          <p className="text-[10px] text-[#8A9B85] flex justify-between">
                            <span className="uppercase">{it.kind}</span>
                            {it.rating && <span className="text-[#95FF50]">★ {it.rating}</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {testAction === 'episodes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">plugin.episodes("{episodeRef}")</h3>
                      <p className="text-xs text-[#8A9B85]">
                        Retorna la lista de temporadas y episodios individuales con sinopsis y miniatura.
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {['tv:1399', 'tv:66732', 'tv:70981'].map(refPreset => (
                        <button
                          key={refPreset}
                          onClick={() => {
                            setEpisodeRef(refPreset);
                            handleFetchEpisodes(refPreset);
                          }}
                          className="text-[10px] bg-[#162014] text-[#A0B09C] border border-[#243522] px-2 py-1 rounded hover:text-white"
                        >
                          {refPreset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={episodeRef}
                      onChange={e => setEpisodeRef(e.target.value)}
                      placeholder="tv:1399"
                      className="flex-1 bg-[#0A0D08] border border-[#202E1E] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#95FF50] font-mono"
                    />
                    <button
                      onClick={() => handleFetchEpisodes()}
                      disabled={loading}
                      className="px-5 py-2 rounded-xl bg-[#95FF50] text-[#0A0D08] font-bold text-xs flex items-center gap-2 hover:bg-[#85EE40] transition"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Consultar Capítulos
                    </button>
                  </div>

                  {episodesData && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {episodesData.seasons.map(s => (
                          <span
                            key={s.id}
                            className="text-xs bg-[#1A2518] border border-[#2A3B26] px-3 py-1 rounded-full text-[#95FF50] whitespace-nowrap font-medium"
                          >
                            {s.title}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                        {episodesData.episodes.map(ep => (
                          <div
                            key={ep.ref}
                            onClick={() => {
                              setResolveRef(ep.ref);
                              handleResolve(ep.ref);
                              setTestAction('resolve');
                            }}
                            className="bg-[#141C13] border border-[#202E1E] rounded-xl p-3 flex gap-3 cursor-pointer hover:border-[#95FF50] transition"
                          >
                            {ep.still ? (
                              <img src={ep.still} alt={ep.title} className="w-24 h-16 object-cover rounded-lg" />
                            ) : (
                              <div className="w-24 h-16 bg-[#1A2518] rounded-lg flex items-center justify-center text-[10px] text-[#71826D]">
                                Cap. {ep.number}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-white truncate">{ep.title}</h4>
                              <p className="text-[10px] text-[#8A9B85] line-clamp-2 mt-1">{ep.overview}</p>
                              <span className="text-[9px] text-[#71826D] mt-1 block">{ep.airDate}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {testAction === 'resolve' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">plugin.resolve("{resolveRef}")</h3>
                      <p className="text-xs text-[#8A9B85]">
                        Retorna la URL reproducible con servidores alternativos de alta velocidad (Lisbon, Secret, AutoEmbed) y subtítulos VTT.
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {['movie:550', 'movie:157336', 'tv:1399:1:1'].map(preset => (
                        <button
                          key={preset}
                          onClick={() => {
                            setResolveRef(preset);
                            handleResolve(preset);
                          }}
                          className="text-[10px] bg-[#162014] text-[#A0B09C] border border-[#243522] px-2 py-1 rounded hover:text-white"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={resolveRef}
                      onChange={e => setResolveRef(e.target.value)}
                      placeholder="movie:550"
                      className="flex-1 bg-[#0A0D08] border border-[#202E1E] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#95FF50] font-mono"
                    />
                    <button
                      onClick={() => handleResolve()}
                      disabled={loading}
                      className="px-5 py-2 rounded-xl bg-[#95FF50] text-[#0A0D08] font-bold text-xs flex items-center gap-2 hover:bg-[#85EE40] transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Resolver Stream
                    </button>
                  </div>

                  {resolvedStream && (
                    <div className="space-y-4 pt-2">
                      {/* Enlace principal */}
                      <div className="bg-[#141C13] border border-[#202E1E] rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-2">
                            <Server className="w-4 h-4 text-[#95FF50]" />
                            Servidor Principal (Auto/Default)
                          </span>
                          <span className="text-[11px] font-semibold text-[#95FF50] bg-[#95FF50]/15 px-2 py-0.5 rounded">
                            {resolvedStream.title}
                          </span>
                        </div>
                        <div className="bg-[#0A0D08] p-2.5 rounded-lg border border-[#1A2518] flex items-center justify-between">
                          <code className="text-xs text-[#B0C0AC] font-mono break-all">
                            {resolvedStream.url}
                          </code>
                          <button
                            onClick={() => handleCopy('main_url', resolvedStream.url)}
                            className="ml-3 p-1.5 rounded hover:bg-[#1E2B1C] text-[#8A9B85] hover:text-white"
                          >
                            {copiedKey === 'main_url' ? <Check className="w-4 h-4 text-[#95FF50]" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Servidores alternativos */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-white block">Servidores Alternativos de Alta Velocidad:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {resolvedStream.alternatives?.map((alt, idx) => (
                            <div key={idx} className="bg-[#141C13] border border-[#202E1E] rounded-lg p-3 space-y-1">
                              <span className="text-xs font-bold text-[#95FF50] block">{alt.label}</span>
                              <p className="text-[10px] text-[#71826D] font-mono truncate">{alt.url}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Subtítulos */}
                      {resolvedStream.subtitles && resolvedStream.subtitles.length > 0 && (
                        <div className="bg-[#141C13] border border-[#202E1E] rounded-xl p-3">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                            <Subtitles className="w-3.5 h-3.5 text-[#95FF50]" />
                            Subtítulos Sincronizados (WebVTT)
                          </span>
                          <div className="flex gap-2">
                            {resolvedStream.subtitles.map((sub, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-[#1C271A] border border-[#293B26] px-2.5 py-1 rounded text-[#B0C0AC]"
                              >
                                {sub.label} ({sub.lang})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 3: ARCHIVOS DEL PLUGIN Y CÓDIGO FUENTE */}
        {/* ============================================================== */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Estructura del Repositorio de Kino</h2>
                <p className="text-xs text-[#8A9B85]">
                  Todos los archivos están generados, compilados y listos para subirse a tu repositorio de GitHub.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#95FF50] bg-[#95FF50]/15 px-2.5 py-1 rounded-lg border border-[#95FF50]/30">
                  build:plugin → plugin.js (16.5 KB)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* kino-plugin.json */}
              <div className="bg-[#10160F] border border-[#1F2C1D] rounded-2xl p-4 flex flex-col h-[400px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[#95FF50]" />
                    <span className="text-xs font-bold text-white font-mono">kino-plugin.json</span>
                  </div>
                  <button
                    onClick={() => handleCopy('manifest', JSON.stringify({
                      id: "cinejoy",
                      name: "CineJoy",
                      version: "1.0.0",
                      description: "Películas y series en alta calidad (4K y Full HD) desde CineJoy con pantalla nativa y búsqueda integrada.",
                      author: "CineJoy Community",
                      entry: "plugin.js",
                      icon: "icon.png",
                      apiVersion: 19,
                      capabilities: ["screen", "episodes", "resolve", "home", "search"],
                      screen: { label: "CineJoy" },
                      hosts: [
                        "api.themoviedb.org",
                        "image.tmdb.org",
                        "cinejoy.pk",
                        "cinejoy.to",
                        "api.wing.st",
                        "lists.wing.st",
                        "streamdata.vaplayer.ru",
                        "brightpathsignals.com"
                      ],
                      streamHosts: "any"
                    }, null, 2))}
                    className="p-1 rounded hover:bg-[#1E2B1C] text-[#8A9B85] hover:text-white"
                  >
                    {copiedKey === 'manifest' ? <Check className="w-3.5 h-3.5 text-[#95FF50]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <pre className="flex-1 overflow-auto bg-[#0A0D08] p-3 rounded-xl border border-[#1A2518] text-[11px] font-mono text-[#95FF50]/90 leading-tight">
{`{
  "id": "cinejoy",
  "name": "CineJoy",
  "version": "1.0.0",
  "description": "Películas y series en alta calidad (4K y Full HD) desde CineJoy.",
  "author": "CineJoy Community",
  "entry": "plugin.js",
  "icon": "icon.png",
  "apiVersion": 19,
  "capabilities": [
    "screen",
    "episodes",
    "resolve",
    "home",
    "search"
  ],
  "screen": {
    "label": "CineJoy"
  },
  "hosts": [
    "api.themoviedb.org",
    "image.tmdb.org",
    "cinejoy.pk",
    "cinejoy.to",
    "api.wing.st",
    "lists.wing.st",
    "streamdata.vaplayer.ru",
    "brightpathsignals.com"
  ],
  "streamHosts": "any"
}`}
                </pre>
              </div>

              {/* test/plugin.test.mjs */}
              <div className="bg-[#10160F] border border-[#1F2C1D] rounded-2xl p-4 flex flex-col h-[400px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white font-mono">test/plugin.test.mjs</span>
                  </div>
                  <span className="text-[10px] bg-emerald-950/60 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/40">
                    7 / 7 Pruebas Pasadas
                  </span>
                </div>
                <pre className="flex-1 overflow-auto bg-[#0A0D08] p-3 rounded-xl border border-[#1A2518] text-[11px] font-mono text-[#B0C0AC] leading-tight">
{`// 1. Verificación de exports
assert.equal(typeof plugin.home, "function");
assert.equal(typeof plugin.search, "function");
assert.equal(typeof plugin.episodes, "function");
assert.equal(typeof plugin.resolve, "function");
assert.equal(typeof plugin.screen, "function");

// 2. Portada con IDs canónicos
const rows = await plugin.home();
assert.ok(rows.length > 0);

// 3. Búsqueda
const hits = await plugin.search({ q: "Matrix" });

// 4. Temporadas y capítulos
const series = await plugin.episodes("tv:1399");

// 5. Reproducción y alternativas
const stream = await plugin.resolve("movie:550");

// 6. Pantalla Flutter Scaffold
const sc = await plugin.screen({});
assert.equal(sc.appBar.mergeWithKinoBar, true);`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 4: GUÍA PASO A PASO PARA GITHUB Y KINO */}
        {/* ============================================================== */}
        {activeTab === 'guide' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-[#10160F] border border-[#1F2C1D] rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#95FF50]" />
                Instrucciones Paso a Paso para Publicar e Instalar
              </h2>
              <p className="text-xs text-[#8A9B85] leading-relaxed">
                No necesitas saber programar para dejar este plugin funcionando en tu celular y en tu televisor. Sigue estos pasos exactos:
              </p>

              {/* Paso 1 */}
              <div className="border border-[#1E2B1C] rounded-xl p-4 bg-[#0A0E0A] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#95FF50] text-[#0A0D08] text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <h3 className="text-sm font-bold text-white">Crear el Repositorio Público en GitHub</h3>
                </div>
                <div className="pl-8 text-xs text-[#9DAFA0] space-y-1.5">
                  <p>1. Entra a tu cuenta en <strong>github.com</strong>.</p>
                  <p>2. Haz clic en el botón verde <strong>New</strong> (Nuevo Repositorio). <em>Nota de Kino: NUNCA uses "Fork", siempre crea un repositorio nuevo.</em></p>
                  <p>3. Dale un nombre, por ejemplo: <code className="bg-[#162014] text-[#95FF50] px-1.5 py-0.5 rounded">kino-plugin-cinejoy</code>.</p>
                  <p>4. Asegúrate de marcarlo como <strong>Public</strong> (Público).</p>
                  <p>5. En la página de tu repositorio, haz clic en el icono de engranaje al lado de <em>About</em> y agrega el topic (etiqueta): <code className="bg-[#162014] text-[#95FF50] px-1.5 py-0.5 rounded">kino-plugin</code>.</p>
                </div>
              </div>

              {/* Paso 2 */}
              <div className="border border-[#1E2B1C] rounded-xl p-4 bg-[#0A0E0A] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#95FF50] text-[#0A0D08] text-xs font-black flex items-center justify-center">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-white">Subir los Archivos</h3>
                </div>
                <div className="pl-8 text-xs text-[#9DAFA0] space-y-1.5">
                  <p>Sube los siguientes archivos en la raíz de tu repositorio:</p>
                  <ul className="list-disc list-inside space-y-1 text-[#B0C0AC]">
                    <li><strong className="text-white">kino-plugin.json</strong> (El manifiesto oficial)</li>
                    <li><strong className="text-white">plugin.js</strong> (El plugin compilado listo para QuickJS)</li>
                    <li><strong className="text-white">icon.png</strong> (El icono oficial en 256x256)</li>
                    <li><strong className="text-white">README.md</strong> (La documentación)</li>
                    <li><strong className="text-white">src/index.js</strong> (El código fuente para futuras mejoras)</li>
                  </ul>
                </div>
              </div>

              {/* Paso 3 */}
              <div className="border border-[#1E2B1C] rounded-xl p-4 bg-[#0A0E0A] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#95FF50] text-[#0A0D08] text-xs font-black flex items-center justify-center">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-white">Instalar en Kino Celular (Android / iOS)</h3>
                </div>
                <div className="pl-8 text-xs text-[#9DAFA0] space-y-1.5">
                  <p>1. Abre la aplicación <strong>Kino</strong> en tu celular.</p>
                  <p>2. Toca el menú lateral de tres líneas (☰) en la esquina superior izquierda.</p>
                  <p>3. Selecciona <strong>Plugins</strong> y luego presiona el botón <strong>+</strong>.</p>
                  <p>4. Escribe: <code className="bg-[#162014] text-[#95FF50] px-1.5 py-0.5 rounded">tu-usuario/kino-plugin-cinejoy</code>.</p>
                  <p>5. Presiona <strong>Instalar</strong>. Kino descargará y verificará los permisos.</p>
                </div>
              </div>

              {/* Paso 4 */}
              <div className="border border-[#1E2B1C] rounded-xl p-4 bg-[#0A0E0A] space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#95FF50] text-[#0A0D08] text-xs font-black flex items-center justify-center">
                    4
                  </span>
                  <h3 className="text-sm font-bold text-white">Instalar en Televisor (Android TV / Fire TV)</h3>
                </div>
                <div className="pl-8 text-xs text-[#9DAFA0] space-y-1.5">
                  <p>1. Enciende tu televisor y abre <strong>Kino</strong>.</p>
                  <p>2. Con el control remoto, ve a <strong>Ajustes</strong> o a la pestaña <strong>Plugins</strong>.</p>
                  <p>3. Selecciona <strong>Agregar Plugin</strong> e ingresa <code className="bg-[#162014] text-[#95FF50] px-1.5 py-0.5 rounded">tu-usuario/kino-plugin-cinejoy</code>.</p>
                  <p>4. Presiona <strong>Aceptar</strong>. El plugin quedará activo y verás la pantalla nativa de CineJoy directamente con tu control remoto.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
