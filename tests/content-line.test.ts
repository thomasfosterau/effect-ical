/**
 * Tests for the shared content-line layer (RFC 5545 §3.1, RFC 6350 §3.3, RFC 6868).
 */

import { assert, describe, expect, it } from "vite-plus/test";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as ContentLine from "../src/ContentLine";

const parsed = (text: string): ContentLine.ContentLine => {
  const result = ContentLine.parse(text);
  assert(Result.isSuccess(result), `expected ${text} to parse`);
  return result.success;
};

const failure = (text: string): ContentLine.ContentLineError => {
  const result = ContentLine.parse(text);
  assert(Result.isFailure(result), `expected ${text} to fail`);
  return result.failure;
};

describe("ContentLine.parse", () => {
  it("splits a bare line into an upper-cased name and a verbatim value", () => {
    expect(parsed("summary:Lunch\\, then 1:1")).toEqual({
      name: "SUMMARY",
      parameters: [],
      value: "Lunch\\, then 1:1",
    });
  });

  it("reads parameters, upper-casing their names and keeping their values", () => {
    expect(parsed("DTSTART;tzid=Europe/Paris;VALUE=DATE-TIME:20240115T100000").parameters).toEqual([
      { name: "TZID", values: ["Europe/Paris"] },
      { name: "VALUE", values: ["DATE-TIME"] },
    ]);
  });

  it("finds the value after the first colon outside a quoted parameter value", () => {
    const line = parsed('ATTENDEE;CN="Doe: Jane; Esq, PhD";RSVP=TRUE:mailto:jane@example.com');
    expect(line.parameters).toEqual([
      { name: "CN", values: ["Doe: Jane; Esq, PhD"] },
      { name: "RSVP", values: ["TRUE"] },
    ]);
    expect(line.value).toBe("mailto:jane@example.com");
  });

  it("reads comma-separated parameter values, quoted or not", () => {
    expect(parsed('TEL;TYPE=work,"voice,cell":+1-555').parameters).toEqual([
      { name: "TYPE", values: ["work", "voice,cell"] },
    ]);
  });

  it("keeps a group prefix (vCard) and a bare parameter (vCard 2.1)", () => {
    expect(parsed("item1.EMAIL;HOME;X-EMPTY=:jane@example.com")).toEqual({
      group: "item1",
      name: "EMAIL",
      parameters: [
        { name: "HOME", values: [] },
        { name: "X-EMPTY", values: [""] },
      ],
      value: "jane@example.com",
    });
  });

  it("decodes RFC 6868 caret escapes in parameter values", () => {
    expect(parsed("ADR;LABEL=\"Line 1^nLine 2 ^'quoted^' ^^ ^x\":;;").parameters).toEqual([
      { name: "LABEL", values: ['Line 1\nLine 2 "quoted" ^ ^x'] },
    ]);
  });

  it("accepts an empty value", () => {
    expect(parsed("DESCRIPTION:").value).toBe("");
  });

  it("fails without a colon, a name, or a closing quote", () => {
    expect(failure("NO-COLON").message).toContain("Invalid content line");
    expect(failure(":value").message).toContain("Invalid content line");
    expect(failure('X;P="open:value').message).toContain("Invalid content line");
    expect(failure("X;=v:value").message).toContain("Invalid content line");
  });
});

describe("ContentLine.unfold and parseAll", () => {
  it("joins continuation lines and records each line's offset", () => {
    const text = "BEGIN:VCARD\r\nNOTE:one\r\n  two\r\n\tthree\r\n\r\nEND:VCARD\r\n";
    expect(ContentLine.unfold(text)).toEqual([
      { text: "BEGIN:VCARD", offset: 0 },
      { text: "NOTE:one twothree", offset: 13 },
      { text: "END:VCARD", offset: 40 },
    ]);
  });

  it("parses every line", () => {
    const result = ContentLine.parseAll("BEGIN:VCARD\nFN:Jane Doe\nEND:VCARD\n");
    assert(Result.isSuccess(result));
    expect(result.success.map((line) => line.name)).toEqual(["BEGIN", "FN", "END"]);
  });

  it("locates the first invalid line", () => {
    const result = ContentLine.parseAll("BEGIN:VCARD\nFN:Jane\nbroken line\nEND:VCARD\n");
    assert(Result.isFailure(result));
    expect(result.failure._tag).toBe("ContentLineError");
    expect(result.failure.line).toBe(3);
    expect(result.failure.column).toBe(1);
  });

  it("parses a large input without exhausting the stack", () => {
    const text = Array.from({ length: 50_000 }, (_, i) => `X-N;P=${i}:${i}`).join("\r\n");
    const result = ContentLine.parseAll(text);
    assert(Result.isSuccess(result));
    expect(result.success).toHaveLength(50_000);
  });
});

describe("ContentLine.format", () => {
  it("writes the group, upper-cased names and parameters", () => {
    expect(
      ContentLine.format({
        group: "item1",
        name: "tel",
        parameters: [
          { name: "type", values: ["work", "voice"] },
          { name: "pref", values: [] },
        ],
        value: "+1-555",
      }),
    ).toBe("item1.TEL;TYPE=work,voice;PREF:+1-555");
  });

  it("quotes values with :, ; or , and caret-encodes ^, newlines and quotes", () => {
    expect(
      ContentLine.format({
        name: "ATTENDEE",
        parameters: [
          { name: "CN", values: ['Doe, "JJ" ^ Jane'] },
          { name: "X-NOTE", values: ["a\nb"] },
        ],
        value: "mailto:jane@example.com",
      }),
    ).toBe("ATTENDEE;CN=\"Doe, ^'JJ^' ^^ Jane\";X-NOTE=a^nb:mailto:jane@example.com");
  });

  it("round-trips through parse", () => {
    const line: ContentLine.ContentLine = {
      name: "ATTENDEE",
      parameters: [
        { name: "CN", values: ['Doe: Jane; "JJ"\nSmith ^'] },
        { name: "MEMBER", values: ["mailto:a@example.com", "mailto:b@example.com"] },
      ],
      value: "mailto:jane@example.com",
    };
    const folded = ContentLine.format(line);
    expect(folded).toContain("\r\n ");
    expect(ContentLine.parseAll(folded)).toEqual(Result.succeed([line]));
  });

  it("folds at 75 octets without splitting a code point", () => {
    const value = "é".repeat(100);
    const folded = ContentLine.format({ name: "SUMMARY", parameters: [], value });
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(1);
    expect(Math.max(...physical.map((line) => new TextEncoder().encode(line).length))).toBe(75);
    expect(ContentLine.unfold(folded).map((line) => line.text)).toEqual([`SUMMARY:${value}`]);
  });
});

describe("ContentLine.getParameter", () => {
  it("finds a parameter case-insensitively", () => {
    const line = parsed("DTSTART;TZID=Europe/Paris:20240115T100000");
    expect(ContentLine.getParameter(line, "tzid")).toEqual(Option.some(["Europe/Paris"]));
    expect(ContentLine.getParameter(line, "VALUE")).toEqual(Option.none());
  });
});

describe("TEXT values", () => {
  it("escapes and unescapes the reserved characters", () => {
    const text = "Lunch; then 1:1, at C:\\Temp\nBring notes";
    const escaped = ContentLine.escapeText(text);
    expect(escaped).toBe("Lunch\\; then 1:1\\, at C:\\\\Temp\\nBring notes");
    expect(ContentLine.unescapeText(escaped)).toBe(text);
  });

  it("decodes \\N as a newline and keeps unknown escapes", () => {
    expect(ContentLine.unescapeText("a\\Nb\\tc\\")).toBe("a\nb\\tc\\");
  });

  it("splits at unescaped separators only, keeping escapes", () => {
    expect(ContentLine.splitValue("Doe;Jane\\;Q;;", ";")).toEqual(["Doe", "Jane\\;Q", "", ""]);
    expect(ContentLine.splitValue("a\\\\,b\\,c,d", ",")).toEqual(["a\\\\", "b\\,c", "d"]);
    expect(ContentLine.splitValue(";", ";")).toEqual(["", ""]);
    expect(ContentLine.splitValue("", ",")).toEqual([""]);
  });
});
