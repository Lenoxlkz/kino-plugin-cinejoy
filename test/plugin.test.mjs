import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as plugin from "../plugin.js";

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
    const hit = results[0];
    assert.ok(hit.title.toLowerCase().includes("matrix") || hit.overview.toLowerCase().includes("matrix") || hit.id);
  });

  test("episodes() returns seasons and episodes list for a series", async () => {
    const res = await plugin.episodes("tv:1399"); // Game of Thrones
    assert.ok(typeof res === "object" && res !== null, "episodes() must return an object");
    assert.ok(Array.isArray(res.episodes), "episodes property must be an array");
    assert.ok(res.episodes.length > 0, "Should have episodes");
    const ep = res.episodes[0];
    assert.ok(ep.season === 1, "Episode season should match");
    assert.ok(ep.number === 1, "Episode number should match");
    assert.ok(typeof ep.ref === "string", "Episode must have ref");
    assert.ok(Array.isArray(res.seasons), "seasons list must be an array");
  });

  test("resolve() returns playable stream with alternatives", async () => {
    const stream = await plugin.resolve("movie:550"); // Fight Club
    assert.ok(stream.url, "resolve() must return a stream url");
    assert.ok(stream.url.startsWith("https://"), "Stream URL must be https");
    assert.ok(Array.isArray(stream.alternatives), "Alternatives should be an array");
    assert.ok(stream.alternatives.length > 0, "Should have alternatives");
    assert.ok(stream.headers, "Should have playback headers");
  });

  test("screen() renders native Scaffold for mobile and TV", async () => {
    const mainScreen = await plugin.screen({});
    assert.equal(mainScreen.type, "Scaffold");
    assert.ok(mainScreen.appBar, "Must have an appBar");
    assert.equal(mainScreen.appBar.mergeWithKinoBar, true, "AppBar should merge with Kino bar");
    assert.equal(mainScreen.appBar.dense, true, "AppBar should be dense");

    const detailScreen = await plugin.screen({ args: { ref: "movie:550" } });
    assert.equal(detailScreen.type, "Scaffold");
    assert.ok(detailScreen.body, "Detail screen must have a body");
  });

  test("screenEvent() handles tab switching and search triggers", async () => {
    const eventRes = await plugin.screenEvent({ name: "changeTab", arg: "movies" });
    assert.ok(eventRes, "screenEvent should return an action or screen");
  });
});
