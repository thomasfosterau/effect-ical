/**
 * Runs every script under `examples/`, so the examples the README points at
 * are proved to run against the current API (and are measured for coverage).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { main as basic } from "../examples/basic.ts";
import { main as builder } from "../examples/builder.ts";
import { main as effectApi } from "../examples/effect-api.ts";
import { main as vcard } from "../examples/vcard.ts";
import { runTest } from "./helpers/effect.ts";

describe("examples", () => {
  // The examples log through the default `Console` service, which writes to
  // the global console; silence it and assert on what they wrote.
  const log = vi.spyOn(console, "log");
  beforeEach(() => log.mockImplementation(() => undefined));
  afterEach(() => log.mockReset());

  it("basic round-trips a calendar", async () => {
    await runTest(basic());
    expect(log).toHaveBeenCalledWith("Round-trip successful!");
    expect(log).toHaveBeenCalledWith("  Event summary preserved: true");
  });

  it("builder builds and encodes calendars", async () => {
    await runTest(builder());
    expect(log).toHaveBeenCalledWith("- Events: 2");
  });

  it("effect-api encodes a calendar and handles a parse failure", async () => {
    await runTest(effectApi());
    expect(log).toHaveBeenCalledWith("Could not parse: PRODID property is required");
  });

  it("vcard parses, reads and encodes contacts", async () => {
    await runTest(vcard());
    expect(log).toHaveBeenCalledWith("Organisation: Example, Inc. / Engineering");
    expect(log).toHaveBeenCalledWith("Preferred email: jane@work.example (work)");
    expect(log).toHaveBeenCalledWith("Kept as extra: X-ABLABEL");
  });
});
