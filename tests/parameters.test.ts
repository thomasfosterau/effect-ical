/**
 * Property parameters of typed fields are kept in `parameters` and written
 * back by the encoder (#22).
 */

import * as Result from "effect/Result";
import { assert, describe, expect, it } from "vite-plus/test";
import { encodeSync } from "../src/encoder.ts";
import { parseResult } from "../src/parser.ts";
import type { VCalendar } from "../src/types.ts";

const calendar = (...lines: ReadonlyArray<string>): string =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//EN", ...lines, "END:VCALENDAR", ""].join(
    "\r\n",
  );

const parsed = (text: string): VCalendar => {
  const result = parseResult(text);
  assert(Result.isSuccess(result));
  return result.success;
};

const text = calendar(
  "BEGIN:VEVENT",
  "UID:a",
  "DTSTART;TZID=Europe/Paris:20240115T100000",
  "DTEND;VALUE=DATE:20240116",
  'ATTENDEE;CN="Doe, Jane";PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:jane@example.com',
  "ATTENDEE:mailto:bob@example.com",
  'ORGANIZER;CN="Room: 4":mailto:room@example.com',
  "EXDATE;TZID=Europe/Paris:20240122T100000",
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "TRIGGER;RELATED=END:-PT5M",
  "END:VALARM",
  "END:VEVENT",
);

describe("parameters (#22)", () => {
  it("keeps each typed field's parameters, one list per line", () => {
    const event = parsed(text).events?.[0];
    expect(event?.dtstart).toBe("20240115T100000");
    expect(event?.parameters).toEqual({
      dtstart: [[{ name: "TZID", values: ["Europe/Paris"] }]],
      dtend: [[{ name: "VALUE", values: ["DATE"] }]],
      attendee: [
        [
          { name: "CN", values: ["Doe, Jane"] },
          { name: "PARTSTAT", values: ["ACCEPTED"] },
          { name: "RSVP", values: ["TRUE"] },
        ],
        [],
      ],
      organizer: [[{ name: "CN", values: ["Room: 4"] }]],
      exdate: [[{ name: "TZID", values: ["Europe/Paris"] }]],
    });
    expect(event?.alarms?.[0]?.parameters).toEqual({
      trigger: [[{ name: "RELATED", values: ["END"] }]],
    });
  });

  it("keeps a quoted `:` inside the parameter, not the value", () => {
    expect(parsed(text).events?.[0]?.organizer).toBe("mailto:room@example.com");
  });

  it("sets no `parameters` when no line carries any", () => {
    const calendarValue = parsed(calendar("BEGIN:VEVENT", "DTSTART:20240101", "END:VEVENT"));
    expect(calendarValue).not.toHaveProperty("parameters");
    expect(calendarValue.events?.[0]).not.toHaveProperty("parameters");
  });

  it("keeps the parameters of the line whose value is kept", () => {
    const event = parsed(calendar("BEGIN:VEVENT", "DTSTART;TZID=A:1", "DTSTART:2", "END:VEVENT"))
      .events?.[0];
    expect(event?.dtstart).toBe("2");
    expect(event).not.toHaveProperty("parameters");
  });

  it("keeps calendar-level and observance parameters", () => {
    const value = parsed(
      calendar(
        "NAME;LANGUAGE=en:Work",
        "BEGIN:VTIMEZONE",
        "TZID:Europe/Paris",
        "BEGIN:STANDARD",
        "DTSTART:19701025T030000",
        "TZOFFSETFROM:+0200",
        "TZOFFSETTO:+0100",
        "TZNAME;LANGUAGE=fr:CET",
        "END:STANDARD",
        "END:VTIMEZONE",
      ),
    );
    expect(value.parameters).toEqual({ name: [[{ name: "LANGUAGE", values: ["en"] }]] });
    expect(value.timezones?.[0]?.standard?.[0]?.parameters).toEqual({
      tzname: [[{ name: "LANGUAGE", values: ["fr"] }]],
    });
  });

  it("reads a line `ContentLine.parse` rejects as before, without parameters", () => {
    const event = parsed(calendar("BEGIN:VEVENT", 'DTSTART;X="unterminated:20240101', "END:VEVENT"))
      .events?.[0];
    expect(event?.dtstart).toBe("20240101");
    expect(event).not.toHaveProperty("parameters");
  });

  it("encodes the parameters back, so encode → parse keeps them", () => {
    const encoded = encodeSync(parsed(text));
    expect(encoded).toContain("DTSTART;TZID=Europe/Paris:20240115T100000\r\n");
    expect(encoded).toContain("DTEND;VALUE=DATE:20240116\r\n");
    expect(encoded).toContain(
      'ATTENDEE;CN="Doe, Jane";PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:jane@example.com\r\n',
    );
    expect(encoded).toContain("ATTENDEE:mailto:bob@example.com\r\n");
    expect(encoded).toContain('ORGANIZER;CN="Room: 4":mailto:room@example.com\r\n');
    expect(encoded).toContain("TRIGGER;RELATED=END:-PT5M\r\n");
    expect(parsed(encoded)).toEqual(parsed(text));
  });

  it("writes parameters set by hand, CATEGORIES with its first list", () => {
    const encoded = encodeSync({
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//EN",
      parameters: { prodid: [[{ name: "X-A", values: ["1"] }]] },
      events: [
        {
          component: "VEVENT",
          dtstart: "20240101",
          categories: ["A", "B"],
          rdate: ["20240102", "20240103"],
          parameters: {
            dtstart: [[{ name: "VALUE", values: ["DATE"] }]],
            categories: [[{ name: "LANGUAGE", values: ["en"] }], []],
            rdate: [[], [{ name: "VALUE", values: ["DATE"] }]],
          },
        },
      ],
    });
    expect(encoded).toContain("PRODID;X-A=1:-//Test//EN\r\n");
    expect(encoded).toContain("DTSTART;VALUE=DATE:20240101\r\n");
    expect(encoded).toContain("CATEGORIES;LANGUAGE=en:A,B\r\n");
    expect(encoded).toContain("RDATE:20240102\r\nRDATE;VALUE=DATE:20240103\r\n");
  });
});
