/**
 * Pipeable constructors, setters and a codec for iCalendar `VCALENDAR`
 * objects, as an Effect Schema class.
 *
 * Start from `Calendar.builder()` (or `Calendar.make(prodid)`), pipe setters
 * (`Calendar.withName`, `Calendar.withEvent`, …) and finish with
 * `Calendar.build`. `Calendar.encode` renders the calendar with its events
 * and to-dos; `Calendar.decode` reads back its top-level properties.
 *
 * @module
 */

// The barrel re-exports this module only as a namespace (`export * as Calendar`),
// so its setter and `encode` names never collide with a sibling module's.
// fallow-ignore-file duplicate-export
import * as Compiler from "@thomasfosterau/effect-parse/Compiler";
import * as Parser from "@thomasfosterau/effect-parse/Parser";
import * as Token from "@thomasfosterau/effect-parse/Token";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { Event } from "./Event.js";
import { ParseError } from "./parser.js";
import { Todo } from "./Todo.js";

/**
 * A `VCALENDAR` object: its top-level properties and its components.
 *
 * `events` and `todos` hold {@link Event} and {@link Todo} values; the other
 * component lists are carried untyped and are not written by `encode`.
 *
 * @category models
 */
export class Calendar extends Schema.Class<Calendar, { readonly brand: unique symbol }>("Calendar")(
  {
    component: Schema.Literal("VCALENDAR"),
    version: Schema.Literal("2.0"),
    prodid: Schema.String,
    calscale: Schema.optional(Schema.Literal("GREGORIAN")),
    method: Schema.optional(Schema.String),
    name: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
    events: Schema.optional(Schema.Array(Event)),
    todos: Schema.optional(Schema.Array(Todo)),
    journals: Schema.optional(Schema.Array(Schema.Any)),
    freebusys: Schema.optional(Schema.Array(Schema.Any)),
    timezones: Schema.optional(Schema.Array(Schema.Any)),
  },
) {}

/**
 * Create a calendar with `version` 2.0 and the given product identifier (`PRODID`).
 */
export const make = (prodid: string): Calendar => {
  return new Calendar({
    component: "VCALENDAR",
    version: "2.0",
    prodid,
  });
};

/**
 * The value the pipeable `with*` setters thread through: a calendar under construction.
 */
export interface Builder {
  readonly calendar: Calendar;
}

/**
 * Start a calendar pipeline, with the placeholder product identifier `-//effect-ical//EN`.
 */
export const builder = (): Builder => ({
  calendar: make("-//effect-ical//EN"),
});

/**
 * Set the calendar's product identifier (`PRODID`).
 */
export const withProdid =
  (prodid: string) =>
  (builder: Builder): Builder => ({
    ...builder,
    calendar: new Calendar({ ...builder.calendar, prodid }),
  });

/**
 * Set the calendar's display name (`NAME`).
 */
export const withName =
  (name: string) =>
  (builder: Builder): Builder => ({
    ...builder,
    calendar: new Calendar({ ...builder.calendar, name }),
  });

/**
 * Set the calendar's description (`DESCRIPTION`).
 */
export const withDescription =
  (description: string) =>
  (builder: Builder): Builder => ({
    ...builder,
    calendar: new Calendar({ ...builder.calendar, description }),
  });

/**
 * Set the calendar scale (`CALSCALE`); RFC 5545 defines only `GREGORIAN`.
 */
export const withCalscale =
  (calscale: "GREGORIAN") =>
  (builder: Builder): Builder => ({
    ...builder,
    calendar: new Calendar({ ...builder.calendar, calscale }),
  });

/**
 * Set the iTIP method (`METHOD`), such as `PUBLISH` or `REQUEST`.
 */
export const withMethod =
  (method: string) =>
  (builder: Builder): Builder => ({
    ...builder,
    calendar: new Calendar({ ...builder.calendar, method }),
  });

/**
 * Append an event to the calendar's `events`.
 */
export const withEvent =
  (event: Event) =>
  (builder: Builder): Builder => ({
    ...builder,
    calendar: new Calendar({
      ...builder.calendar,
      events: [...(builder.calendar.events || []), event],
    }),
  });

/**
 * Append a to-do to the calendar's `todos`.
 */
export const withTodo =
  (todo: Todo) =>
  (builder: Builder): Builder => ({
    ...builder,
    calendar: new Calendar({
      ...builder.calendar,
      todos: [...(builder.calendar.todos || []), todo],
    }),
  });

/**
 * Finish a calendar pipeline, returning the calendar.
 */
export const build = (builder: Builder): Calendar => builder.calendar;

/**
 * Render a calendar as iCalendar text: its top-level properties, then each
 * event (`DTSTART`, `UID`, `SUMMARY`, `DTEND`, `DESCRIPTION`, `LOCATION`,
 * `STATUS`) and each to-do (`UID`, `SUMMARY`, `DTSTART`, `DUE`, `STATUS`,
 * `PERCENT-COMPLETE`), with CRLF line endings.
 *
 * A compact rendering: values are written verbatim (no escaping or line
 * folding) and other event and to-do properties are not written. For the
 * complete RFC 5545 encoder, use `encode` from the package root on a
 * `VCalendar`.
 *
 * @category encoding
 */
export const encode = (calendar: Calendar): Effect.Effect<string> =>
  Effect.sync(() => {
    const lines = [
      "BEGIN:VCALENDAR",
      `VERSION:${calendar.version}`,
      `PRODID:${calendar.prodid}`,
      ...(calendar.calscale ? [`CALSCALE:${calendar.calscale}`] : []),
      ...(calendar.method ? [`METHOD:${calendar.method}`] : []),
      ...(calendar.name ? [`NAME:${calendar.name}`] : []),
      ...(calendar.description ? [`DESCRIPTION:${calendar.description}`] : []),
      ...Arr.flatMap(calendar.events ?? [], (event) => [
        "BEGIN:VEVENT",
        `DTSTART:${event.dtstart || ""}`,
        ...(event.uid ? [`UID:${event.uid}`] : []),
        ...(event.summary ? [`SUMMARY:${event.summary}`] : []),
        ...(event.dtend ? [`DTEND:${event.dtend}`] : []),
        ...(event.description ? [`DESCRIPTION:${event.description}`] : []),
        ...(event.location ? [`LOCATION:${event.location}`] : []),
        ...(event.status ? [`STATUS:${event.status}`] : []),
        "END:VEVENT",
      ]),
      ...Arr.flatMap(calendar.todos ?? [], (todo) => [
        "BEGIN:VTODO",
        ...(todo.uid ? [`UID:${todo.uid}`] : []),
        ...(todo.summary ? [`SUMMARY:${todo.summary}`] : []),
        ...(todo.dtstart ? [`DTSTART:${todo.dtstart}`] : []),
        ...(todo.due ? [`DUE:${todo.due}`] : []),
        ...(todo.status ? [`STATUS:${todo.status}`] : []),
        ...(todo.percent === undefined ? [] : [`PERCENT-COMPLETE:${todo.percent}`]),
        "END:VTODO",
      ]),
      "END:VCALENDAR",
    ];
    return Arr.join(lines, "\r\n") + "\r\n";
  });

/** The top-level calendar properties `decode` reads. */
const decodedProperties = [
  "PRODID",
  "VERSION",
  "NAME",
  "DESCRIPTION",
  "CALSCALE",
  "METHOD",
] as const;

/** Text up to a line ending; a lone `CR` is content. */
const lineText = (stop: string) =>
  Parser.fold(
    Parser.alt(
      Token.takeTill(`${stop}\r\n`, { min: 1 }),
      Parser.terminated(Token.literal("\r"), Parser.not(Token.literal("\n"))),
    ),
    { init: () => "", f: (text: string, chunk: string) => text + chunk },
  );

/**
 * The physical lines of a text (split at `\r\n` or `\n`, not unfolded), each
 * as the key before its first `:` and, when it has one, the value after it.
 */
const keyValueLines = /*#__PURE__*/ Compiler.jit(
  /*#__PURE__*/ Parser.separated(
    /*#__PURE__*/ Parser.struct({
      key: /*#__PURE__*/ lineText(":"),
      value: /*#__PURE__*/ Parser.opt(
        /*#__PURE__*/ Parser.preceded(/*#__PURE__*/ Token.literal(":"), /*#__PURE__*/ lineText("")),
      ),
    }),
    /*#__PURE__*/ Parser.alt(
      /*#__PURE__*/ Token.literal("\r\n"),
      /*#__PURE__*/ Token.literal("\n"),
    ),
  ),
);

/**
 * Read a calendar's top-level properties (`PRODID`, `VERSION`, `NAME`,
 * `DESCRIPTION`, `CALSCALE`, `METHOD`) from iCalendar text, failing with a
 * `ParseError` when `PRODID` is missing or `VERSION` is not `2.0`.
 *
 * A shallow reader: it does not unfold lines or descend into components, so
 * the returned calendar has no events or to-dos, and a property line inside a
 * component counts as the calendar's own (the last occurrence wins). For a
 * full parse, use `parse` from the package root.
 *
 * @category decoding
 */
export const decode = (icalString: string): Effect.Effect<Calendar, ParseError> =>
  Effect.suspend(() => {
    const properties = Record.fromEntries(
      Arr.filterMap(
        Result.getOrElse(Parser.parse(keyValueLines, icalString), () => []),
        ({ key, value }) =>
          Arr.contains(decodedProperties, key)
            ? Result.succeed([key, Option.getOrElse(value, () => "")] as const)
            : Result.failVoid,
      ),
    );
    const property = (key: (typeof decodedProperties)[number]) => Record.get(properties, key);
    const prodid = Option.getOrElse(property("PRODID"), () => "");
    const version = Option.getOrElse(property("VERSION"), () => "2.0");
    if (!prodid) {
      return Effect.fail(new ParseError({ message: "PRODID is required" }));
    }
    if (version !== "2.0") {
      return Effect.fail(new ParseError({ message: "VERSION must be 2.0" }));
    }
    // Decoding (not `new Calendar`) because CALSCALE is read as free text: a
    // value other than GREGORIAN is a defect, as it always has been.
    return Effect.orDie(
      Schema.decodeUnknownEffect(Calendar)({
        component: "VCALENDAR",
        version,
        prodid,
        calscale: Option.getOrUndefined(property("CALSCALE")),
        method: Option.getOrUndefined(property("METHOD")),
        name: Option.getOrUndefined(property("NAME")),
        description: Option.getOrUndefined(property("DESCRIPTION")),
      }),
    );
  });
