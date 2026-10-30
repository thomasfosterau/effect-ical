/**
 * Content lines, the syntax iCalendar (RFC 5545 §3.1) and vCard (RFC 6350
 * §3.3) share: `[group "."] name *(";" param) ":" value`, folded at 75
 * octets.
 *
 * This module knows nothing about calendars or cards. It unfolds text into
 * lines, parses a line into its group, name, parameters and value, formats
 * and folds a line back, and escapes or splits TEXT values. Parameter values
 * may be quoted (`CN="Doe, Jane"`) and use RFC 6868 caret encoding (`^n`,
 * `^'`, `^^`).
 *
 * @module
 */

// The barrel re-exports this module only as a namespace (`export * as ContentLine`),
// so its `parse` and `format` names never collide with a sibling module's.
// fallow-ignore-file duplicate-export
import * as Compiler from "@thomasfosterau/effect-parse/Compiler";
import * as Parser from "@thomasfosterau/effect-parse/Parser";
import * as Token from "@thomasfosterau/effect-parse/Token";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

/**
 * A property parameter: its upper-cased name and its values, in order.
 *
 * A parameter written without `=` (vCard 2.1's bare `TEL;HOME:…`) has no
 * values; `X=` has one empty value.
 *
 * @category models
 */
export interface Parameter {
  readonly name: string;
  readonly values: ReadonlyArray<string>;
}

/**
 * One parsed content line: an optional group (vCard's `item1.EMAIL`), the
 * upper-cased property name, its parameters in order, and the raw value.
 *
 * The value is kept verbatim: TEXT escapes are not decoded (see
 * {@link unescapeText}). Parameter values are unquoted and caret-decoded.
 *
 * @category models
 */
export interface ContentLine {
  readonly group?: string;
  readonly name: string;
  readonly parameters: ReadonlyArray<Parameter>;
  readonly value: string;
}

/**
 * One unfolded line of the input and the offset where it starts.
 *
 * @category models
 */
export interface UnfoldedLine {
  readonly text: string;
  readonly offset: number;
}

/**
 * A 1-based line and column in the input.
 *
 * @category models
 */
export interface Position {
  readonly line: number;
  readonly column: number;
}

/**
 * A content line could not be parsed: it has no `:` outside a quoted
 * parameter value, no name, or an unterminated quoted value.
 *
 * `line` and `column` (both 1-based) locate where the failing line starts in
 * the input when the error comes from {@link parseAll}.
 *
 * @category errors
 */
export class ContentLineError extends Schema.TaggedError<
  ContentLineError,
  { readonly brand: unique symbol }
>()("ContentLineError", {
  message: Schema.String,
  line: Schema.optional(Schema.Int),
  column: Schema.optional(Schema.Int),
}) {}

// ---------------------------------------------------------------------------
// Unfolding
// ---------------------------------------------------------------------------

/** A line ending: `CRLF` or a bare `LF` (a lone `CR` is line content). */
const eol = /*#__PURE__*/ Parser.alt(Token.literal("\r\n"), Token.literal("\n"));

/** One or more line endings: empty lines are dropped. */
const eols = /*#__PURE__*/ Parser.repeat(eol, { min: 1 });

/**
 * A fold: line endings followed by a space or tab, removed from the value.
 * The empty lines it skips are dropped, so a continuation joins the previous
 * non-empty line.
 */
const foldMarker = /*#__PURE__*/ Parser.as(
  /*#__PURE__*/ Parser.preceded(eols, /*#__PURE__*/ Token.oneOf(" \t")),
  "",
);

/** A `CR` that does not start a `CRLF`: kept as content. */
const loneCr = /*#__PURE__*/ Parser.terminated(
  /*#__PURE__*/ Token.literal("\r"),
  /*#__PURE__*/ Parser.not(/*#__PURE__*/ Token.literal("\n")),
);

/**
 * One unfolded line. It starts at any character that is not a line ending, a
 * space or tab included: a continuation with nothing before it stays a line
 * of its own, whole.
 */
const unfoldedLine = /*#__PURE__*/ Parser.struct({
  offset: Parser.location,
  text: /*#__PURE__*/ Parser.fold(
    /*#__PURE__*/ Parser.alt(/*#__PURE__*/ Token.takeTill("\r\n", { min: 1 }), loneCr, foldMarker),
    { init: () => "", f: (text: string, chunk: string) => text + chunk, range: { min: 1 } },
  ),
});

/** The line scanner, compiled. It accepts any string, so it never fails. */
const unfoldedLines = /*#__PURE__*/ Compiler.jit(
  /*#__PURE__*/ Parser.delimited(
    /*#__PURE__*/ Parser.repeat(eol),
    /*#__PURE__*/ Parser.separated(unfoldedLine, eols),
    /*#__PURE__*/ Parser.repeat(eol),
  ),
);

/**
 * Unfold text into its logical lines (RFC 5545 §3.1, RFC 6350 §3.2): a line
 * that starts with a space or tab continues the previous non-empty line,
 * minus that one character.
 *
 * Lines split at `\r\n` or `\n`; a lone `\r` is content. Empty lines are
 * dropped, and a continuation with nothing before it stays a line of its
 * own. Each line carries the offset where it starts in `text`.
 *
 * @example
 * ```ts
 * import { ContentLine } from "@thomasfosterau/effect-ical"
 *
 * ContentLine.unfold("SUMMARY:Long\r\n  line\r\n").map((line) => line.text) // ["SUMMARY:Long line"]
 * ```
 *
 * @category unfolding
 */
export const unfold = (text: string): ReadonlyArray<UnfoldedLine> =>
  Result.getOrElse(Parser.parse(unfoldedLines, text), () => []);

/**
 * The 1-based line and column of an offset in `text`, counting lines at each
 * `\n` as {@link unfold} splits them.
 *
 * @category unfolding
 */
export const positionOf = (text: string, offset: number): Position => {
  const before = text.slice(0, offset);
  const lineStart = before.lastIndexOf("\n") + 1;
  return {
    line: before.split("\n").length,
    column: offset - lineStart + 1,
  };
};

// ---------------------------------------------------------------------------
// Parameter values (RFC 6868)
// ---------------------------------------------------------------------------

/** The strings `piece` yields, concatenated: zero or more times, or at least `min`. */
const concat = (piece: Parser.Parser<string>, min = 0): Parser.Parser<string> =>
  Parser.fold(piece, {
    init: () => "",
    f: (text: string, chunk: string) => text + chunk,
    range: { min },
  });

/** An RFC 6868 escape: `^n` / `^N` (a newline), `^'` (a double quote) or `^^`. */
const caretEscape = /*#__PURE__*/ Parser.preceded(
  /*#__PURE__*/ Token.literal("^"),
  /*#__PURE__*/ Parser.alt(
    /*#__PURE__*/ Parser.as(/*#__PURE__*/ Token.oneOf("nN"), "\n"),
    /*#__PURE__*/ Parser.as(/*#__PURE__*/ Token.literal("'"), '"'),
    /*#__PURE__*/ Token.literal("^"),
  ),
);

/**
 * Parameter text up to (not including) any of `stop`, caret-decoded. A `^`
 * that starts no escape is kept.
 */
const caretText = (stop: string): Parser.Parser<string> =>
  concat(Parser.alt(Token.takeTill(`^${stop}`, { min: 1 }), caretEscape, Token.literal("^")));

const caretDecoded = /*#__PURE__*/ Compiler.jit(
  /*#__PURE__*/ Parser.allConsuming(/*#__PURE__*/ caretText("")),
);

/**
 * Decode RFC 6868 caret escapes in a parameter value: `^n` is a newline,
 * `^'` a double quote and `^^` a caret. Any other `^` is kept.
 *
 * @category parameters
 */
export const decodeParameterValue = (value: string): string =>
  Result.getOrElse(Parser.parse(caretDecoded, value), () => value);

/**
 * Encode a parameter value for writing: RFC 6868 caret escapes for `^`,
 * newlines and double quotes, then double quotes around the value when it
 * contains `:`, `;` or `,`.
 *
 * @category parameters
 */
export const encodeParameterValue = (value: string): string => {
  const encoded = value.replace(/\^/g, "^^").replace(/\r?\n/g, "^n").replace(/"/g, "^'");
  return /[:;,]/.test(encoded) ? `"${encoded}"` : encoded;
};

// ---------------------------------------------------------------------------
// Parsing one line
// ---------------------------------------------------------------------------

/** A quoted parameter value: anything but a double quote, caret-decoded. */
const quotedValue = /*#__PURE__*/ Parser.delimited(
  /*#__PURE__*/ Token.literal('"'),
  /*#__PURE__*/ caretText('"'),
  /*#__PURE__*/ Parser.context(/*#__PURE__*/ Token.literal('"'), "a closing double quote"),
);

/** A parameter value, quoted or not (`paramtext` stops at `"`, `;`, `:` and `,`). */
const parameterValue = /*#__PURE__*/ Parser.alt(quotedValue, /*#__PURE__*/ caretText('";:,'));

const parameterGrammar = /*#__PURE__*/ Parser.map(
  /*#__PURE__*/ Parser.seq(
    /*#__PURE__*/ Token.takeTill("=;:", { min: 1 }),
    /*#__PURE__*/ Parser.opt(
      /*#__PURE__*/ Parser.preceded(
        /*#__PURE__*/ Token.literal("="),
        /*#__PURE__*/ Parser.separated(parameterValue, /*#__PURE__*/ Token.literal(","), {
          min: 1,
        }),
      ),
    ),
  ),
  ([name, values]): Parameter => ({
    name: Str.toUpperCase(name),
    values: Option.getOrElse(values, () => []),
  }),
);

/** `[group "."] name`: a group is everything before the first `.`. */
const groupAndName = /*#__PURE__*/ Parser.map(
  /*#__PURE__*/ Parser.seq(
    /*#__PURE__*/ Token.takeTill(".;:", { min: 1 }),
    /*#__PURE__*/ Parser.opt(
      /*#__PURE__*/ Parser.preceded(
        /*#__PURE__*/ Token.literal("."),
        /*#__PURE__*/ Token.takeTill(";:", { min: 1 }),
      ),
    ),
  ),
  ([first, rest]) =>
    Option.match(rest, {
      onNone: () => ({ name: Str.toUpperCase(first) }),
      onSome: (name) => ({ group: first, name: Str.toUpperCase(name) }),
    }),
);

const contentLine = /*#__PURE__*/ Compiler.jit(
  /*#__PURE__*/ Parser.allConsuming(
    /*#__PURE__*/ Parser.map(
      /*#__PURE__*/ Parser.seq(
        groupAndName,
        /*#__PURE__*/ Parser.repeat(
          /*#__PURE__*/ Parser.preceded(/*#__PURE__*/ Token.literal(";"), parameterGrammar),
        ),
        /*#__PURE__*/ Parser.preceded(
          /*#__PURE__*/ Parser.context(/*#__PURE__*/ Token.literal(":"), "a ':' before the value"),
          Token.rest,
        ),
      ),
      ([head, parameters, value]): ContentLine => ({ ...head, parameters, value }),
    ),
  ),
);

/**
 * Parse one unfolded content line into its group, name, parameters and
 * value.
 *
 * The value starts at the first `:` outside a quoted parameter value, so
 * `ATTENDEE;CN="Doe: Jane":mailto:jane@example.com` has the value
 * `mailto:jane@example.com`. Names and parameter names are upper-cased;
 * parameter values are unquoted and caret-decoded; the value is verbatim.
 *
 * @example
 * ```ts
 * import { ContentLine } from "@thomasfosterau/effect-ical"
 * import * as Result from "effect/Result"
 *
 * const line = Result.getOrThrow(ContentLine.parse('ATTENDEE;CN="Doe, Jane";RSVP=TRUE:mailto:jane@example.com'))
 * line.parameters // [{ name: "CN", values: ["Doe, Jane"] }, { name: "RSVP", values: ["TRUE"] }]
 * line.value // "mailto:jane@example.com"
 * ```
 *
 * @category parsing
 */
export const parse = (line: string): Result.Result<ContentLine, ContentLineError> =>
  Result.mapError(
    Parser.parse(contentLine, line),
    (error) =>
      new ContentLineError({
        message: `Invalid content line (at character ${error.offset + 1}${
          Arr.isReadonlyArrayNonEmpty(error.expected)
            ? `, expected ${Arr.join(error.expected, " or ")}`
            : ""
        }): ${line}`,
      }),
  );

/**
 * Unfold `text` and parse every line, failing at the first line that is not
 * a valid content line, with its 1-based `line` and `column` in `text`.
 *
 * @example
 * ```ts
 * import { ContentLine } from "@thomasfosterau/effect-ical"
 * import * as Result from "effect/Result"
 *
 * const lines = Result.getOrThrow(ContentLine.parseAll("BEGIN:VCARD\r\nFN:Jane\r\nEND:VCARD\r\n"))
 * lines.map((line) => line.name) // ["BEGIN", "FN", "END"]
 * ```
 *
 * @category parsing
 */
export const parseAll = (
  text: string,
): Result.Result<ReadonlyArray<ContentLine>, ContentLineError> =>
  Result.all(
    Arr.map(unfold(text), (line) =>
      Result.mapError(
        parse(line.text),
        (error) =>
          new ContentLineError({ message: error.message, ...positionOf(text, line.offset) }),
      ),
    ),
  );

/**
 * The values of the first parameter named `name` (case-insensitive), if the
 * line has one.
 *
 * @category parameters
 */
export const getParameter = (
  line: ContentLine,
  name: string,
): Option.Option<ReadonlyArray<string>> =>
  Option.map(
    Arr.findFirst(line.parameters, (parameter) => parameter.name === Str.toUpperCase(name)),
    (parameter) => parameter.values,
  );

// ---------------------------------------------------------------------------
// Formatting and folding
// ---------------------------------------------------------------------------

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
 * Fold a line so that no physical line is longer than 75 octets (UTF-8),
 * continuation lines start with a space, and no code point is split. Lines
 * are joined with CRLF; the result has no trailing line ending.
 *
 * @category formatting
 */
export const fold = (line: string): string => {
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

/**
 * Format a content line and fold it (see {@link fold}): the group, the
 * upper-cased name, each parameter (`;NAME=v1,v2`, values encoded with
 * {@link encodeParameterValue}), then `:` and the value as given.
 *
 * The value is written verbatim: escape TEXT values first with
 * {@link escapeText}. The result has no trailing line ending.
 *
 * @example
 * ```ts
 * import { ContentLine } from "@thomasfosterau/effect-ical"
 *
 * ContentLine.format({
 *   name: "attendee",
 *   parameters: [{ name: "cn", values: ["Doe, Jane"] }],
 *   value: "mailto:jane@example.com",
 * }) // 'ATTENDEE;CN="Doe, Jane":mailto:jane@example.com'
 * ```
 *
 * @category formatting
 */
export const format = (line: ContentLine): string =>
  fold(
    (line.group === undefined ? "" : `${line.group}.`) +
      Str.toUpperCase(line.name) +
      Arr.join(
        Arr.map(
          line.parameters,
          ({ name, values }) =>
            `;${Str.toUpperCase(name)}` +
            (Arr.isReadonlyArrayNonEmpty(values)
              ? `=${Arr.join(Arr.map(values, encodeParameterValue), ",")}`
              : ""),
        ),
        "",
      ) +
      `:${line.value}`,
  );

// ---------------------------------------------------------------------------
// TEXT values
// ---------------------------------------------------------------------------

/**
 * Escape a TEXT value (RFC 5545 §3.3.11, RFC 6350 §3.4): backslash,
 * semicolon and comma get a backslash, and a newline becomes `\n`.
 *
 * @category text
 */
export const escapeText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** A TEXT escape: `\n` / `\N` (a newline), or a backslash, `;` or `,` escaped. */
const textEscape = /*#__PURE__*/ Parser.preceded(
  /*#__PURE__*/ Token.literal("\\"),
  /*#__PURE__*/ Parser.alt(
    /*#__PURE__*/ Parser.as(/*#__PURE__*/ Token.oneOf("nN"), "\n"),
    /*#__PURE__*/ Token.oneOf("\\;,"),
  ),
);

/** A TEXT value, unescaped; a backslash that starts no escape is kept. */
const unescapedText = /*#__PURE__*/ Compiler.jit(
  /*#__PURE__*/ Parser.allConsuming(
    /*#__PURE__*/ concat(
      /*#__PURE__*/ Parser.alt(
        /*#__PURE__*/ Token.takeTill("\\", { min: 1 }),
        textEscape,
        /*#__PURE__*/ Token.literal("\\"),
      ),
    ),
  ),
);

/**
 * Unescape a TEXT value: `\\`, `\;`, `\,` and `\n` / `\N` (a newline) are
 * decoded. Any other backslash sequence is kept verbatim, as lenient
 * readers do.
 *
 * @category text
 */
export const unescapeText = (value: string): string =>
  Result.getOrElse(Parser.parse(unescapedText, value), () => value);

/** A backslash and the character after it, kept as written. */
const escapePair = /*#__PURE__*/ Parser.map(
  /*#__PURE__*/ Parser.preceded(/*#__PURE__*/ Token.literal("\\"), Token.any),
  (char) => `\\${char}`,
);

/** The parts of a value between unescaped `separator`s, escapes kept. */
const splitter = (separator: "," | ";") =>
  Compiler.jit(
    Parser.allConsuming(
      Parser.separated(
        concat(
          Parser.alt(Token.takeTill(`\\${separator}`, { min: 1 }), escapePair, Token.literal("\\")),
        ),
        Token.literal(separator),
        { min: 1 },
      ),
    ),
  );

const splitters = {
  ",": /*#__PURE__*/ splitter(","),
  ";": /*#__PURE__*/ splitter(";"),
};

/**
 * Split a value at each `separator` that is not escaped with a backslash,
 * without unescaping the parts: vCard's structured `N` and `ADR` split at
 * `;`, then each component at `,`.
 *
 * @example
 * ```ts
 * import { ContentLine } from "@thomasfosterau/effect-ical"
 *
 * ContentLine.splitValue("Doe;Jane\\;Q;;", ";") // ["Doe", "Jane\\;Q", "", ""]
 * ```
 *
 * @category text
 */
export const splitValue = (value: string, separator: "," | ";"): ReadonlyArray<string> =>
  Result.getOrElse(Parser.parse(splitters[separator], value), () => [value]);
