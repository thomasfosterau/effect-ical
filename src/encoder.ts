/**
 * Encode the plain {@link Types.VCalendar} object model as iCalendar
 * (RFC 5545) text.
 *
 * Output uses CRLF line endings and folds every content line longer than 75
 * octets (UTF-8) onto continuation lines. Text-valued properties (`SUMMARY`,
 * `DESCRIPTION`, `LOCATION`, `NAME`, `TZNAME` and each `CATEGORIES` item) are
 * escaped; every other value is written verbatim. Optional string properties that are empty are omitted.
 * Each typed field's line carries the parameters its component's
 * `parameters` keeps for it (see {@link Types.FieldParameters}).
 *
 * @module
 */

import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as ContentLine from "./ContentLine.js";
import { fieldName } from "./properties.js";
import type * as Types from "./types.js";

/**
 * The encoder's failure: the calendar lacks its required `version` or
 * `prodid`. `message` says which.
 *
 * @category errors
 */
export class EncodeError extends Schema.TaggedError<
  EncodeError,
  { readonly brand: unique symbol }
>()("EncodeError", {
  message: Schema.String,
}) {}

/** A component's parameter list for one content line. */
type Parameters = ReadonlyArray<ContentLine.Parameter>;

/** Format (and fold) a content line: `NAME[;PARAM=VALUE]*:VALUE`. */
const formatContentLine = (name: string, value: string, parameters: Parameters = []): string =>
  ContentLine.format({ name, parameters, value });

/**
 * The property-line writers for one component, each writing the parameters
 * `parameters` keeps for its field (see {@link Types.FieldParameters}).
 */
const writers = (parameters: Types.FieldParameters = {}) => {
  const parametersOf = (name: string, index = 0): Parameters =>
    parameters[fieldName(name)]?.[index] ?? [];
  const line = (name: string, value: string): string =>
    formatContentLine(name, value, parametersOf(name));
  return {
    /** A property line, written whatever its value. */
    required: (name: string, value: string): ReadonlyArray<string> => [line(name, value)],
    /** A property line when `value` is a non-empty string, otherwise nothing. */
    optional: (name: string, value?: string): ReadonlyArray<string> =>
      value ? [line(name, value)] : [],
    /** An escaped TEXT property line when `value` is a non-empty string, otherwise nothing. */
    optionalText: (name: string, value?: string): ReadonlyArray<string> =>
      value ? [line(name, ContentLine.escapeText(value))] : [],
    /** A property line when `value` is a number (zero included), otherwise nothing. */
    optionalNumber: (name: string, value?: number): ReadonlyArray<string> =>
      value === undefined ? [] : [line(name, value.toString())],
    /** One property line per value, in order, each with its own parameters. */
    each: (name: string, values: ReadonlyArray<string> = []): ReadonlyArray<string> =>
      Arr.map(values, (value, index) => formatContentLine(name, value, parametersOf(name, index))),
    /** One TEXT-list line (`CATEGORIES`): every item escaped, joined with `,`. */
    textList: (name: string, values?: ReadonlyArray<string>): ReadonlyArray<string> =>
      values ? [line(name, Arr.join(Arr.map(values, ContentLine.escapeText), ","))] : [],
  };
};

/** `BEGIN:<name>`, the body, `END:<name>`. */
const block = (name: string, body: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> => [
  `BEGIN:${name}`,
  ...Arr.flatten(body),
  `END:${name}`,
];

const encodeAlarm = (alarm: Types.VAlarm): ReadonlyArray<string> => {
  const write = writers(alarm.parameters);
  return block("VALARM", [
    write.required("ACTION", alarm.action),
    write.required("TRIGGER", alarm.trigger),
    write.optional("DURATION", alarm.duration),
    write.optionalNumber("REPEAT", alarm.repeat),
    write.optionalText("DESCRIPTION", alarm.description),
    write.optionalText("SUMMARY", alarm.summary),
    write.each("ATTENDEE", alarm.attendee),
    write.optional("ATTACH", alarm.attach),
  ]);
};

const encodeAlarms = (alarms: ReadonlyArray<Types.VAlarm> = []): ReadonlyArray<string> =>
  Arr.flatMap(alarms, encodeAlarm);

const encodeEvent = (event: Types.VEvent): ReadonlyArray<string> => {
  const write = writers(event.parameters);
  return block("VEVENT", [
    // DTSTART is required by RFC 5545.
    write.required("DTSTART", event.dtstart),
    write.optional("UID", event.uid),
    write.optional("DTSTAMP", event.dtstamp),
    write.optional("DTEND", event.dtend),
    write.optional("DURATION", event.duration),
    write.optionalText("SUMMARY", event.summary),
    write.optionalText("DESCRIPTION", event.description),
    write.optionalText("LOCATION", event.location),
    write.optional("ORGANIZER", event.organizer),
    write.each("ATTENDEE", event.attendee),
    write.textList("CATEGORIES", event.categories),
    write.optional("STATUS", event.status),
    write.optional("RRULE", event.rrule),
    write.each("RDATE", event.rdate),
    write.each("EXDATE", event.exdate),
    write.optional("URL", event.url),
    event.geo ? [formatContentLine("GEO", `${event.geo.lat};${event.geo.lon}`)] : [],
    write.optionalNumber("PRIORITY", event.priority),
    write.optional("CLASS", event.class),
    encodeAlarms(event.alarms),
  ]);
};

const encodeTodo = (todo: Types.VTodo): ReadonlyArray<string> => {
  const write = writers(todo.parameters);
  return block("VTODO", [
    write.optional("UID", todo.uid),
    write.optional("DTSTAMP", todo.dtstamp),
    write.optional("DTSTART", todo.dtstart),
    write.optional("DUE", todo.due),
    write.optional("DURATION", todo.duration),
    write.optionalText("SUMMARY", todo.summary),
    write.optionalText("DESCRIPTION", todo.description),
    write.optionalText("LOCATION", todo.location),
    write.optional("STATUS", todo.status),
    write.optionalNumber("PERCENT-COMPLETE", todo.percent),
    write.optional("COMPLETED", todo.completed),
    write.optionalNumber("PRIORITY", todo.priority),
    write.optional("RRULE", todo.rrule),
    encodeAlarms(todo.alarms),
  ]);
};

const encodeJournal = (journal: Types.VJournal): ReadonlyArray<string> => {
  const write = writers(journal.parameters);
  return block("VJOURNAL", [
    write.optional("UID", journal.uid),
    write.optional("DTSTAMP", journal.dtstamp),
    write.optional("DTSTART", journal.dtstart),
    write.optionalText("SUMMARY", journal.summary),
    write.optionalText("DESCRIPTION", journal.description),
    write.optional("STATUS", journal.status),
    write.optional("CLASS", journal.class),
  ]);
};

const encodeFreeBusy = (freebusy: Types.VFreeBusy): ReadonlyArray<string> => {
  const write = writers(freebusy.parameters);
  return block("VFREEBUSY", [
    write.optional("UID", freebusy.uid),
    write.optional("DTSTAMP", freebusy.dtstamp),
    // DTSTART and DTEND are required by RFC 5545.
    write.required("DTSTART", freebusy.dtstart),
    write.required("DTEND", freebusy.dtend),
    write.optional("ORGANIZER", freebusy.organizer),
    write.optional("URL", freebusy.url),
    write.each("ATTENDEE", freebusy.attendee),
    Arr.map(freebusy.freebusy ?? [], (entry) =>
      formatContentLine(
        "FREEBUSY",
        Arr.join(
          Arr.map(entry.periods, (period) => `${period.start}/${period.end}`),
          ",",
        ),
        entry.type ? [{ name: "FBTYPE", values: [entry.type] }] : [],
      ),
    ),
  ]);
};

const encodeObservance =
  (name: "STANDARD" | "DAYLIGHT") =>
  (observance: Types.Observance): ReadonlyArray<string> => {
    const write = writers(observance.parameters);
    return block(name, [
      write.required("DTSTART", observance.dtstart),
      write.required("TZOFFSETFROM", observance.tzoffsetfrom),
      write.required("TZOFFSETTO", observance.tzoffsetto),
      write.optional("RRULE", observance.rrule),
      write.optionalText("TZNAME", observance.tzname),
    ]);
  };

const encodeTimezone = (timezone: Types.VTimezone): ReadonlyArray<string> => {
  const write = writers(timezone.parameters);
  return block("VTIMEZONE", [
    // TZID is required by RFC 5545.
    write.required("TZID", timezone.tzid),
    write.optional("LAST-MODIFIED", timezone.lastmod),
    write.optional("TZURL", timezone.tzurl),
    Arr.flatMap(timezone.standard ?? [], encodeObservance("STANDARD")),
    Arr.flatMap(timezone.daylight ?? [], encodeObservance("DAYLIGHT")),
  ]);
};

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
  const write = writers(calendar.parameters);
  const lines = block("VCALENDAR", [
    write.required("VERSION", calendar.version),
    write.required("PRODID", calendar.prodid),
    write.optional("CALSCALE", calendar.calscale),
    write.optional("METHOD", calendar.method),
    write.optionalText("NAME", calendar.name),
    write.optionalText("DESCRIPTION", calendar.description),
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
