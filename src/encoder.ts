/**
 * Encode the plain {@link Types.VCalendar} object model as iCalendar
 * (RFC 5545) text.
 *
 * Output uses CRLF line endings and folds every content line longer than 75
 * octets (UTF-8) onto continuation lines. Text-valued properties (`SUMMARY`,
 * `DESCRIPTION`, `LOCATION`, `NAME`) are escaped; every other value is written
 * verbatim. Optional string properties that are empty are omitted.
 *
 * @module
 */

import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import type * as Types from "./types.js";

/**
 * The encoder's failure: the calendar lacks its required `version` or
 * `prodid`. `message` says which.
 *
 * @category errors
 */
export class EncodeError extends Schema.TaggedError<EncodeError>()("EncodeError", {
  message: Schema.String,
}) {}

/** UTF-8 length of one code point (a lone surrogate encodes as U+FFFD: 3 octets). */
const utf8Length = (char: string): number => {
  const codePoint = char.codePointAt(0) ?? 0;
  return codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
};

/** Octets on the first physical line; continuation lines carry one fewer after their leading space. */
const firstLineOctets = 75;
const continuationOctets = 74;

interface FoldState {
  readonly segment: number;
  readonly octets: number;
}

/**
 * Fold a content line according to RFC 5545 §3.1: no physical line longer
 * than 75 octets (UTF-8), continuation lines starting with a space, and never
 * splitting a code point.
 */
const foldLine = (line: string): string => {
  const chars = Array.from(line);
  const lengths = Arr.map(chars, utf8Length);
  if (Arr.reduce(lengths, 0, (total, length) => total + length) <= firstLineOctets) {
    return line;
  }
  const states = Arr.drop(
    Arr.scan(lengths, { segment: 0, octets: 0 }, (state: FoldState, length): FoldState => {
      const limit = state.segment === 0 ? firstLineOctets : continuationOctets;
      return state.octets + length > limit
        ? { segment: state.segment + 1, octets: length }
        : { segment: state.segment, octets: state.octets + length };
    }),
    1,
  );
  const segments = Arr.groupBy(Arr.zip(chars, states), ([, state]) => String(state.segment));
  return Arr.join(
    Arr.map(
      Record.values(segments),
      (segment, index) =>
        (index === 0 ? "" : " ") +
        Arr.join(
          Arr.map(segment, ([char]) => char),
          "",
        ),
    ),
    "\r\n",
  );
};

/** Escape the characters RFC 5545 §3.3.11 reserves in TEXT values. */
const escapeValue = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** Format (and fold) a content line: `NAME[;PARAM=VALUE]*:VALUE`. */
const formatContentLine = (
  name: string,
  value: string,
  params: Readonly<Record<string, string>> = {},
): string =>
  foldLine(
    name.toUpperCase() +
      Arr.join(
        Arr.map(Record.toEntries(params), ([key, param]) => `;${key.toUpperCase()}=${param}`),
        "",
      ) +
      `:${value}`,
  );

/** A property line when `value` is a non-empty string, otherwise nothing. */
const optional = (name: string, value?: string): ReadonlyArray<string> =>
  value ? [formatContentLine(name, value)] : [];

/** An escaped TEXT property line when `value` is a non-empty string, otherwise nothing. */
const optionalText = (name: string, value?: string): ReadonlyArray<string> =>
  value ? [formatContentLine(name, escapeValue(value))] : [];

/** A property line when `value` is a number (zero included), otherwise nothing. */
const optionalNumber = (name: string, value?: number): ReadonlyArray<string> =>
  value === undefined ? [] : [formatContentLine(name, value.toString())];

/** One property line per value, in order. */
const each = (name: string, values: ReadonlyArray<string> = []): ReadonlyArray<string> =>
  Arr.map(values, (value) => formatContentLine(name, value));

/** `BEGIN:<name>`, the body, `END:<name>`. */
const block = (name: string, body: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> => [
  `BEGIN:${name}`,
  ...Arr.flatten(body),
  `END:${name}`,
];

const encodeAlarm = (alarm: Types.VAlarm): ReadonlyArray<string> =>
  block("VALARM", [
    [formatContentLine("ACTION", alarm.action), formatContentLine("TRIGGER", alarm.trigger)],
    optional("DURATION", alarm.duration),
    optionalNumber("REPEAT", alarm.repeat),
    optionalText("DESCRIPTION", alarm.description),
    optionalText("SUMMARY", alarm.summary),
    each("ATTENDEE", alarm.attendee),
    optional("ATTACH", alarm.attach),
  ]);

const encodeAlarms = (alarms: ReadonlyArray<Types.VAlarm> = []): ReadonlyArray<string> =>
  Arr.flatMap(alarms, encodeAlarm);

const encodeEvent = (event: Types.VEvent): ReadonlyArray<string> =>
  block("VEVENT", [
    // DTSTART is required by RFC 5545.
    [formatContentLine("DTSTART", event.dtstart)],
    optional("UID", event.uid),
    optional("DTSTAMP", event.dtstamp),
    optional("DTEND", event.dtend),
    optional("DURATION", event.duration),
    optionalText("SUMMARY", event.summary),
    optionalText("DESCRIPTION", event.description),
    optionalText("LOCATION", event.location),
    optional("ORGANIZER", event.organizer),
    each("ATTENDEE", event.attendee),
    event.categories ? [formatContentLine("CATEGORIES", Arr.join(event.categories, ","))] : [],
    optional("STATUS", event.status),
    optional("RRULE", event.rrule),
    each("RDATE", event.rdate),
    each("EXDATE", event.exdate),
    optional("URL", event.url),
    event.geo ? [formatContentLine("GEO", `${event.geo.lat};${event.geo.lon}`)] : [],
    optionalNumber("PRIORITY", event.priority),
    optional("CLASS", event.class),
    encodeAlarms(event.alarms),
  ]);

const encodeTodo = (todo: Types.VTodo): ReadonlyArray<string> =>
  block("VTODO", [
    optional("UID", todo.uid),
    optional("DTSTAMP", todo.dtstamp),
    optional("DTSTART", todo.dtstart),
    optional("DUE", todo.due),
    optional("DURATION", todo.duration),
    optionalText("SUMMARY", todo.summary),
    optionalText("DESCRIPTION", todo.description),
    optionalText("LOCATION", todo.location),
    optional("STATUS", todo.status),
    optionalNumber("PERCENT-COMPLETE", todo.percent),
    optional("COMPLETED", todo.completed),
    optionalNumber("PRIORITY", todo.priority),
    optional("RRULE", todo.rrule),
    encodeAlarms(todo.alarms),
  ]);

const encodeJournal = (journal: Types.VJournal): ReadonlyArray<string> =>
  block("VJOURNAL", [
    optional("UID", journal.uid),
    optional("DTSTAMP", journal.dtstamp),
    optional("DTSTART", journal.dtstart),
    optionalText("SUMMARY", journal.summary),
    optionalText("DESCRIPTION", journal.description),
    optional("STATUS", journal.status),
    optional("CLASS", journal.class),
  ]);

const encodeFreeBusy = (freebusy: Types.VFreeBusy): ReadonlyArray<string> =>
  block("VFREEBUSY", [
    optional("UID", freebusy.uid),
    optional("DTSTAMP", freebusy.dtstamp),
    // DTSTART and DTEND are required by RFC 5545.
    [formatContentLine("DTSTART", freebusy.dtstart), formatContentLine("DTEND", freebusy.dtend)],
    optional("ORGANIZER", freebusy.organizer),
    optional("URL", freebusy.url),
    each("ATTENDEE", freebusy.attendee),
    Arr.map(freebusy.freebusy ?? [], (entry) =>
      formatContentLine(
        "FREEBUSY",
        Arr.join(
          Arr.map(entry.periods, (period) => `${period.start}/${period.end}`),
          ",",
        ),
        entry.type ? { FBTYPE: entry.type } : {},
      ),
    ),
  ]);

type Observance = NonNullable<Types.VTimezone["standard"]>[number];

const encodeObservance =
  (name: "STANDARD" | "DAYLIGHT") =>
  (observance: Observance): ReadonlyArray<string> =>
    block(name, [
      [
        formatContentLine("DTSTART", observance.dtstart),
        formatContentLine("TZOFFSETFROM", observance.tzoffsetfrom),
        formatContentLine("TZOFFSETTO", observance.tzoffsetto),
      ],
      optional("RRULE", observance.rrule),
      optional("TZNAME", observance.tzname),
    ]);

const encodeTimezone = (timezone: Types.VTimezone): ReadonlyArray<string> =>
  block("VTIMEZONE", [
    // TZID is required by RFC 5545.
    [formatContentLine("TZID", timezone.tzid)],
    optional("LAST-MODIFIED", timezone.lastmod),
    optional("TZURL", timezone.tzurl),
    Arr.flatMap(timezone.standard ?? [], encodeObservance("STANDARD")),
    Arr.flatMap(timezone.daylight ?? [], encodeObservance("DAYLIGHT")),
  ]);

/**
 * Encode a {@link Types.VCalendar} as iCalendar text, synchronously.
 *
 * Fails when `version` or `prodid` is missing or empty (possible only for a
 * value that bypassed the types). Components are written in a fixed order:
 * timezones, events, todos, journals, then free/busy.
 *
 * @example
 * ```ts
 * import { encodeResult } from "@thomasfosterau/effect-ical"
 * import * as Result from "effect/Result"
 *
 * const result = encodeResult({ component: "VCALENDAR", version: "2.0", prodid: "-//Example//EN" })
 * console.log(Result.getOrElse(result, () => "")) // "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n..."
 * ```
 *
 * @category encoding
 */
export const encodeResult = (calendar: Types.VCalendar): Result.Result<string, EncodeError> => {
  if (!calendar.version) {
    return Result.fail(new EncodeError({ message: "VERSION property is required" }));
  }
  if (!calendar.prodid) {
    return Result.fail(new EncodeError({ message: "PRODID property is required" }));
  }
  const lines = block("VCALENDAR", [
    [formatContentLine("VERSION", calendar.version), formatContentLine("PRODID", calendar.prodid)],
    optional("CALSCALE", calendar.calscale),
    optional("METHOD", calendar.method),
    optionalText("NAME", calendar.name),
    optionalText("DESCRIPTION", calendar.description),
    Arr.flatMap(calendar.timezones ?? [], encodeTimezone),
    Arr.flatMap(calendar.events ?? [], encodeEvent),
    Arr.flatMap(calendar.todos ?? [], encodeTodo),
    Arr.flatMap(calendar.journals ?? [], encodeJournal),
    Arr.flatMap(calendar.freebusys ?? [], encodeFreeBusy),
  ]);
  return Result.succeed(Arr.join(lines, "\r\n") + "\r\n");
};

/**
 * Encode a {@link Types.VCalendar} as iCalendar text, failing with an
 * {@link EncodeError}. The encoding runs when the Effect runs.
 *
 * @example
 * ```ts
 * import { encode } from "@thomasfosterau/effect-ical"
 * import * as Effect from "effect/Effect"
 *
 * const program = encode({ component: "VCALENDAR", version: "2.0", prodid: "-//Example//EN" })
 * const text = await Effect.runPromise(program)
 * ```
 *
 * @category encoding
 */
export const encode = (calendar: Types.VCalendar): Effect.Effect<string, EncodeError> =>
  Effect.suspend(() => Effect.fromResult(encodeResult(calendar)));

/**
 * Encode a {@link Types.VCalendar} as iCalendar text, throwing the
 * {@link EncodeError} when `version` or `prodid` is missing.
 *
 * @example
 * ```ts
 * import { encodeSync } from "@thomasfosterau/effect-ical"
 *
 * const text = encodeSync({ component: "VCALENDAR", version: "2.0", prodid: "-//Example//EN" })
 * ```
 *
 * @category encoding
 */
export const encodeSync = (calendar: Types.VCalendar): string =>
  Result.match(encodeResult(calendar), {
    onFailure: (error) => {
      throw error;
    },
    onSuccess: (text) => text,
  });
