/**
 * vCard 4.0 (RFC 6350): a plain object model for contact cards, a parser
 * and an encoder, built on the shared {@link ContentLine} layer.
 *
 * Every property instance keeps its group (`item1.EMAIL`) and its
 * parameters (`TYPE`, `PREF`, `LABEL`, …). TEXT values are unescaped when
 * parsed and escaped when encoded; structured values (`N`, `ADR`, `ORG`,
 * `GENDER`) are split into their components; URI, date and other values are
 * kept verbatim. Properties the model does not type, extra occurrences of an
 * at-most-once property, and values that do not fit their structure are
 * kept in order in `extra` and written back, so a parse → encode
 * round-trip loses nothing.
 *
 * Only `VERSION:4.0` cards are read; vCard 3.0 and 2.1 are #27.
 *
 * @module
 */

// The barrel re-exports this module only as a namespace (`export * as VCard`),
// so its `parse` and `encode` names never collide with a sibling module's.
// fallow-ignore-file duplicate-export
import * as Ascii from "@thomasfosterau/effect-parse/Ascii";
import * as Compiler from "@thomasfosterau/effect-parse/Compiler";
import * as Parser from "@thomasfosterau/effect-parse/Parser";
import * as Token from "@thomasfosterau/effect-parse/Token";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import * as ContentLine from "./ContentLine.js";

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * One property instance: its value, plus its parameters and group when it
 * has any.
 *
 * @category models
 */
export interface Property<A = string> {
  readonly value: A;
  readonly parameters?: ReadonlyArray<ContentLine.Parameter>;
  readonly group?: string;
}

/**
 * The structured value of `N` (RFC 6350 §6.2.2): each component is a list.
 *
 * @category models
 */
export interface Name {
  readonly familyNames: ReadonlyArray<string>;
  readonly givenNames: ReadonlyArray<string>;
  readonly additionalNames: ReadonlyArray<string>;
  readonly honorificPrefixes: ReadonlyArray<string>;
  readonly honorificSuffixes: ReadonlyArray<string>;
}

/**
 * The structured value of `ADR` (RFC 6350 §6.3.1): each component is a list.
 * RFC 6350 asks writers to leave `poBox` and `extendedAddress` empty.
 *
 * @category models
 */
export interface Address {
  readonly poBox: ReadonlyArray<string>;
  readonly extendedAddress: ReadonlyArray<string>;
  readonly streetAddress: ReadonlyArray<string>;
  readonly locality: ReadonlyArray<string>;
  readonly region: ReadonlyArray<string>;
  readonly postalCode: ReadonlyArray<string>;
  readonly countryName: ReadonlyArray<string>;
}

/**
 * The structured value of `GENDER` (RFC 6350 §6.2.7): a sex (`M`, `F`, `O`,
 * `N`, `U` or empty) and an optional free-form identity.
 *
 * @category models
 */
export interface Gender {
  readonly sex: string;
  readonly identity?: string;
}

/**
 * A vCard 4.0 card.
 *
 * Fields are named after their properties, lower-cased. `fn` is required
 * and may repeat (one per language, via `ALTID`); the other at-most-once
 * properties (`n`, `bday`, `anniversary`, `gender`, `prodid`, `rev`, `uid`,
 * `kind`) are single, and the rest are lists. TEXT values are unescaped;
 * `nickname` and `categories` are comma lists; `org` lists the organisation
 * name then its units. Empty lists are omitted.
 *
 * @category models
 */
export interface VCard {
  readonly version: "4.0";
  readonly fn: Arr.NonEmptyReadonlyArray<Property>;
  readonly n?: Property<Name>;
  readonly nickname?: ReadonlyArray<Property<ReadonlyArray<string>>>;
  readonly photo?: ReadonlyArray<Property>;
  readonly bday?: Property;
  readonly anniversary?: Property;
  readonly gender?: Property<Gender>;
  readonly adr?: ReadonlyArray<Property<Address>>;
  readonly tel?: ReadonlyArray<Property>;
  readonly email?: ReadonlyArray<Property>;
  readonly impp?: ReadonlyArray<Property>;
  readonly lang?: ReadonlyArray<Property>;
  readonly tz?: ReadonlyArray<Property>;
  readonly geo?: ReadonlyArray<Property>;
  readonly title?: ReadonlyArray<Property>;
  readonly role?: ReadonlyArray<Property>;
  readonly logo?: ReadonlyArray<Property>;
  readonly org?: ReadonlyArray<Property<ReadonlyArray<string>>>;
  readonly member?: ReadonlyArray<Property>;
  readonly related?: ReadonlyArray<Property>;
  readonly categories?: ReadonlyArray<Property<ReadonlyArray<string>>>;
  readonly note?: ReadonlyArray<Property>;
  readonly prodid?: Property;
  readonly rev?: Property;
  readonly sound?: ReadonlyArray<Property>;
  readonly uid?: Property;
  readonly clientpidmap?: ReadonlyArray<Property>;
  readonly url?: ReadonlyArray<Property>;
  readonly key?: ReadonlyArray<Property>;
  readonly fburl?: ReadonlyArray<Property>;
  readonly caladruri?: ReadonlyArray<Property>;
  readonly caluri?: ReadonlyArray<Property>;
  readonly kind?: Property;
  readonly xml?: ReadonlyArray<Property>;
  readonly source?: ReadonlyArray<Property>;
  /** Properties the model does not type, in their original order. */
  readonly extra?: ReadonlyArray<ContentLine.ContentLine>;
}

/**
 * The parser's failure: a line is not a valid content line, a card is never
 * closed or is nested, or a card has no `VERSION:4.0` or no `FN`.
 *
 * `line` and `column` (both 1-based) locate the failing line, or the card's
 * `BEGIN` line for a card-level failure.
 *
 * @category errors
 */
export class VCardParseError extends Schema.TaggedError<
  VCardParseError,
  { readonly brand: unique symbol }
>()("VCardParseError", {
  message: Schema.String,
  line: Schema.optional(Schema.Int),
  column: Schema.optional(Schema.Int),
}) {}

/**
 * The encoder's failure: a card has no `FN` (possible only for a value that
 * bypassed the types).
 *
 * @category errors
 */
export class VCardEncodeError extends Schema.TaggedError<
  VCardEncodeError,
  { readonly brand: unique symbol }
>()("VCardEncodeError", {
  message: Schema.String,
}) {}

/**
 * A minimal card with one formatted name.
 *
 * @example
 * ```ts
 * import { VCard } from "@thomasfosterau/effect-ical"
 *
 * const card: VCard.VCard = { ...VCard.make("Jane Doe"), email: [{ value: "jane@example.com" }] }
 * ```
 *
 * @category constructors
 */
export const make = (fn: string): VCard => ({ version: "4.0", fn: [{ value: fn }] });

/** A property's parameters (none when it has no `parameters`). */
const parametersOf = (property: Property<unknown>): ReadonlyArray<ContentLine.Parameter> =>
  property.parameters ?? [];

/** `{ [key]: value }` when the value is present, otherwise nothing. */
const entry = <K extends string, V>(key: K, value: Option.Option<V>): { readonly [P in K]?: V } =>
  Option.match(value, { onNone: () => ({}), onSome: (v) => Record.singleton(key, v) });

/** A comma-separated list of parameter text (one quoted `TYPE` value). */
const commaList = /*#__PURE__*/ Compiler.jit(
  /*#__PURE__*/ Parser.separated(
    /*#__PURE__*/ Token.takeTill(","),
    /*#__PURE__*/ Token.literal(","),
    { min: 1 },
  ),
);

/** A `PREF` value: an unsigned integer (RFC 6350 §5.3 allows 1 to 100). */
const preference = /*#__PURE__*/ Compiler.jit(/*#__PURE__*/ Parser.allConsuming(Ascii.decUint));

/**
 * The `TYPE` values of a property, lower-cased, with comma lists inside one
 * quoted value (`TYPE="work,voice"`) split.
 *
 * @category accessors
 */
export const types = (property: Property<unknown>): ReadonlyArray<string> =>
  Arr.flatMap(
    Arr.filter(parametersOf(property), (parameter) => parameter.name === "TYPE"),
    (parameter: ContentLine.Parameter) =>
      Arr.flatMap(parameter.values, (value: string) =>
        Arr.map(
          Result.getOrElse(Parser.parse(commaList, value), () => [value]),
          Str.toLowerCase,
        ),
      ),
  );

/**
 * The property with the lowest `PREF` (1 is most preferred); properties
 * without a `PREF` that is an unsigned integer rank last, and ties keep
 * their order.
 *
 * @category accessors
 */
export const preferred = <A>(properties: ReadonlyArray<Property<A>>): Option.Option<Property<A>> =>
  Arr.head(
    Arr.sortWith(
      properties,
      (property) =>
        Option.getOrElse(
          Option.flatMap(
            Arr.findFirst(parametersOf(property), (parameter) => parameter.name === "PREF"),
            (parameter) => Option.fromNullishOr(parameter.values[0]),
          ).pipe(Option.flatMap((value) => Result.getSuccess(Parser.parse(preference, value)))),
          () => 101,
        ),
      Order.Number,
    ),
  );

// ---------------------------------------------------------------------------
// Decoding values
// ---------------------------------------------------------------------------

/** Whether the parameters say `VALUE=uri`. */
const isUri = (parameters: ReadonlyArray<ContentLine.Parameter>): boolean =>
  Arr.some(
    parameters,
    ({ name: parameter, values }) =>
      parameter === "VALUE" && Arr.some(values, (value) => Str.toLowerCase(value) === "uri"),
  );

/** The line's parameters and group, as a property carries them. */
const propertyOf = <A>(line: ContentLine.ContentLine, value: A): Property<A> => ({
  value,
  ...entry(
    "parameters",
    Option.liftPredicate(line.parameters, Arr.isReadonlyArrayNonEmpty<ContentLine.Parameter>),
  ),
  ...entry("group", Option.fromUndefinedOr(line.group)),
});

type Decoder<A> = (line: ContentLine.ContentLine) => Option.Option<A>;

/** A TEXT value, unescaped (verbatim when the line says `VALUE=uri`). */
const text: Decoder<string> = (line) =>
  Option.some(isUri(line.parameters) ? line.value : ContentLine.unescapeText(line.value));

/** A value kept verbatim: URIs, dates, language tags. */
const raw: Decoder<string> = (line) => Option.some(line.value);

/** A comma-separated TEXT list. */
const textList: Decoder<ReadonlyArray<string>> = (line) =>
  Option.some(Arr.map(ContentLine.splitValue(line.value, ","), ContentLine.unescapeText));

/** A component list: empty when the component is empty. */
const componentList = (component: string): ReadonlyArray<string> =>
  component === "" ? [] : Arr.map(ContentLine.splitValue(component, ","), ContentLine.unescapeText);

/**
 * A `;`-structured value of at most `size` components (missing trailing
 * components are empty). More components than that do not fit: the line is
 * kept in `extra`.
 */
const structured =
  <A>(
    size: number,
    build: (component: (index: number) => ReadonlyArray<string>) => A,
  ): Decoder<A> =>
  (line) => {
    const components = ContentLine.splitValue(line.value, ";");
    return components.length > size
      ? Option.none()
      : Option.some(build((index) => componentList(components[index] ?? "")));
  };

const name: Decoder<Name> = structured(5, (component) => ({
  familyNames: component(0),
  givenNames: component(1),
  additionalNames: component(2),
  honorificPrefixes: component(3),
  honorificSuffixes: component(4),
}));

const address: Decoder<Address> = structured(7, (component) => ({
  poBox: component(0),
  extendedAddress: component(1),
  streetAddress: component(2),
  locality: component(3),
  region: component(4),
  postalCode: component(5),
  countryName: component(6),
}));

/** `ORG`: the organisation name, then its units, each unescaped. */
const organization: Decoder<ReadonlyArray<string>> = (line) =>
  Option.some(Arr.map(ContentLine.splitValue(line.value, ";"), ContentLine.unescapeText));

const gender: Decoder<Gender> = (line) => {
  const [sex, identity, ...rest] = Arr.map(
    ContentLine.splitValue(line.value, ";"),
    ContentLine.unescapeText,
  );
  return Arr.isReadonlyArrayNonEmpty(rest)
    ? Option.none()
    : Option.some({ sex: sex ?? "", ...entry("identity", Option.fromUndefinedOr(identity)) });
};

/** The lines a field takes, and the decoded properties. */
interface Taken<A> {
  readonly used: ReadonlyArray<number>;
  readonly properties: ReadonlyArray<Property<A>>;
}

/** A card's line and its index among the card's lines. */
interface Indexed {
  readonly line: ContentLine.ContentLine;
  readonly index: number;
}

const take =
  (byName: Readonly<Record<string, ReadonlyArray<Indexed>>>) =>
  <A>(propertyName: string, decode: Decoder<A>, limit: number = Infinity): Taken<A> => {
    const decoded = Arr.filterMap(byName[propertyName] ?? [], ({ line, index }) =>
      Option.match(decode(line), {
        onNone: () => Result.failVoid,
        onSome: (value) => Result.succeed([index, propertyOf(line, value)] as const),
      }),
    );
    const kept = Arr.take(decoded, limit);
    return { used: Arr.map(kept, ([index]) => index), properties: Arr.map(kept, ([, p]) => p) };
  };

/** `{ [field]: properties }` when there are any, otherwise nothing. */
const many = <K extends string, A>(
  field: K,
  taken: Taken<A>,
): { readonly [P in K]?: ReadonlyArray<Property<A>> } =>
  Arr.isReadonlyArrayNonEmpty(taken.properties) ? Record.singleton(field, taken.properties) : {};

/** `{ [field]: property }` when there is one, otherwise nothing. */
const one = <K extends string, A>(field: K, taken: Taken<A>): { readonly [P in K]?: Property<A> } =>
  Option.match(Arr.head(taken.properties), {
    onNone: () => ({}),
    onSome: (property) => Record.singleton(field, property),
  });

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** One unfolded line, parsed or not, and its offset in the input. */
interface Located {
  readonly parsed: Result.Result<ContentLine.ContentLine, ContentLine.ContentLineError>;
  readonly offset: number;
}

const isMarker =
  (marker: "BEGIN" | "END") =>
  ({ parsed }: Located): boolean =>
    Result.isSuccess(parsed) &&
    parsed.success.name === marker &&
    Str.toUpperCase(parsed.success.value) === "VCARD";

/** Build one card from the lines between its `BEGIN` and `END`. */
const toCard = (
  lines: ReadonlyArray<ContentLine.ContentLine>,
  fail: (message: string) => VCardParseError,
): Result.Result<VCard, VCardParseError> => {
  const versions = Arr.filter(lines, (line) => line.name === "VERSION");
  if (!Arr.some(versions, (line) => line.value === "4.0")) {
    return Result.fail(
      fail(
        Arr.isReadonlyArrayNonEmpty(versions)
          ? `VERSION must be "4.0", got "${versions[0].value}" (vCard 3.0 and 2.1 are not read yet)`
          : "VERSION property is required",
      ),
    );
  }
  const indexed = Arr.map(lines, (line, index): Indexed => ({ line, index }));
  const byName = Arr.groupBy(indexed, ({ line }) => line.name);
  const takeOf = take(byName);
  const fields = {
    fn: takeOf("FN", text),
    n: takeOf("N", name, 1),
    nickname: takeOf("NICKNAME", textList),
    photo: takeOf("PHOTO", raw),
    bday: takeOf("BDAY", raw, 1),
    anniversary: takeOf("ANNIVERSARY", raw, 1),
    gender: takeOf("GENDER", gender, 1),
    adr: takeOf("ADR", address),
    tel: takeOf("TEL", raw),
    email: takeOf("EMAIL", text),
    impp: takeOf("IMPP", raw),
    lang: takeOf("LANG", raw),
    tz: takeOf("TZ", raw),
    geo: takeOf("GEO", raw),
    title: takeOf("TITLE", text),
    role: takeOf("ROLE", text),
    logo: takeOf("LOGO", raw),
    org: takeOf("ORG", organization),
    member: takeOf("MEMBER", raw),
    related: takeOf("RELATED", raw),
    categories: takeOf("CATEGORIES", textList),
    note: takeOf("NOTE", text),
    prodid: takeOf("PRODID", text, 1),
    rev: takeOf("REV", raw, 1),
    sound: takeOf("SOUND", raw),
    uid: takeOf("UID", raw, 1),
    clientpidmap: takeOf("CLIENTPIDMAP", raw),
    url: takeOf("URL", raw),
    key: takeOf("KEY", raw),
    fburl: takeOf("FBURL", raw),
    caladruri: takeOf("CALADRURI", raw),
    caluri: takeOf("CALURI", raw),
    kind: takeOf("KIND", text, 1),
    xml: takeOf("XML", text),
    source: takeOf("SOURCE", raw),
  };
  const fn = fields.fn.properties;
  if (!Arr.isReadonlyArrayNonEmpty(fn)) {
    return Result.fail(fail("FN property is required"));
  }
  const used = HashSet.fromIterable([
    ...Arr.flatMap(Record.values(fields), (field: Taken<unknown>) => field.used),
    ...Arr.take(
      Arr.filterMap(indexed, ({ line, index }) =>
        line.name === "VERSION" ? Result.succeed(index) : Result.failVoid,
      ),
      1,
    ),
  ]);
  const extra = Arr.filterMap(indexed, ({ line, index }) =>
    HashSet.has(used, index) ? Result.failVoid : Result.succeed(line),
  );
  return Result.succeed({
    version: "4.0",
    fn,
    ...one("n", fields.n),
    ...many("nickname", fields.nickname),
    ...many("photo", fields.photo),
    ...one("bday", fields.bday),
    ...one("anniversary", fields.anniversary),
    ...one("gender", fields.gender),
    ...many("adr", fields.adr),
    ...many("tel", fields.tel),
    ...many("email", fields.email),
    ...many("impp", fields.impp),
    ...many("lang", fields.lang),
    ...many("tz", fields.tz),
    ...many("geo", fields.geo),
    ...many("title", fields.title),
    ...many("role", fields.role),
    ...many("logo", fields.logo),
    ...many("org", fields.org),
    ...many("member", fields.member),
    ...many("related", fields.related),
    ...many("categories", fields.categories),
    ...many("note", fields.note),
    ...one("prodid", fields.prodid),
    ...one("rev", fields.rev),
    ...many("sound", fields.sound),
    ...one("uid", fields.uid),
    ...many("clientpidmap", fields.clientpidmap),
    ...many("url", fields.url),
    ...many("key", fields.key),
    ...many("fburl", fields.fburl),
    ...many("caladruri", fields.caladruri),
    ...many("caluri", fields.caluri),
    ...one("kind", fields.kind),
    ...many("xml", fields.xml),
    ...many("source", fields.source),
    ...entry(
      "extra",
      Option.liftPredicate(extra, Arr.isReadonlyArrayNonEmpty<ContentLine.ContentLine>),
    ),
  });
};

/**
 * Parse vCard text into its cards, synchronously.
 *
 * The input may hold any number of cards; lines outside a card are ignored,
 * even malformed ones. It fails on a line inside a card that is not a valid
 * content line, a card that is never closed or is nested in another, and a
 * card without `VERSION:4.0` or `FN`.
 *
 * @example
 * ```ts
 * import { VCard } from "@thomasfosterau/effect-ical"
 * import * as Result from "effect/Result"
 *
 * const cards = Result.getOrThrow(
 *   VCard.parseResult("BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Jane Doe\r\nN:Doe;Jane;;;\r\nEND:VCARD\r\n"),
 * )
 * cards[0]?.n?.value.givenNames // ["Jane"]
 * ```
 *
 * @category parsing
 */
export const parseResult = (text: string): Result.Result<ReadonlyArray<VCard>, VCardParseError> => {
  const at = (offset: number) => ContentLine.positionOf(text, offset);
  const lines = Arr.map(ContentLine.unfold(text), ({ text: line, offset }): Located => ({
    parsed: ContentLine.parse(line),
    offset,
  }));
  const markers = Arr.filterMap(lines, (located, index) =>
    isMarker("BEGIN")(located)
      ? Result.succeed({ begin: true, index, offset: located.offset })
      : isMarker("END")(located)
        ? Result.succeed({ begin: false, index, offset: located.offset })
        : Result.failVoid,
  );
  return Result.all(
    Arr.map(Arr.chunksOf(markers, 2), ([open, close]) => {
      if (!open.begin) {
        return Result.fail(
          new VCardParseError({ message: "END:VCARD without BEGIN:VCARD", ...at(open.offset) }),
        );
      }
      if (close === undefined) {
        return Result.fail(
          new VCardParseError({ message: "VCARD not closed", ...at(open.offset) }),
        );
      }
      if (close.begin) {
        return Result.fail(
          new VCardParseError({ message: "Nested VCARD is not supported", ...at(close.offset) }),
        );
      }
      return Result.flatMap(
        Result.all(
          Arr.map(lines.slice(open.index + 1, close.index), ({ parsed, offset }) =>
            Result.mapError(
              parsed,
              (error) => new VCardParseError({ message: error.message, ...at(offset) }),
            ),
          ),
        ),
        (cardLines) =>
          toCard(cardLines, (message) => new VCardParseError({ message, ...at(open.offset) })),
      );
    }),
  );
};

/**
 * Parse vCard text into its cards, failing with a {@link VCardParseError}.
 * The parse runs when the Effect runs.
 *
 * @example
 * ```ts
 * import { VCard } from "@thomasfosterau/effect-ical"
 * import * as Effect from "effect/Effect"
 *
 * const program = VCard.parse("BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Jane Doe\r\nEND:VCARD\r\n")
 * ```
 *
 * @category parsing
 */
export const parse = (text: string): Effect.Effect<ReadonlyArray<VCard>, VCardParseError> =>
  Effect.suspend(() => Effect.fromResult(parseResult(text)));

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

type Encoder<A> = (property: Property<A>) => string;

const encodeText: Encoder<string> = (property) =>
  isUri(parametersOf(property)) ? property.value : ContentLine.escapeText(property.value);

const encodeRaw: Encoder<string> = (property) => property.value;

const joinList = (values: ReadonlyArray<string>): string =>
  Arr.join(Arr.map(values, ContentLine.escapeText), ",");

const encodeTextList: Encoder<ReadonlyArray<string>> = (property) => joinList(property.value);

const encodeName: Encoder<Name> = ({ value }) =>
  Arr.join(
    Arr.map(
      [
        value.familyNames,
        value.givenNames,
        value.additionalNames,
        value.honorificPrefixes,
        value.honorificSuffixes,
      ],
      joinList,
    ),
    ";",
  );

const encodeAddress: Encoder<Address> = ({ value }) =>
  Arr.join(
    Arr.map(
      [
        value.poBox,
        value.extendedAddress,
        value.streetAddress,
        value.locality,
        value.region,
        value.postalCode,
        value.countryName,
      ],
      joinList,
    ),
    ";",
  );

const encodeOrganization: Encoder<ReadonlyArray<string>> = ({ value }) =>
  Arr.join(Arr.map(value, ContentLine.escapeText), ";");

const encodeGender: Encoder<Gender> = ({ value }) =>
  ContentLine.escapeText(value.sex) +
  (value.identity === undefined ? "" : `;${ContentLine.escapeText(value.identity)}`);

const isProperty = <A>(value: ReadonlyArray<Property<A>> | Property<A>): value is Property<A> =>
  "value" in value;

/** The content lines of one field, in order. */
const lines =
  <A>(propertyName: string, encode: Encoder<A>) =>
  (properties?: ReadonlyArray<Property<A>> | Property<A>): ReadonlyArray<string> =>
    Arr.map(
      properties === undefined ? [] : isProperty(properties) ? [properties] : properties,
      (property) =>
        ContentLine.format({
          ...entry("group", Option.fromUndefinedOr(property.group)),
          name: propertyName,
          parameters: parametersOf(property),
          value: encode(property),
        }),
    );

const encodeCard = (card: VCard): Result.Result<ReadonlyArray<string>, VCardEncodeError> =>
  !Arr.isReadonlyArrayNonEmpty(card.fn ?? [])
    ? Result.fail(new VCardEncodeError({ message: "FN property is required" }))
    : Result.succeed([
        "BEGIN:VCARD",
        "VERSION:4.0",
        ...Arr.flatten([
          lines("FN", encodeText)(card.fn),
          lines("N", encodeName)(card.n),
          lines("NICKNAME", encodeTextList)(card.nickname),
          lines("PHOTO", encodeRaw)(card.photo),
          lines("BDAY", encodeRaw)(card.bday),
          lines("ANNIVERSARY", encodeRaw)(card.anniversary),
          lines("GENDER", encodeGender)(card.gender),
          lines("ADR", encodeAddress)(card.adr),
          lines("TEL", encodeRaw)(card.tel),
          lines("EMAIL", encodeText)(card.email),
          lines("IMPP", encodeRaw)(card.impp),
          lines("LANG", encodeRaw)(card.lang),
          lines("TZ", encodeRaw)(card.tz),
          lines("GEO", encodeRaw)(card.geo),
          lines("TITLE", encodeText)(card.title),
          lines("ROLE", encodeText)(card.role),
          lines("LOGO", encodeRaw)(card.logo),
          lines("ORG", encodeOrganization)(card.org),
          lines("MEMBER", encodeRaw)(card.member),
          lines("RELATED", encodeRaw)(card.related),
          lines("CATEGORIES", encodeTextList)(card.categories),
          lines("NOTE", encodeText)(card.note),
          lines("PRODID", encodeText)(card.prodid),
          lines("REV", encodeRaw)(card.rev),
          lines("SOUND", encodeRaw)(card.sound),
          lines("UID", encodeRaw)(card.uid),
          lines("CLIENTPIDMAP", encodeRaw)(card.clientpidmap),
          lines("URL", encodeRaw)(card.url),
          lines("KEY", encodeRaw)(card.key),
          lines("FBURL", encodeRaw)(card.fburl),
          lines("CALADRURI", encodeRaw)(card.caladruri),
          lines("CALURI", encodeRaw)(card.caluri),
          lines("KIND", encodeText)(card.kind),
          lines("XML", encodeText)(card.xml),
          lines("SOURCE", encodeRaw)(card.source),
          Arr.map(card.extra ?? [], ContentLine.format),
        ]),
        "END:VCARD",
      ]);

const isCardList = (value: VCard | ReadonlyArray<VCard>): value is ReadonlyArray<VCard> =>
  Arr.isArray(value);

/**
 * Encode one card or a list of cards as vCard 4.0 text, synchronously.
 *
 * Each card is written `BEGIN:VCARD`, `VERSION:4.0`, its typed properties
 * in a fixed order, its `extra` properties in their order, `END:VCARD`;
 * lines are folded at 75 octets and end with CRLF. Fails when a card has no
 * `FN` (possible only for a value that bypassed the types).
 *
 * @example
 * ```ts
 * import { VCard } from "@thomasfosterau/effect-ical"
 * import * as Result from "effect/Result"
 *
 * const text = Result.getOrThrow(VCard.encodeResult(VCard.make("Jane Doe")))
 * // "BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Jane Doe\r\nEND:VCARD\r\n"
 * ```
 *
 * @category encoding
 */
export const encodeResult = (
  cards: VCard | ReadonlyArray<VCard>,
): Result.Result<string, VCardEncodeError> =>
  Result.map(
    Result.all(Arr.map(isCardList(cards) ? cards : [cards], encodeCard)),
    (encoded) => Arr.join(Arr.flatten(encoded), "\r\n") + "\r\n",
  );

/**
 * Encode one card or a list of cards as vCard 4.0 text, failing with a
 * {@link VCardEncodeError}. The encoding runs when the Effect runs.
 *
 * @example
 * ```ts
 * import { VCard } from "@thomasfosterau/effect-ical"
 *
 * const program = VCard.encode([VCard.make("Jane Doe"), VCard.make("John Doe")])
 * ```
 *
 * @category encoding
 */
export const encode = (
  cards: VCard | ReadonlyArray<VCard>,
): Effect.Effect<string, VCardEncodeError> =>
  Effect.suspend(() => Effect.fromResult(encodeResult(cards)));
