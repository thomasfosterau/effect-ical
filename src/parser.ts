/**
 * Parse iCalendar (RFC 5545) text into the plain {@link Types.VCalendar}
 * object model.
 *
 * The parser is a pure function returning a `Result` (`parseResult`), with an
 * `Effect` wrapper (`parse`) for use inside Effect programs. Content lines are
 * unfolded (RFC 5545 §3.1), property names are lower-cased into field names,
 * and `ATTENDEE`, `CATEGORIES`, `RDATE` and `EXDATE` collect into arrays.
 * Values are kept verbatim: text is not unescaped and dates are not decoded.
 *
 * @module
 */

import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import type * as Types from "./types.js";

/**
 * The parser's failure: the input is not a well-formed `VCALENDAR` (no
 * calendar, an unclosed calendar, a line without a `:`, or a missing or wrong
 * `VERSION` / `PRODID`). `message` says which.
 *
 * @category errors
 */
export class ParseError extends Schema.TaggedError<ParseError>()("ParseError", {
  message: Schema.String,
}) {}

/** One content line: `NAME[;PARAM=VALUE]*:VALUE`, with the name upper-cased. */
interface ContentLine {
  readonly name: string;
  readonly value: string;
}

/** A property value as the parser produces it. */
type PropertyValue = string | number | ReadonlyArray<string | number>;

/** A parsed component: its properties by field name, plus sub-component fields. */
type RawComponent = Readonly<Record<string, PropertyValue | ReadonlyArray<RawComponent>>>;

/** A parsed component, its direct children and the index of its `END` line. */
interface ParsedComponent {
  readonly component: RawComponent;
  readonly componentType: string;
  readonly children: ReadonlyArray<ParsedComponent>;
  readonly endIndex: number;
}

/** One step of the line scanner inside a component. */
type Step = Data.TaggedEnum<{
  Property: { readonly line: ContentLine };
  Child: { readonly parsed: ParsedComponent };
  Close: { readonly index: number };
  Fail: { readonly error: ParseError };
}>;

const Step = Data.taggedEnum<Step>();

const isContinuation = (line: string): boolean => line.startsWith(" ") || line.startsWith("\t");

/**
 * Unfold lines according to RFC 5545 §3.1: a line that starts with a space or
 * tab continues the previous non-empty line (minus that one whitespace
 * character). Empty lines are dropped; a continuation with nothing before it
 * stays a line of its own.
 */
const unfoldLines = (text: string): ReadonlyArray<string> => {
  const lines = Arr.filter(text.split(/\r?\n/), Str.isNonEmpty);
  const starts = Arr.filterMap(lines, (line, index) =>
    index === 0 || !isContinuation(line) ? Result.succeed(index) : Result.failVoid,
  );
  const ends = Arr.append(Arr.drop(starts, 1), lines.length);
  return Arr.map(Arr.zip(starts, ends), ([start, end]) =>
    Arr.join(
      Arr.map(lines.slice(start, end), (line, offset) => (offset === 0 ? line : line.slice(1))),
      "",
    ),
  );
};

/** Parse a content line into its upper-cased name and its value. */
const parseContentLine = (line: string): Result.Result<ContentLine, ParseError> => {
  const colonIndex = line.indexOf(":");
  return colonIndex === -1
    ? Result.fail(new ParseError({ message: `Invalid content line: ${line}` }))
    : Result.succeed({
        name: Str.toUpperCase(line.slice(0, colonIndex).split(";")[0] ?? ""),
        value: line.slice(colonIndex + 1),
      });
};

/** RFC property names whose field name is not simply the lower-cased name. */
const propertyNameMap: Readonly<Record<string, string>> = {
  "PERCENT-COMPLETE": "percent",
  "LAST-MODIFIED": "lastmod",
};

/** Properties whose value is parsed as an integer (kept as text if it is not one). */
const numericProperties = [
  "PERCENT",
  "PERCENT-COMPLETE",
  "PRIORITY",
  "REPEAT",
  "SEQUENCE",
] as const;

/** Properties that may repeat, collected into an array in order. */
const arrayProperties = ["ATTENDEE", "CATEGORIES", "RDATE", "EXDATE"] as const;

const isOneOf =
  (names: ReadonlyArray<string>) =>
  (name: string): boolean =>
    Arr.contains(names, name);

const isNumericProperty = isOneOf(numericProperties);
const isArrayProperty = isOneOf(arrayProperties);

const fieldName = (name: string): string =>
  Option.getOrElse(Record.get(propertyNameMap, name), () => name.toLowerCase());

const propertyValue = (name: string, value: string): string | number => {
  if (!isNumericProperty(name)) {
    return value;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? value : parsed;
};

/**
 * Collect a component's property lines into fields: the last occurrence of a
 * single-valued property wins; repeatable ones collect into arrays in order.
 */
const collectProperties = (lines: ReadonlyArray<ContentLine>): Record<string, PropertyValue> => {
  const [repeated, single] = Arr.partition(lines, (line) =>
    isArrayProperty(line.name) ? Result.succeed(line) : Result.fail(line),
  );
  const singles = Record.fromEntries(
    Arr.map(single, ({ name, value }) => [fieldName(name), propertyValue(name, value)] as const),
  );
  const groups = Arr.groupBy(repeated, ({ name }) => fieldName(name));
  return {
    ...singles,
    ...Record.map(groups, (group) =>
      Arr.map(group, ({ name, value }) => propertyValue(name, value)),
    ),
  };
};

const ofType =
  (children: ReadonlyArray<ParsedComponent>) =>
  (componentType: string): ReadonlyArray<RawComponent> =>
    Arr.filterMap(children, (child) =>
      child.componentType === componentType ? Result.succeed(child.component) : Result.failVoid,
    );

/** The sub-component fields a component type carries, when any are present. */
const subComponentFields = (
  componentType: string,
  children: ReadonlyArray<ParsedComponent>,
): Record<string, ReadonlyArray<RawComponent>> => {
  const children_ = ofType(children);
  const fields: ReadonlyArray<readonly [string, string]> =
    componentType === "VEVENT" || componentType === "VTODO"
      ? [["alarms", "VALARM"]]
      : componentType === "VTIMEZONE"
        ? [
            ["standard", "STANDARD"],
            ["daylight", "DAYLIGHT"],
          ]
        : [];
  return Record.fromEntries(
    Arr.filterMap(fields, ([field, type]) => {
      const matching = children_(type);
      return Arr.isReadonlyArrayNonEmpty(matching)
        ? Result.succeed([field, matching] as const)
        : Result.failVoid;
    }),
  );
};

/** The `Child` steps' components, in order. */
const childrenOf = (steps: ReadonlyArray<Step>): ReadonlyArray<ParsedComponent> =>
  Arr.filterMap(steps, (step) =>
    Step.$is("Child")(step) ? Result.succeed(step.parsed) : Result.failVoid,
  );

/** The `Property` steps' lines, in order. */
const propertiesOf = (steps: ReadonlyArray<Step>): ReadonlyArray<ContentLine> =>
  Arr.filterMap(steps, (step) =>
    Step.$is("Property")(step) ? Result.succeed(step.line) : Result.failVoid,
  );

/**
 * Parse the component whose `BEGIN:<componentType>` line is at `beginIndex`.
 *
 * Scans forward until the matching `END`. A nested `BEGIN` parses as a child;
 * a child that fails (for instance because it is never closed) is skipped and
 * its lines are scanned again as this component's own. A line without a `:`
 * fails the component; reaching the end of the input fails it as unclosed.
 */
const parseComponent = (
  lines: ReadonlyArray<string>,
  beginIndex: number,
  componentType: string,
): Result.Result<ParsedComponent, ParseError> => {
  const stepAt = (index: number): readonly [ReadonlyArray<Step>, Option.Option<number>] => {
    const line = lines[index];
    if (line === undefined) {
      return [
        [
          Step.Fail({
            error: new ParseError({ message: `Component ${componentType} not closed` }),
          }),
        ],
        Option.none(),
      ];
    }
    return Result.match(parseContentLine(line), {
      onFailure: (error) => [
        [
          Step.Fail({
            error: new ParseError({
              message: `Error parsing content line at index ${index}: ${error.message}`,
            }),
          }),
        ],
        Option.none(),
      ],
      onSuccess: (content) => {
        if (content.name === "END" && content.value === componentType) {
          return [[Step.Close({ index })], Option.none()];
        }
        if (content.name === "BEGIN") {
          return Result.match(parseComponent(lines, index, content.value), {
            onFailure: () => [[], Option.some(index + 1)],
            onSuccess: (parsed) => [[Step.Child({ parsed })], Option.some(parsed.endIndex + 1)],
          });
        }
        return [[Step.Property({ line: content })], Option.some(index + 1)];
      },
    });
  };

  const steps = Arr.flatten(
    Arr.unfold(Option.some(beginIndex + 1), (cursor) => Option.map(cursor, stepAt)),
  );

  return Step.$match(
    Option.getOrElse(Arr.last(steps), () =>
      Step.Fail({ error: new ParseError({ message: `Component ${componentType} not closed` }) }),
    ),
    {
      Fail: ({ error }) => Result.fail(error),
      Property: () =>
        Result.fail(new ParseError({ message: `Component ${componentType} not closed` })),
      Child: () =>
        Result.fail(new ParseError({ message: `Component ${componentType} not closed` })),
      Close: ({ index }) => {
        const children = childrenOf(steps);
        return Result.succeed({
          component: {
            ...collectProperties(propertiesOf(steps)),
            component: componentType,
            ...subComponentFields(componentType, children),
          },
          componentType,
          children,
          endIndex: index,
        });
      },
    },
  );
};

const isCalendarBegin = (line: string): boolean =>
  Result.match(parseContentLine(line), {
    onFailure: () => false,
    onSuccess: ({ name, value }) => name === "BEGIN" && value === "VCALENDAR",
  });

/**
 * Validate the parsed `VCALENDAR` and sort its children into the
 * {@link Types.VCalendar} component lists.
 */
const toCalendar = ({ component: calendar, children }: ParsedComponent) => {
  const version = calendar["version"];
  const prodid = calendar["prodid"];
  if (!version) {
    return Result.fail(new ParseError({ message: "VERSION property is required" }));
  }
  if (version !== "2.0") {
    return Result.fail(
      new ParseError({ message: `VERSION must be "2.0", got "${String(version)}"` }),
    );
  }
  if (!prodid || !Predicate.isString(prodid)) {
    return Result.fail(new ParseError({ message: "PRODID property is required" }));
  }
  const of = ofType(children);
  const properties = Record.filter(
    {
      calscale: calendar["calscale"],
      method: calendar["method"],
      name: calendar["name"],
      description: calendar["description"],
    },
    Predicate.isNotUndefined,
  );
  const components = Record.filter(
    {
      timezones: of("VTIMEZONE"),
      events: of("VEVENT"),
      todos: of("VTODO"),
      journals: of("VJOURNAL"),
      freebusys: of("VFREEBUSY"),
    },
    Arr.isReadonlyArrayNonEmpty,
  );
  // SAFETY: the parser does not validate component contents; it keeps every
  // property value verbatim (a CALSCALE other than GREGORIAN, an event without
  // DTSTART) and sorts components by their `BEGIN` type, as it always has.
  return Result.succeed({
    component: "VCALENDAR",
    prodid,
    version,
    ...properties,
    ...components,
  } as Types.VCalendar);
};

/**
 * Parse an iCalendar string into a {@link Types.VCalendar}, synchronously.
 *
 * Text before the first `BEGIN:VCALENDAR` and after its `END:VCALENDAR` is
 * ignored. Components of an unknown type parse but are not kept.
 *
 * @example
 * ```ts
 * import { parseResult } from "@thomasfosterau/effect-ical"
 * import * as Result from "effect/Result"
 *
 * const result = parseResult("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Example//EN\r\nEND:VCALENDAR\r\n")
 * if (Result.isSuccess(result)) {
 *   console.log(result.success.prodid) // "-//Example//EN"
 * }
 * ```
 *
 * @category parsing
 */
export const parseResult = (icalString: string): Result.Result<Types.VCalendar, ParseError> => {
  const lines = unfoldLines(icalString);
  return Option.match(Arr.findFirstIndex(lines, isCalendarBegin), {
    onNone: () => Result.fail(new ParseError({ message: "No VCALENDAR component found" })),
    onSome: (start) => Result.flatMap(parseComponent(lines, start, "VCALENDAR"), toCalendar),
  });
};

/**
 * Parse an iCalendar string into a {@link Types.VCalendar}, failing with a
 * {@link ParseError}. The parse runs when the Effect runs.
 *
 * @example
 * ```ts
 * import { parse } from "@thomasfosterau/effect-ical"
 * import * as Effect from "effect/Effect"
 *
 * const program = parse("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Example//EN\r\nEND:VCALENDAR\r\n")
 * const calendar = await Effect.runPromise(program)
 * ```
 *
 * @category parsing
 */
export const parse = (icalString: string): Effect.Effect<Types.VCalendar, ParseError> =>
  Effect.suspend(() => Effect.fromResult(parseResult(icalString)));
