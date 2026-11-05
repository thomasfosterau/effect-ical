/**
 * Lossless round-trip (#24): untyped properties are kept in `extra` and
 * unknown sub-components in `components`, so encoding a parsed calendar
 * writes back every line it read.
 */

import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import { assert, describe, expect, it } from "vite-plus/test";
import * as ContentLine from "../src/ContentLine.ts";
import { encodeSync } from "../src/encoder.ts";
import { parseResult } from "../src/parser.ts";
import type { VCalendar } from "../src/types.ts";
import { parseInputs } from "./fixtures/corpus.ts";

const parsed = (text: string): VCalendar => {
  const result = parseResult(text);
  assert(Result.isSuccess(result));
  return result.success;
};

/**
 * Every line of `text`, formatted the way `ContentLine.format` writes it and
 * prefixed with the components it sits in, sorted: equal for two texts that
 * hold the same lines in the same components, whatever their order, folding
 * and line endings.
 */
const canonical = (text: string): ReadonlyArray<string> => {
  const lines = ContentLine.parseAll(text);
  assert(Result.isSuccess(lines));
  const [, keyed] = Arr.mapAccum(
    lines.success,
    Arr.empty<string>(),
    (path, line): readonly [ReadonlyArray<string>, string] => {
      const key = `${Arr.join(path, "/")}|${ContentLine.format(line)}`;
      return line.name === "BEGIN"
        ? [Arr.append(path, line.value), key]
        : line.name === "END"
          ? [Arr.dropRight(path, 1), key]
          : [path, key];
    },
  );
  return Arr.sort(keyed, (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0));
};

/** A calendar in the shape Google, Apple and Outlook exports take. */
const realWorld = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "VERSION:2.0",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
  "X-WR-CALNAME:Team",
  "X-WR-TIMEZONE:Europe/Paris",
  "X-WR-CALDESC:Shared team calendar",
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Paris",
  "X-LIC-LOCATION:Europe/Paris",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "DTSTART;TZID=Europe/Paris:20240115T100000",
  "DTEND;TZID=Europe/Paris:20240115T110000",
  "RRULE:FREQ=WEEKLY;BYDAY=MO",
  "EXDATE;TZID=Europe/Paris:20240122T100000",
  "DTSTAMP:20240110T090000Z",
  "ORGANIZER;CN=Alice Martin:mailto:alice@example.com",
  "UID:abc123@google.com",
  'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN="Martin, Alice";X-NUM-GUESTS=0:mailto:alice@example.com',
  "ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=bob@example.com:mailto:bob@example.com",
  "X-MICROSOFT-CDO-OWNERAPPTID:-1234567",
  "CREATED:20240101T080000Z",
  "DESCRIPTION:Agenda:\\n1. Status\\, blockers\\n2. Plans",
  "LAST-MODIFIED:20240110T090000Z",
  "LOCATION:Room 4\\, Building B",
  "SEQUENCE:3",
  "STATUS:CONFIRMED",
  "SUMMARY:Weekly sync",
  "TRANSP:OPAQUE",
  "GEO:48.8566;2.3522",
  'X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="1 Rue de Rivoli, Paris";X-TITLE="Room 4":geo:48.8566,2.3522',
  "CONFERENCE;VALUE=URI;FEATURE=AUDIO,VIDEO;LABEL=Join:https://meet.example.com/abc",
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "DESCRIPTION:This is an event reminder",
  "TRIGGER;RELATED=START:-PT10M",
  "X-WR-ALARMUID:7F2B",
  "UID:7F2B",
  "END:VALARM",
  "BEGIN:X-GOOGLE-CONFERENCE",
  "X-GOOGLE-ID:abc-defg-hij",
  "END:X-GOOGLE-CONFERENCE",
  "END:VEVENT",
  "BEGIN:VTODO",
  "UID:todo-1",
  "DTSTAMP:20240110T090000Z",
  "SUMMARY:Prepare slides",
  "DUE;VALUE=DATE:20240114",
  "PERCENT-COMPLETE:40",
  "PRIORITY:1",
  "CATEGORIES:WORK",
  "X-APPLE-SORT-ORDER:12",
  "END:VTODO",
  "BEGIN:VJOURNAL",
  "UID:journal-1",
  "DTSTAMP:20240110T090000Z",
  "SUMMARY:Retro notes",
  "ATTACH;FMTTYPE=text/plain:https://example.com/notes.txt",
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "TRIGGER:-PT1H",
  "END:VALARM",
  "END:VJOURNAL",
  "BEGIN:VFREEBUSY",
  "UID:fb-1",
  "DTSTAMP:20240110T090000Z",
  "DTSTART:20240115T000000Z",
  "DTEND:20240116T000000Z",
  "FREEBUSY;FBTYPE=BUSY-TENTATIVE:20240115T090000Z/PT1H,20240115T140000Z/PT30M",
  "END:VFREEBUSY",
  "BEGIN:VAVAILABILITY",
  "UID:avail-1",
  "DTSTAMP:20240110T090000Z",
  "BEGIN:AVAILABLE",
  "UID:avail-1-a",
  "DTSTART;TZID=Europe/Paris:20240101T090000",
  "DTEND;TZID=Europe/Paris:20240101T170000",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  "SUMMARY:Office hours\\, weekdays",
  "END:AVAILABLE",
  "END:VAVAILABILITY",
  "END:VCALENDAR",
  "",
].join("\r\n");

describe("lossless round-trip (#24)", () => {
  it("writes back every line of a real-world calendar", () => {
    expect(canonical(encodeSync(parsed(realWorld)))).toEqual(canonical(realWorld));
  });

  it("is stable: parse → encode → parse gives the same model", () => {
    const once = parsed(realWorld);
    expect(parsed(encodeSync(once))).toEqual(once);
  });

  it.each(
    R.toEntries(
      R.filterMap(parseInputs, (text) =>
        Result.isSuccess(parseResult(text)) ? Result.succeed(text) : Result.failVoid,
      ),
    ),
  )("keeps the corpus input %s through encode → parse", (_name, text) => {
    const once = parsed(text);
    expect(parsed(encodeSync(once))).toEqual(once);
  });

  it("keeps untyped properties as read, in order, with parameters", () => {
    const event = parsed(realWorld).events?.[0];
    expect(Arr.map(event?.extra ?? [], ({ name }) => name)).toEqual([
      "X-MICROSOFT-CDO-OWNERAPPTID",
      "CREATED",
      "LAST-MODIFIED",
      "SEQUENCE",
      "TRANSP",
      "GEO",
      "X-APPLE-STRUCTURED-LOCATION",
      "CONFERENCE",
    ]);
    expect(
      Option.getOrUndefined(
        ContentLine.getParameter(
          Option.getOrThrowWith(Option.fromUndefinedOr(event?.extra?.[6]), () => "no line"),
          "X-ADDRESS",
        ),
      ),
    ).toEqual(["1 Rue de Rivoli, Paris"]);
    // The lower-cased untyped fields stay, as before.
    expect(event).toMatchObject({ sequence: 3, transp: "OPAQUE" });
  });

  it("keeps unknown components verbatim, nested ones included", () => {
    const calendar = parsed(realWorld);
    expect(calendar.components).toEqual([
      {
        component: "VAVAILABILITY",
        properties: [
          { name: "UID", parameters: [], value: "avail-1" },
          { name: "DTSTAMP", parameters: [], value: "20240110T090000Z" },
        ],
        components: [
          {
            component: "AVAILABLE",
            properties: [
              { name: "UID", parameters: [], value: "avail-1-a" },
              {
                name: "DTSTART",
                parameters: [{ name: "TZID", values: ["Europe/Paris"] }],
                value: "20240101T090000",
              },
              {
                name: "DTEND",
                parameters: [{ name: "TZID", values: ["Europe/Paris"] }],
                value: "20240101T170000",
              },
              { name: "RRULE", parameters: [], value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
              { name: "SUMMARY", parameters: [], value: "Office hours\\, weekdays" },
            ],
          },
        ],
      },
    ]);
    expect(calendar.events?.[0]?.components?.[0]?.component).toBe("X-GOOGLE-CONFERENCE");
    // A VALARM is typed only under an event or a to-do.
    expect(calendar.journals?.[0]?.components?.[0]?.component).toBe("VALARM");
  });

  it("writes GEO and FREEBUSY once: from `extra` after a parse, from the fields when built", () => {
    const encoded = encodeSync(parsed(realWorld));
    expect(encoded.split("GEO:").length - 1).toBe(1);
    expect(encoded.split("\r\nFREEBUSY").length - 1).toBe(1);
    const built = encodeSync({
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//EN",
      events: [{ component: "VEVENT", dtstart: "20240101", geo: { lat: 1.5, lon: -2 } }],
      freebusys: [
        {
          component: "VFREEBUSY",
          dtstart: "20240101",
          dtend: "20240102",
          freebusy: [{ type: "BUSY", periods: [{ start: "20240101T090000Z", end: "PT1H" }] }],
        },
      ],
    });
    expect(built).toContain("GEO:1.5;-2\r\n");
    expect(built).toContain("FREEBUSY;FBTYPE=BUSY:20240101T090000Z/PT1H\r\n");
  });

  it("writes `extra` after the typed fields and unknown components last", () => {
    const encoded = encodeSync({
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//EN",
      extra: [{ name: "X-WR-CALNAME", parameters: [], value: "Team" }],
      components: [
        { component: "X-THING", properties: [{ name: "X-A", parameters: [], value: "1" }] },
      ],
      events: [{ component: "VEVENT", dtstart: "20240101" }],
    });
    expect(encoded).toBe(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Test//EN",
        "X-WR-CALNAME:Team",
        "BEGIN:VEVENT",
        "DTSTART:20240101",
        "END:VEVENT",
        "BEGIN:X-THING",
        "X-A:1",
        "END:X-THING",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
    );
  });
});
