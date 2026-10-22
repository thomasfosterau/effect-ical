# @thomasfosterau/effect-ical

iCalendar ([RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545)) encoding and decoding for [Effect](https://effect.website): a typed object model for `VCALENDAR` data, a parser and an encoder (as pure `Result` functions and as Effects), fluent builders, and pipeable `Calendar` / `Event` / `Todo` modules.

- Components: `VEVENT`, `VTODO`, `VJOURNAL`, `VFREEBUSY`, `VTIMEZONE` (with `STANDARD` / `DAYLIGHT`) and `VALARM`.
- The encoder escapes TEXT values, folds lines at 75 octets (UTF-8, never splitting a character) and writes CRLF line endings; the parser unfolds lines and collects repeatable properties (`ATTENDEE`, `CATEGORIES`, `RDATE`, `EXDATE`) into arrays.
- Values stay verbatim strings: dates, durations and recurrence rules are not decoded, and parsed TEXT values are not unescaped.
- Failures are tagged errors (`ParseError`, `EncodeError`, `BuildError`) you can handle with `Effect.catchTag`.

| Package | Purpose | Peers |
| --- | --- | --- |
| [`@thomasfosterau/effect-ical`](https://www.npmjs.com/package/@thomasfosterau/effect-ical) | iCalendar parse, encode and build | `effect` `>=4.0.0-rc.118` |

## Install

```sh
pnpm add @thomasfosterau/effect-ical effect
```

The package is ESM only and has no runtime dependencies besides its `effect` peer.

## Quick start

```ts
import { encodeSync, parse } from "@thomasfosterau/effect-ical";
import type { VCalendar } from "@thomasfosterau/effect-ical";
import * as Effect from "effect/Effect";

const calendar: VCalendar = {
  component: "VCALENDAR",
  version: "2.0",
  prodid: "-//Example Corp//Example App//EN",
  events: [
    {
      component: "VEVENT",
      uid: "standup@example.com",
      dtstart: "20240115T100000Z",
      dtend: "20240115T110000Z",
      summary: "Team standup",
      location: "Room A",
    },
  ],
};

const text = encodeSync(calendar); // "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n…"

const program = parse(text).pipe(
  Effect.map((parsed) => parsed.events?.[0]?.summary), // "Team standup"
  Effect.catchTag("ParseError", (error) => Effect.succeed(`invalid: ${error.message}`)),
);
```

## API

Everything is exported from the package root.

### Parsing

| Export | Signature | Notes |
| --- | --- | --- |
| `parse` | `(text: string) => Effect<VCalendar, ParseError>` | Runs when the Effect runs. |
| `parseResult` | `(text: string) => Result<VCalendar, ParseError>` | The same parse, synchronously. |
| `ParseError` | tagged error, `_tag: "ParseError"`, `message` | No `VCALENDAR`, an unclosed calendar, a line without `:`, a missing or non-`2.0` `VERSION`, or a missing `PRODID`. |

Text before the first `BEGIN:VCALENDAR` and after its `END:VCALENDAR` is ignored, and so are components of an unknown type. Property names become lower-cased fields (`PERCENT-COMPLETE` → `percent`, `LAST-MODIFIED` → `lastmod`, `X-WR-CALNAME` → `"x-wr-calname"`); `PRIORITY`, `PERCENT-COMPLETE`, `REPEAT` and `SEQUENCE` become numbers when they are integers. Property parameters (`;TZID=…`) are dropped.

```ts
import { parseResult } from "@thomasfosterau/effect-ical";
import * as Result from "effect/Result";

const result = parseResult(
  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Example//EN\r\nEND:VCALENDAR\r\n",
);
if (Result.isSuccess(result)) {
  console.log(result.success.prodid); // "-//Example//EN"
} else {
  console.log(result.failure.message);
}
```

### Encoding

| Export | Signature | Notes |
| --- | --- | --- |
| `encode` | `(calendar: VCalendar) => Effect<string, EncodeError>` | Runs when the Effect runs. |
| `encodeResult` | `(calendar: VCalendar) => Result<string, EncodeError>` | Synchronous. |
| `encodeSync` | `(calendar: VCalendar) => string` | Throws the `EncodeError`. |
| `EncodeError` | tagged error, `_tag: "EncodeError"`, `message` | `version` or `prodid` missing or empty (only possible for a value that bypassed the types). |

Components are written in a fixed order: timezones, events, to-dos, journals, free/busy. Optional string properties that are empty are omitted; numeric ones (`priority`, `percent`, `repeat`) are written whenever set, `0` included. `SUMMARY`, `DESCRIPTION`, `LOCATION` and `NAME` are escaped (`\`, `;`, `,`, newline); every other value is written as given.

### The object model

`VCalendar`, `VEvent`, `VTodo`, `VJournal`, `VFreeBusy`, `VTimezone` and `VAlarm` are plain TypeScript interfaces, one per component, each with a `component` discriminant (`"VEVENT"`, …). `VCalendar` holds the components in `timezones`, `events`, `todos`, `journals` and `freebusys`; events and to-dos hold their alarms in `alarms`.

```ts
import { encodeSync } from "@thomasfosterau/effect-ical";
import type { VCalendar } from "@thomasfosterau/effect-ical";

const calendar: VCalendar = {
  component: "VCALENDAR",
  version: "2.0",
  prodid: "-//Example Corp//Example App//EN",
  todos: [
    {
      component: "VTODO",
      uid: "proposal@example.com",
      due: "20240205T170000Z",
      summary: "Write the proposal",
      status: "IN-PROCESS",
      percent: 50,
      alarms: [
        { component: "VALARM", action: "DISPLAY", trigger: "-PT1H", description: "Due soon" },
      ],
    },
  ],
};

const text = encodeSync(calendar);
```

### Fluent builders

`createCalendar(prodid)`, `createEvent()` and `createTodo()` return mutable builders (`CalendarBuilder`, `EventBuilder`, `TodoBuilder`) whose setters return the builder, so calls chain. `build()` returns the object model value; it throws a `BuildError` when an event has no `dtstart` or a calendar no `prodid`. `CalendarBuilder` also has `toICalString()` (via `encodeSync`) and `toICalEffect()` (via `encode`).

```ts
import { createCalendar, createEvent } from "@thomasfosterau/effect-ical";

const text = createCalendar("-//Example Corp//Example App//EN")
  .name("Work")
  .event((e) =>
    e
      .uid("review@example.com")
      .dtstart("20240115T140000Z")
      .dtend("20240115T150000Z")
      .summary("Code review")
      .addAttendee("mailto:alice@example.com")
      .addDisplayAlarm("-PT15M", "Review in 15 minutes"),
  )
  .todo((t) => t.uid("notes@example.com").summary("Send notes").priority(1))
  .toICalString();

const event = createEvent()
  .uid("solo@example.com")
  .dtstart("20240301T090000Z")
  .summary("Focus time")
  .build();
```

Event setters: `uid`, `dtstart`, `dtend`, `duration`, `summary`, `description`, `location`, `organizer`, `addAttendee`, `attendees`, `categories`, `status`, `rrule`, `url`, `geo(lat, lon)`, `priority`, `classification`, `dtstamp`, `addAlarm`, `addDisplayAlarm(trigger, description?)`. To-do setters: `uid`, `dtstart`, `due`, `duration`, `summary`, `description`, `location`, `status`, `percentComplete` (clamped to 0–100), `completed`, `priority`, `dtstamp`, `rrule`, `addAlarm`. Calendar setters: `prodid`, `calscale`, `method`, `name`, `description`, `addEvent`, `event(fn)`, `addTodo`, `todo(fn)`, `addJournal`, `addTimezone`.

### Pipeable modules: `Calendar`, `Event`, `Todo`

Each module defines an Effect Schema class of the same name plus a `make` constructor and pipeable `with*` setters that return a new value.

```ts
import { Calendar, Event, Todo } from "@thomasfosterau/effect-ical";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";

const standup = pipe(
  Event.make("20240115T100000Z"),
  Event.withUid("standup@example.com"),
  Event.withSummary("Team standup"),
  Event.withStatus("CONFIRMED"),
);

const proposal = pipe(Todo.make(), Todo.withSummary("Write the proposal"), Todo.withPercent(60));

const calendar = pipe(
  Calendar.builder(),
  Calendar.withProdid("-//Example Corp//Example App//EN"),
  Calendar.withName("Work"),
  Calendar.withEvent(standup),
  Calendar.withTodo(proposal),
  Calendar.build,
);

const text = await Effect.runPromise(Calendar.encode(calendar));
```

- `Event`: `make(dtstart)`, `withUid`, `withDtend`, `withDuration`, `withSummary`, `withDescription`, `withLocation`, `withOrganizer`, `withAttendee`, `withCategories`, `withStatus`, `withRrule`, `withUrl`, `withPriority`, `withClassification`, and `encode(event): Effect<Array<string>>` (the event's content lines, unescaped and unfolded).
- `Todo`: `make()`, `withUid`, `withDtstart`, `withDue`, `withSummary`, `withDescription`, `withLocation`, `withStatus`, `withPercent` (clamped to 0–100), `withCompleted`, `withPriority`, `withRrule`, and `encode(todo): Effect<Array<string>>`.
- `Calendar`: `make(prodid)`, `builder()`, `withProdid`, `withName`, `withDescription`, `withCalscale`, `withMethod`, `withEvent`, `withTodo`, `build`, and:
  - `encode(calendar): Effect<string>`: a compact rendering. Values are not escaped or folded, and only an event's `DTSTART`, `UID`, `SUMMARY`, `DTEND`, `DESCRIPTION`, `LOCATION`, `STATUS` and a to-do's `UID`, `SUMMARY`, `DTSTART`, `DUE`, `STATUS`, `PERCENT-COMPLETE` are written. For complete output, use the root `encode` on a `VCalendar`.
  - `decode(text): Effect<Calendar, ParseError>`: a shallow reader of the top-level `PRODID`, `VERSION`, `NAME`, `DESCRIPTION`, `CALSCALE` and `METHOD`. It does not unfold lines or read components, and a matching line inside a component also counts (the last one wins). For a full parse, use the root `parse`.

## Examples

The repository's `examples/` directory has three runnable programs, one per API style; its test suite runs each of them.

## Standards

Implements RFC 5545 content lines, components and escaping. Extensions from RFC 5546 (iTIP), RFC 6868 (parameter encoding), RFC 7529 (non-Gregorian recurrence) and RFC 7986 (new properties) are not implemented, though their properties pass through the parser as plain fields.

## Changelog

Release notes are in the package's `CHANGELOG.md`, written by Changesets.

## License

MIT. See the `LICENSE` file in the package.
