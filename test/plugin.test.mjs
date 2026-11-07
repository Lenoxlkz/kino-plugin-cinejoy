import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as plugin from "../plugin.js";

const requestedUrls = [];
const pluginLogs = [];
let resolverHeadersFixture = null;
let resolverRepliesFixture = [];
const imdbByPath = {
  "/3/movie/550": "tt0137523",
  "/3/tv/1399": "tt0944947"
};

// Keep the suite deterministic and offline: these tests verify the plugin's contract and
// URL handling, not the uptime or availability of TMDB/CineJoy's production servers.
globalThis.kino = {
  sleep: async () => {},
  log: (...args) => pluginLogs.push(args.join(" ")),
  error: (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra }),
  fetch: async (input) => {
    const url = new URL(input);
    requestedUrls.push(url);

    if (url.hostname === "api.themoviedb.org") {
      const results = [{
        id: 550,
        media_type: "movie",
        title: "Fight Club",
        name: "Fight Club",
        release_date: "1999-10-15",
        first_air_date: "1999-10-15",
        poster_path: "/poster.jpg",
        backdrop_path: "/backdrop.jpg",
        overview: "A Matrix-like test fixture.",
        vote_average: 8.4,
        genre_ids: [28]
      }];

      if (url.pathname.endsWith("/season/1")) {
        return jsonResponse({ episodes: [{
          name: "Winter Is Coming", episode_number: 1, season_number: 1,
          overview: "Pilot", air_date: "2011-04-17", still_path: "/still.jpg"
        }] });
      }
      if (url.pathname === "/3/tv/1399") {
        return jsonResponse({
          name: "Game of Thrones",
          external_ids: { imdb_id: imdbByPath[url.pathname] },
          seasons: [{ season_number: 1, name: "Season 1" }]
        });
      }
      if (url.pathname === "/3/movie/550") {
        return jsonResponse({ title: "Fight Club", external_ids: { imdb_id: imdbByPath[url.pathname] } });
      }
      if (url.pathname.startsWith("/3/tv/1399/season/")) {
        return jsonResponse({ episodes: [{
          name: "Winter Is Coming", episode_number: 1, season_number: 1,
          overview: "Pilot", air_date: "2011-04-17", still_path: "/still.jpg"
        }] });
      }
      if (url.pathname.startsWith("/3/search/")) {
        return jsonResponse({ results });
      }
      if (url.pathname.startsWith("/3/")) {
        return jsonResponse({ results, seasons: [{ season_number: 1, name: "Season 1" }] });
      }
    }

    if (url.hostname === "streamdata.vaplayer.ru") {
      if (resolverRepliesFixture.length) return resolverRepliesFixture.shift();
      return jsonResponse({
        status_code: 200,
        data: {
          ...(resolverHeadersFixture ? { headers: resolverHeadersFixture } : {}),
          stream_urls: [
            "https://cdn.example.test/movie/master.m3u8?token=abc",
            { url: "https://cdn.example.test/nebula/master.m3u8?token=def", server: "Nebula", headers: { "X-Playback-Key": "fixture-key" } },
            { url: "https://cdn.example.test/movie/backup.mp4", server: "Backup node" },
            "https://cdn.example.test/embed", // Must never reach ExoPlayer (HTML page, not media).
            "javascript:alert(1)"
          ]
        }
      });
    }
    throw new Error(`Unexpected test URL: ${url.href}`);
  }
};

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("CineJoy Kino Plugin Tests", () => {
  test("Exported API functions exist", () => {
    assert.equal(typeof plugin.home, "function");
    assert.equal(typeof plugin.search, "function");
    assert.equal(typeof plugin.episodes, "function");
    assert.equal(typeof plugin.resolve, "function");
    assert.equal(typeof plugin.screen, "function");
    assert.equal(typeof plugin.screenEvent, "function");
  });

  test("home() returns valid categorized rows", async () => {
    const rows = await plugin.home();
    assert.ok(Array.isArray(rows), "home() must return an array");
    assert.ok(rows.length > 0, "home() should return at least 1 row");
    for (const row of rows) {
      assert.ok(typeof row.id === "string" && row.id.length > 0, "Row must have a non-empty id");
      assert.ok(typeof row.title === "string" && row.title.length > 0, "Row must have a title");
      assert.ok(Array.isArray(row.items), "Row items must be an array");
      if (row.items.length > 0) {
        const item = row.items[0];
        assert.ok(item.id, "Item must have an id");
        assert.ok(item.title, "Item must have a title");
        assert.ok(item.ref, "Item must have a ref");
        assert.ok(["movie", "series"].includes(item.kind), "Item kind must be movie or series");
      }
    }
  });

  test("search() returns query results", async () => {
    const results = await plugin.search({ q: "Matrix" });
    assert.ok(Array.isArray(results), "search() must return an array");
    assert.ok(results.length > 0, "search('Matrix') should return hits");
    assert.ok(results[0].title.toLowerCase().includes("fight") || results[0].id);
  });

  test("episodes() returns seasons and episodes list for a series", async () => {
    const res = await plugin.episodes("tv:1399");
    assert.ok(typeof res === "object" && res !== null, "episodes() must return an object");
    assert.ok(Array.isArray(res.episodes), "episodes property must be an array");
    assert.ok(res.episodes.length > 0, "Should have episodes");
    assert.equal(res.episodes[0].season, 1);
    assert.equal(res.episodes[0].number, 1);
    assert.equal(typeof res.episodes[0].ref, "string");
    assert.ok(Array.isArray(res.seasons), "seasons list must be an array");
  });

  test("resolve() returns direct media URLs with required headers and alternatives", async () => {
    const stream = await plugin.resolve("movie:550");
    assert.equal(stream.url, "https://cdn.example.test/movie/master.m3u8?token=abc");
    assert.equal(stream.mime, undefined, "HLS must omit mime; Kino detects it from the playlist URL/content");
    assert.equal(Object.hasOwn(stream, "mime"), false);
    assert.ok(stream.headers["User-Agent"]);
    assert.equal("Referer" in stream.headers, false, "the working default must omit Referer");
    assert.equal("Origin" in stream.headers, false, "the working default must omit Origin");
    assert.equal(stream.alternatives.length, 2);
    assert.equal(stream.alternatives[0].url, "https://cdn.example.test/nebula/master.m3u8?token=def");
    assert.equal(stream.alternatives[0].mime, undefined, "HLS alternatives must also omit mime");
    assert.equal(Object.hasOwn(stream.alternatives[0], "mime"), false);
    assert.equal(stream.alternatives[0].label, "Nebula");
    assert.equal(stream.alternatives[0].headers["X-Playback-Key"], "fixture-key");
    assert.equal(stream.alternatives[0].headers["User-Agent"], stream.headers["User-Agent"]);
    assert.equal("Referer" in stream.alternatives[0].headers, false);
    assert.equal("Origin" in stream.alternatives[0].headers, false);
    assert.equal(stream.alternatives[1].url, "https://cdn.example.test/movie/backup.mp4");
    assert.equal(stream.alternatives[1].mime, "video/mp4");
    assert.equal(stream.alternatives[1].label, "Backup node");
    assert.equal(stream.alternatives[1].headers["User-Agent"], stream.headers["User-Agent"]);
    assert.equal("Origin" in stream.alternatives[1].headers, false);
    assert.equal("Referer" in stream.alternatives[1].headers, false);
    assert.ok(!stream.url.includes("embed"), "HTML embed pages must not be handed to ExoPlayer");
    assert.ok(requestedUrls.some(url => url.hostname === "streamdata.vaplayer.ru" && url.searchParams.get("imdb") === "tt0137523"));
    const diag = pluginLogs.at(-1);
    assert.ok(diag.includes("hosts=cdn.example.test"));
    assert.ok(diag.includes("X-Playback-Key"));
    assert.ok(diag.includes("alternatives=user-agent+resolver-headers"));
    assert.ok(!diag.includes("token=") && !diag.includes("fixture-key"), "diagnostics must not log URLs or header values");
  });

  test("resolve() prefers resolver-supplied authentication headers over fallback variants", async () => {
    const previousHeaders = resolverHeadersFixture;
    resolverHeadersFixture = { Referer: "https://resolver.example/", Origin: "https://resolver.example" };
    try {
      const stream = await plugin.resolve("movie:550");
      assert.equal(stream.headers.Referer, "https://resolver.example/");
      assert.equal(stream.headers.Origin, "https://resolver.example");
      assert.equal(stream.alternatives[0].headers.Referer, "https://resolver.example/");
      assert.equal(stream.alternatives[0].headers.Origin, "https://resolver.example");
      assert.equal(stream.alternatives[0].label, "Nebula");
      assert.ok(pluginLogs.at(-1).includes("alternatives=user-agent+resolver-headers"));
    } finally {
      resolverHeadersFixture = previousHeaders;
    }
  });

  test("resolve() retries once when the resolver transiently returns no stream URLs", async () => {
    const previousReplies = resolverRepliesFixture;
    const before = requestedUrls.filter(url => url.hostname === "streamdata.vaplayer.ru").length;
    resolverRepliesFixture = [jsonResponse({ status_code: 200, data: { stream_urls: [] } })];
    try {
      const stream = await plugin.resolve("movie:550");
      assert.ok(stream.url, "the second resolver response should supply a playable candidate");
      const after = requestedUrls.filter(url => url.hostname === "streamdata.vaplayer.ru").length;
      assert.equal(after - before, 2, "one empty response should trigger exactly one retry");
      assert.ok(pluginLogs.some(line => line.includes("CineJoy resolver: attempt=1;") && line.includes("raw=0; direct=0")));
    } finally {
      resolverRepliesFixture = previousReplies;
    }
  });

  test("resolve() requests the exact season and episode for a TV stream", async () => {
    await plugin.resolve("tv:1399:3:7");
    const request = requestedUrls.find(url => url.hostname === "streamdata.vaplayer.ru" && url.searchParams.get("imdb") === "tt0944947");
    assert.ok(request, "TV stream resolver should be called with the canonical IMDb id");
    assert.equal(request.searchParams.get("type"), "tv");
    assert.equal(request.searchParams.get("season"), "3");
    assert.equal(request.searchParams.get("episode"), "7");
  });

  test("screen() renders native Scaffold for mobile and TV with titleGrid", async () => {
    const mainScreen = await plugin.screen({});
    assert.equal(mainScreen.type.toLowerCase(), "scaffold");
    assert.ok(mainScreen.appBar);
    assert.equal(mainScreen.appBar.mergeWithKinoBar, true);
    assert.equal(mainScreen.appBar.dense, true);
    assert.equal(mainScreen.body.type, "titleGrid");
    assert.ok(Array.isArray(mainScreen.body.items));
    assert.ok(mainScreen.body.items.length > 0);
    assert.ok(mainScreen.body.items[0].poster);
  });

  test("screenEvent() handles tab switching and returns state", async () => {
    const eventRes = await plugin.screenEvent({ name: "changeTab", arg: "movies" });
    assert.ok(eventRes);
    assert.deepEqual(eventRes.state, { tab: "movies" });
  });
});
