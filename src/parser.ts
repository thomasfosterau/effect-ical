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
 * verbatim: dates, durations and recurrence rules are not decoded. Parameters
 * of the typed fields (`DTSTART;TZID=…`, `ATTENDEE;CN=…`) are kept in each
 * component's `parameters` (see {@link Types.FieldParameters}).
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
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import * as ContentLine from "./ContentLine.js";
import { fieldName, isArrayProperty, isTypedProperty } from "./properties.js";
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

/**
 * One content line: `NAME[;PARAM=VALUE]*:VALUE`, with the name upper-cased
 * (and prefixed by its group, if it has one) and its parameters in order.
 */
interface NameValue {
  readonly name: string;
  readonly parameters: ReadonlyArray<ContentLine.Parameter>;
  readonly value: string;
}

/** A property value as the parser produces it. */
type PropertyValue = string | number | ReadonlyArray<string | number>;

/** One field of a parsed component: a property, a sub-component list or `parameters`. */
type FieldValue = PropertyValue | ReadonlyArray<RawComponent> | Types.FieldParameters;

/**
 * A parsed component: its properties by field name, plus sub-component fields
 * and `parameters`.
 */
interface RawComponent {
  readonly [field: string]: FieldValue;
}

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
 * A content line as this parser read it before it kept parameters: the name
 * is the text before the first `;` or `:`, the parameters (everything up to
 * the first `:`, quoted or not) are skipped, and the value is the rest. It is
 * the fallback for a line `ContentLine.parse` rejects (an unterminated quote,
 * a name with characters RFC 5545 does not allow), so the parser accepts
 * exactly the lines it always has; such a line keeps no parameters.
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

/** A line without its parameters, read by {@link nameAndValue}. */
const parseLegacyLine = (line: string): Result.Result<NameValue, ParseError> =>
  Result.mapBoth(Parser.parse(nameAndValue, line), {
    onFailure: () => new ParseError({ message: `Invalid content line: ${line}` }),
    onSuccess: ({ name, value }) => ({ name: Str.toUpperCase(name), parameters: [], value }),
  });

/**
 * Parse a content line into its upper-cased name, its parameters and its
 * value: with `ContentLine.parse` (so a quoted `:` in a parameter value stays
 * in the parameter), falling back to {@link parseLegacyLine}.
 */
const parseContentLine = (line: string): Result.Result<NameValue, ParseError> =>
  Result.match(ContentLine.parse(line), {
    onFailure: () => parseLegacyLine(line),
    onSuccess: (content) =>
      Result.succeed({
        name: Str.toUpperCase(
          content.group === undefined ? content.name : `${content.group}.${content.name}`,
        ),
        parameters: content.parameters,
        value: content.value,
      }),
  });

/** Properties whose value is parsed as an integer (kept as text if it is not one). */
const numericProperties = [
  "PERCENT",
  "PERCENT-COMPLETE",
  "PRIORITY",
  "REPEAT",
  "SEQUENCE",
] as const;

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
const isTextProperty = isOneOf(textProperties);
const isTextListProperty = isOneOf(textListProperties);

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
 * The parameters of a component's typed property lines, by field (see
 * {@link Types.FieldParameters}): the kept line's for a single-valued
 * property, every line's for a repeatable one, and only the fields where some
 * line carried parameters.
 */
const fieldParameters = (
  componentType: string,
  lines: ReadonlyArray<NameValue>,
): Types.FieldParameters =>
  R.filter(
    R.map(
      Arr.groupBy(
        Arr.filter(lines, ({ name }) => isTypedProperty(componentType)(name)),
        ({ name }) => fieldName(name),
      ),
      (group): ReadonlyArray<ReadonlyArray<ContentLine.Parameter>> =>
        isArrayProperty(group[0].name)
          ? Arr.map(group, ({ parameters }) => parameters)
          : [Arr.lastNonEmpty(group).parameters],
    ),
    (lists) => Arr.some(lists, Arr.isReadonlyArrayNonEmpty),
  );

/**
 * Collect a component's property lines into fields: the last occurrence of a
 * single-valued property wins; repeatable ones collect into arrays in order.
 * `parameters` is set when some line carried parameters.
 */
const collectProperties = (componentType: string, lines: ReadonlyArray<NameValue>) => {
  const [repeated, single] = Arr.partition(lines, (line) =>
    isArrayProperty(line.name) ? Result.succeed(line) : Result.fail(line),
  );
  const singles = R.fromEntries(
    Arr.map(single, ({ name, value }) => [fieldName(name), propertyValue(name, value)] as const),
  );
  const groups = Arr.groupBy(repeated, ({ name }) => fieldName(name));
  const parameters = fieldParameters(componentType, lines);
  return {
    ...singles,
    ...R.map(groups, (group) =>
      Arr.flatMap(group, ({ name, value }) =>
        isTextListProperty(name)
          ? Arr.map(ContentLine.splitValue(value, ","), ContentLine.unescapeText)
          : [propertyValue(name, value)],
      ),
    ),
    ...R.getSomes({
      parameters: R.isEmptyRecord(parameters) ? Option.none() : Option.some(parameters),
    }),
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
  return R.fromEntries(
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
            ...collectProperties(componentType, propertiesOf(steps)),
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
 * A raw `VERSION` field as text, the way `String()` renders a property
 * value. `VERSION` is single-valued, so it is always a string or a number;
 * anything else (unreachable from parsed text) renders as a placeholder.
 */
const describeField = (value: FieldValue): string =>
  P.isString(value) || P.isNumber(value) ? String(value) : "[component]";

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
  if (!prodid || !P.isString(prodid)) {
    return Result.fail(new ParseError({ message: "PRODID property is required" }));
  }
  const of = ofType(children);
  const properties = R.filter(
    {
      calscale: calendar["calscale"],
      method: calendar["method"],
      name: calendar["name"],
      description: calendar["description"],
      parameters: calendar["parameters"],
    },
    P.isNotUndefined,
  );
  const components = R.filter(
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
