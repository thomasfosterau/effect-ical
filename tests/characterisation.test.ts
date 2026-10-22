/**
 * Pins the library's observable behaviour to `fixtures/corpus.golden.json`:
 * what the Effect 3 implementation produced for every input in
 * `fixtures/corpus.ts`, before the Effect 4 / lint-plugin migration.
 */

import * as Record from "effect/Record";
import { describe, expect, it } from "vite-plus/test";
import { characterise } from "./fixtures/corpus.ts";
import golden from "./fixtures/corpus.golden.json" with { type: "json" };
import { runOutcome } from "./helpers/effect.ts";

describe("characterisation corpus", () => {
  const actual = characterise(runOutcome);

  it.each(Record.toEntries(golden.parse))("parse: %s", (name, expected) => {
    expect(actual.parse[name]).toEqual(expected);
  });

  it.each(Record.toEntries(golden.decode))("Calendar.decode: %s", (name, expected) => {
    expect(actual.decode[name]).toEqual(expected);
  });

  it.each(Record.toEntries(golden.encode))("encode: %s", (name, expected) => {
    expect(actual.encode[name]).toEqual(expected);
  });

  it.each(Record.toEntries(golden.builder))("builder: %s", (name, expected) => {
    expect(actual.builder[name]).toEqual(expected);
  });

  it.each(Record.toEntries(golden.modules))("modules: %s", (name, expected) => {
    expect(actual.modules[name]).toEqual(expected);
  });
});
