/**
 * Parse iCalendar (RFC 5545) text into the plain {@link Types.VCalendar}
 * object model.
 *
 * The parser is a pure function returning a `Result` (`parseResult`), with an
 * `Effect` wrapper (`parse`) for use inside Effect programs. Content lines are
 * unfolded (RFC 5545 §3.1), property names are lower-cased into field names,
 * and `ATTENDEE`, `CATEGORIES`, `RDATE` and `EXDATE` collect into arrays.
 * TEXT values (`SUMMARY`, `DESCRIPTION`, `LOCATION`, `COMMENT`, `CONTACT`,
 * `NAME`, `TZNAME`, `X-WR-CALNAME`, `X-WR-CALDESC`) are unescaped, and each
 * `CATEGORIES` line splits at its unescaped commas. Other values are kept
 * verbatim: dates, durations and recurrence rules are not decoded.
 *
 * @module
 */

import * as Ascii from "@thomasfosterau/effect-parse/Ascii";
import * as Compiler from "@thomasfosterau/effect-parse/Compiler";
import * as Parser from "@thomasfosterau/effect-parse/Parser";
import * as Token from "@thomasfosterau/effect-parse/Token";
import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import * as ContentLine from "./ContentLine.js";
import type * as Types from "./types.js";

/**
 * The parser's failure: the input is not a well-formed `VCALENDAR` (no
 * calendar, an unclosed calendar, a line without a `:`, or a missing or wrong
 * `VERSION` / `PRODID`). `message` says which.
 *
 * When the failure belongs to one content line, `line` and `column` (both
 * 1-based) locate where that line starts in the input: the line without a
 * `:`, or the `BEGIN` line of a component that is never closed. Lines are
 * counted at each `\n`, as the parser splits them.
 *
 * @category errors
 */
export class ParseError extends Schema.TaggedError<ParseError, { readonly brand: unique symbol }>()(
  "ParseError",
  {
    message: Schema.String,
    line: Schema.optional(Schema.Int),
    column: Schema.optional(Schema.Int),
  },
) {}

/** A 1-based line and column in the input. */
type Position = ContentLine.Position;

/** One content line: `NAME[;PARAM=VALUE]*:VALUE`, with the name upper-cased. */
interface NameValue {
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
  Property: { readonly line: NameValue };
  Child: { readonly parsed: ParsedComponent };
  Close: { readonly index: number };
  Fail: { readonly error: ParseError };
}>;

const Step = Data.taggedEnum<Step>();

/** One unfolded content line and the offset where it starts in the input. */
type Line = ContentLine.UnfoldedLine;

/**
 * A content line as this parser has always read it: the name is the text
 * before the first `;` or `:`, the parameters (everything up to the first
 * `:`, quoted or not) are skipped, and the value is the rest. Unlike
 * `ContentLine.parse`, a quoted `:` in a parameter ends the parameters, as
 * the golden corpus pins (keeping parameters is #22).
 */
const nameAndValue = /*#__PURE__*/ Compiler.jit(
  /*#__PURE__*/ Parser.struct({
    name: /*#__PURE__*/ Parser.terminated(
      /*#__PURE__*/ Token.takeTill(";:"),
      /*#__PURE__*/ Token.takeTill(":"),
    ),
    value: /*#__PURE__*/ Parser.preceded(/*#__PURE__*/ Token.literal(":"), Token.rest),
  }),
);

/** Parse a content line into its upper-cased name and its value. */
const parseContentLine = (line: string): Result.Result<NameValue, ParseError> =>
  Result.mapBoth(Parser.parse(nameAndValue, line), {
    onFailure: () => new ParseError({ message: `Invalid content line: ${line}` }),
    onSuccess: ({ name, value }) => ({ name: Str.toUpperCase(name), value }),
  });

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

/** TEXT properties (RFC 5545 §3.3.11) whose value is unescaped. */
const textProperties = [
  "SUMMARY",
  "DESCRIPTION",
  "LOCATION",
  "COMMENT",
  "CONTACT",
  "NAME",
  "TZNAME",
  "X-WR-CALNAME",
  "X-WR-CALDESC",
] as const;

/** TEXT-list properties: split at unescaped commas, then each item unescaped. */
const textListProperties = ["CATEGORIES"] as const;

const isNumericProperty = isOneOf(numericProperties);
const isArrayProperty = isOneOf(arrayProperties);
const isTextProperty = isOneOf(textProperties);
const isTextListProperty = isOneOf(textListProperties);

const fieldName = (name: string): string =>
  Option.getOrElse(Record.get(propertyNameMap, name), () => name.toLowerCase());

/**
 * The integer a numeric property's value starts with, read as
 * `Number.parseInt` always read it: leading whitespace skipped, an optional
 * sign, digits, and anything after them ignored.
 */
const leadingInteger = /*#__PURE__*/ Compiler.jit(
  /*#__PURE__*/ Parser.delimited(
    /*#__PURE__*/ Token.takeWhile((char: string) => char.trim() === ""),
    Ascii.decInt,
    Token.rest,
  ),
);

const propertyValue = (name: string, value: string): string | number =>
  isTextProperty(name)
    ? ContentLine.unescapeText(value)
    : isNumericProperty(name)
      ? Result.getOrElse(Parser.parse(leadingInteger, value), (): string | number => value)
      : value;

/**
 * Collect a component's property lines into fields: the last occurrence of a
 * single-valued property wins; repeatable ones collect into arrays in order.
 */
const collectProperties = (lines: ReadonlyArray<NameValue>): Record<string, PropertyValue> => {
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
      Arr.flatMap(group, ({ name, value }) =>
        isTextListProperty(name)
          ? Arr.map(ContentLine.splitValue(value, ","), ContentLine.unescapeText)
          : [propertyValue(name, value)],
      ),
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
const propertiesOf = (steps: ReadonlyArray<Step>): ReadonlyArray<NameValue> =>
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
 * `positionAt` locates a line's offset for the error.
 */
const parseComponent = (
  lines: ReadonlyArray<Line>,
  beginIndex: number,
  componentType: string,
  positionAt: (offset: number) => Position,
): Result.Result<ParsedComponent, ParseError> => {
  const notClosed = (): ParseError =>
    new ParseError({
      message: `Component ${componentType} not closed`,
      ...Option.match(Option.fromUndefinedOr(lines[beginIndex]), {
        onNone: () => ({}),
        onSome: ({ offset }) => positionAt(offset),
      }),
    });
  const stepAt = (index: number): readonly [ReadonlyArray<Step>, Option.Option<number>] => {
    const line = lines[index];
    if (line === undefined) {
      return [[Step.Fail({ error: notClosed() })], Option.none()];
    }
    return Result.match(parseContentLine(line.text), {
      onFailure: (error) => [
        [
          Step.Fail({
            error: new ParseError({
              message: `Error parsing content line at index ${index}: ${error.message}`,
              ...positionAt(line.offset),
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
          return Result.match(parseComponent(lines, index, content.value, positionAt), {
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
    Option.getOrElse(Arr.last(steps), () => Step.Fail({ error: notClosed() })),
    {
      Fail: ({ error }) => Result.fail(error),
      Property: () => Result.fail(notClosed()),
      Child: () => Result.fail(notClosed()),
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

const isCalendarBegin = (line: Line): boolean =>
  Result.match(parseContentLine(line.text), {
    onFailure: () => false,
    onSuccess: ({ name, value }) => name === "BEGIN" && value === "VCALENDAR",
  });

/**
 * A raw field as text, the way `String()` renders a property value (a
 * repeated property's values joined by `,`). A sub-component list never sits
 * under a property's field name, so it renders as a placeholder.
 */
const describeField = (value: PropertyValue | ReadonlyArray<RawComponent>): string =>
  Predicate.isString(value) || Predicate.isNumber(value)
    ? String(value)
    : Arr.join(
        Arr.map(value, (item: string | number | RawComponent) =>
          Predicate.isString(item) || Predicate.isNumber(item) ? String(item) : "[component]",
        ),
        ",",
      );

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
      new ParseError({ message: `VERSION must be "2.0", got "${describeField(version)}"` }),
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
  // The parser does not validate component contents; it keeps every property
  // value verbatim (a CALSCALE other than GREGORIAN, an event without DTSTART)
  // and sorts components by their `BEGIN` type, as it always has.
  return Result.succeed<Types.VCalendar>({
    component: "VCALENDAR",
    prodid,
    version,
    ...properties,
    ...components,
  });
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
  const lines = ContentLine.unfold(icalString);
  return Option.match(Arr.findFirstIndex(lines, isCalendarBegin), {
    onNone: () => Result.fail(new ParseError({ message: "No VCALENDAR component found" })),
    onSome: (start) =>
      Result.flatMap(
        parseComponent(lines, start, "VCALENDAR", (offset) =>
          ContentLine.positionOf(icalString, offset),
        ),
        toCalendar,
      ),
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
