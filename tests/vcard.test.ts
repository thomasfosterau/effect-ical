/**
 * Tests for the vCard 4.0 (RFC 6350) codec.
 */

import { assert, describe, expect, it } from "vite-plus/test";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as VCard from "../src/VCard";
import { runTest } from "./helpers/effect";

const parseCards = (text: string): ReadonlyArray<VCard.VCard> => {
  const result = VCard.parseResult(text);
  assert(Result.isSuccess(result), Result.isFailure(result) ? result.failure.message : "");
  return result.success;
};

const parseOne = (text: string): VCard.VCard => {
  const [card] = parseCards(text);
  assert(card !== undefined);
  return card;
};

const parseFailure = (text: string): VCard.VCardParseError => {
  const result = VCard.parseResult(text);
  assert(Result.isFailure(result));
  return result.failure;
};

const encodeText = (cards: VCard.VCard | ReadonlyArray<VCard.VCard>): string => {
  const result = VCard.encodeResult(cards);
  assert(Result.isSuccess(result));
  return result.success;
};

/** RFC 6350 §8, "Example: Author's vCard", with CRLF line endings. */
const rfcExample = [
  "BEGIN:VCARD",
  "VERSION:4.0",
  "FN:Simon Perreault",
  "N:Perreault;Simon;;;ing. jr,M.Sc.",
  "BDAY:--0203",
  "ANNIVERSARY:20090808T1430-0500",
  "GENDER:M",
  "LANG;PREF=1:fr",
  "LANG;PREF=2:en",
  "ORG;TYPE=work:Viagenie",
  "ADR;TYPE=work:;Suite D2-630;2875 Laurier;",
  " Quebec;QC;G1V 2M2;Canada",
  'TEL;VALUE=uri;TYPE="work,voice";PREF=1:tel:+1-418-656-9254;ext=102',
  'TEL;VALUE=uri;TYPE="work,cell,voice,video,text":tel:+1-418-262-6501',
  "EMAIL;TYPE=work:simon.perreault@viagenie.ca",
  "GEO;TYPE=work:geo:46.772673,-71.282945",
  "KEY;TYPE=work;VALUE=uri:",
  " http://www.viagenie.ca/simon.perreault/simon.asc",
  "TZ:-0500",
  "URL;TYPE=home:http://nomis80.org",
  "END:VCARD",
  "",
].join("\r\n");

describe("VCard.parseResult", () => {
  it("reads RFC 6350's example card", () => {
    const card = parseOne(rfcExample);
    expect(card).toMatchObject({
      fn: [{ value: "Simon Perreault" }],
      n: {
        value: {
          familyNames: ["Perreault"],
          givenNames: ["Simon"],
          additionalNames: [],
          honorificPrefixes: [],
          honorificSuffixes: ["ing. jr", "M.Sc."],
        },
      },
      bday: { value: "--0203" },
      anniversary: { value: "20090808T1430-0500" },
      gender: { value: { sex: "M" } },
      lang: [{ value: "fr" }, { value: "en" }],
      org: [{ value: ["Viagenie"], parameters: [{ name: "TYPE", values: ["work"] }] }],
      adr: [
        {
          value: {
            poBox: [],
            extendedAddress: ["Suite D2-630"],
            streetAddress: ["2875 Laurier"],
            locality: ["Quebec"],
            region: ["QC"],
            postalCode: ["G1V 2M2"],
            countryName: ["Canada"],
          },
        },
      ],
      tel: [{ value: "tel:+1-418-656-9254;ext=102" }, { value: "tel:+1-418-262-6501" }],
      email: [{ value: "simon.perreault@viagenie.ca" }],
      geo: [{ value: "geo:46.772673,-71.282945" }],
      key: [{ value: "http://www.viagenie.ca/simon.perreault/simon.asc" }],
      tz: [{ value: "-0500" }],
      url: [{ value: "http://nomis80.org" }],
    });
    expect(card).not.toHaveProperty("extra");
  });

  it("reads every card in the input and ignores lines outside cards", () => {
    const cards = parseCards(
      "junk before\nBEGIN:VCARD\nVERSION:4.0\nFN:A\nEND:VCARD\nbetween:x\nbegin:vcard\nVERSION:4.0\nFN:B\nend:vcard\n",
    );
    expect(cards.map((card) => card.fn[0].value)).toEqual(["A", "B"]);
  });

  it("unescapes TEXT values and splits TEXT lists", () => {
    const card = parseOne(
      [
        "BEGIN:VCARD",
        "VERSION:4.0",
        "FN:Doe\\, Jane",
        "NOTE:Line one\\nLine two\\; and\\, more",
        "NICKNAME:JJ,Janie\\, the great",
        "CATEGORIES:friends,work",
        "TITLE:Boss",
        "ROLE:Lead",
        "KIND:individual",
        "PRODID:-//Example//EN",
        "REV:20240101T000000Z",
        "UID:urn:uuid:1",
        "GENDER:O;non-binary\\; mostly",
        "ORG:Example\\, Inc.;Engineering;Platform",
        "XML:<a/>",
        "END:VCARD",
      ].join("\n"),
    );
    expect(card).toMatchObject({
      fn: [{ value: "Doe, Jane" }],
      note: [{ value: "Line one\nLine two; and, more" }],
      nickname: [{ value: ["JJ", "Janie, the great"] }],
      categories: [{ value: ["friends", "work"] }],
      gender: { value: { sex: "O", identity: "non-binary; mostly" } },
      org: [{ value: ["Example, Inc.", "Engineering", "Platform"] }],
      title: [{ value: "Boss" }],
      role: [{ value: "Lead" }],
      kind: { value: "individual" },
      prodid: { value: "-//Example//EN" },
      rev: { value: "20240101T000000Z" },
      uid: { value: "urn:uuid:1" },
      xml: [{ value: "<a/>" }],
    });
  });

  it("fills missing structured components and keeps a misfit GENDER in extra", () => {
    const card = parseOne("BEGIN:VCARD\nVERSION:4.0\nFN:A\nN:Doe\nGENDER:F;x;y\nEND:VCARD\n");
    expect(card.n?.value).toEqual({
      familyNames: ["Doe"],
      givenNames: [],
      additionalNames: [],
      honorificPrefixes: [],
      honorificSuffixes: [],
    });
    expect(card).not.toHaveProperty("gender");
    expect(card.extra).toEqual([{ name: "GENDER", parameters: [], value: "F;x;y" }]);
  });

  it("keeps a TEXT property's value verbatim when it says VALUE=uri", () => {
    const card = parseOne(
      "BEGIN:VCARD\nVERSION:4.0\nFN:A\nNOTE;VALUE=uri:http://x.example/a\\,b\nEND:VCARD\n",
    );
    expect(card.note?.[0]?.value).toBe("http://x.example/a\\,b");
  });

  it("keeps groups, unknown properties, extra singles and misfit values in extra", () => {
    const card = parseOne(
      [
        "BEGIN:VCARD",
        "VERSION:4.0",
        "FN:A",
        "item1.EMAIL;TYPE=work:a@example.com",
        "item1.X-ABLabel:Work",
        "UID:first",
        "UID:second",
        "N:a;b;c;d;e;f",
        "X-SOCIAL;TYPE=x:@a",
        "END:VCARD",
      ].join("\n"),
    );
    expect(card.email).toEqual([
      {
        value: "a@example.com",
        parameters: [{ name: "TYPE", values: ["work"] }],
        group: "item1",
      },
    ]);
    expect(card.uid?.value).toBe("first");
    expect(card.n).toBeUndefined();
    expect(card.extra?.map((line) => `${line.group ?? ""}|${line.name}|${line.value}`)).toEqual([
      "item1|X-ABLABEL|Work",
      "|UID|second",
      "|N|a;b;c;d;e;f",
      "|X-SOCIAL|@a",
    ]);
  });

  it("fails on a missing or wrong VERSION, a missing FN and malformed nesting", () => {
    expect(parseFailure("BEGIN:VCARD\nFN:A\nEND:VCARD\n").message).toBe(
      "VERSION property is required",
    );
    const v3 = parseFailure("x\nBEGIN:VCARD\nVERSION:3.0\nFN:A\nEND:VCARD\n");
    expect(v3.message).toContain('VERSION must be "4.0", got "3.0"');
    expect([v3.line, v3.column]).toEqual([2, 1]);
    expect(parseFailure("BEGIN:VCARD\nVERSION:4.0\nEND:VCARD\n").message).toBe(
      "FN property is required",
    );
    expect(parseFailure("BEGIN:VCARD\nVERSION:4.0\nFN:A\n").message).toBe("VCARD not closed");
    expect(
      parseFailure("BEGIN:VCARD\nVERSION:4.0\nBEGIN:VCARD\nEND:VCARD\nEND:VCARD\n").message,
    ).toBe("Nested VCARD is not supported");
    expect(parseFailure("END:VCARD\n").message).toBe("END:VCARD without BEGIN:VCARD");
  });

  it("locates a line that is not a content line", () => {
    const error = parseFailure("BEGIN:VCARD\nVERSION:4.0\nFN:A\nnot a line\nEND:VCARD\n");
    expect(error._tag).toBe("VCardParseError");
    expect([error.line, error.column]).toEqual([4, 1]);
  });

  it("returns no cards for empty input", () => {
    expect(parseCards("")).toEqual([]);
  });
});

describe("VCard.encodeResult", () => {
  it("writes a minimal card", () => {
    expect(encodeText(VCard.make("Jane Doe"))).toBe(
      "BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Jane Doe\r\nEND:VCARD\r\n",
    );
  });

  it("escapes TEXT and structured values, and keeps URIs verbatim", () => {
    const card: VCard.VCard = {
      ...VCard.make("Doe, Jane"),
      n: {
        value: {
          familyNames: ["Doe"],
          givenNames: ["Jane"],
          additionalNames: [],
          honorificPrefixes: ["Dr."],
          honorificSuffixes: ["PhD", "Esq; retd"],
        },
      },
      gender: { value: { sex: "F" } },
      org: [{ value: ["A, Inc.", "R&D"] }],
      tel: [{ value: "tel:+1-555;ext=1", parameters: [{ name: "VALUE", values: ["uri"] }] }],
      note: [{ value: "a\nb" }],
      email: [{ value: "jane@example.com", group: "item1" }],
      extra: [{ group: "item1", name: "X-ABLABEL", parameters: [], value: "Work" }],
    };
    expect(encodeText(card).split("\r\n")).toEqual([
      "BEGIN:VCARD",
      "VERSION:4.0",
      "FN:Doe\\, Jane",
      "N:Doe;Jane;;Dr.;PhD,Esq\\; retd",
      "GENDER:F",
      "TEL;VALUE=uri:tel:+1-555;ext=1",
      "item1.EMAIL:jane@example.com",
      "ORG:A\\, Inc.;R&D",
      "NOTE:a\\nb",
      "item1.X-ABLABEL:Work",
      "END:VCARD",
      "",
    ]);
  });

  it("round-trips RFC 6350's example and a card with every field", () => {
    const card = parseOne(rfcExample);
    expect(parseOne(encodeText(card))).toEqual(card);

    const everything = parseOne(
      [
        "BEGIN:VCARD",
        "VERSION:4.0",
        "FN;LANGUAGE=en:Jane",
        "FN;LANGUAGE=fr:Jeanne",
        "N:Doe;Jane;;;",
        "NICKNAME:JJ",
        "PHOTO:data:image/png;base64,AAAA",
        "BDAY:19700101",
        "ANNIVERSARY:20000101",
        "GENDER:F;woman",
        "ADR:;;1 Main St;Town;;123;Country",
        "TEL:+1",
        "EMAIL:a@example.com",
        "IMPP:xmpp:a@example.com",
        "LANG:en",
        "TZ:Europe/Paris",
        "GEO:geo:1,2",
        "TITLE:T",
        "ROLE:R",
        "LOGO:http://x/logo",
        "ORG:O",
        "MEMBER:urn:uuid:m",
        "RELATED;TYPE=friend:urn:uuid:r",
        "CATEGORIES:a,b",
        "NOTE:n",
        "PRODID:p",
        "REV:20240101T000000Z",
        "SOUND:http://x/s",
        "UID:u",
        "CLIENTPIDMAP:1;urn:uuid:c",
        "URL:http://x",
        "KEY:http://x/k",
        "FBURL:http://x/fb",
        "CALADRURI:mailto:a@example.com",
        "CALURI:http://x/cal",
        "KIND:individual",
        "XML:<x/>",
        "SOURCE:http://x/src",
        "X-CUSTOM:c",
        "END:VCARD",
      ].join("\r\n"),
    );
    expect(everything.extra).toEqual([{ name: "X-CUSTOM", parameters: [], value: "c" }]);
    expect(parseOne(encodeText(everything))).toEqual(everything);
  });

  it("writes several cards", () => {
    expect(parseCards(encodeText([VCard.make("A"), VCard.make("B")]))).toHaveLength(2);
  });

  it("keeps a VALUE=uri TEXT property verbatim", () => {
    const card: VCard.VCard = {
      ...VCard.make("A"),
      note: [{ value: "http://x/a,b", parameters: [{ name: "VALUE", values: ["URI"] }] }],
    };
    expect(encodeText(card)).toContain("NOTE;VALUE=URI:http://x/a,b\r\n");
  });

  it("fails on a card without FN", () => {
    const result = VCard.encodeResult(
      // A caller that bypassed the types (plain JS, a JSON payload).
      Object.assign({ ...VCard.make("A") }, { fn: [] }),
    );
    assert(Result.isFailure(result));
    expect(result.failure._tag).toBe("VCardEncodeError");
    // A JSON payload with no `fn` at all.
    const withoutFn = { ...VCard.make("A") };
    Reflect.deleteProperty(withoutFn, "fn");
    const missing = VCard.encodeResult(withoutFn);
    expect(Result.isFailure(missing)).toBe(true);
  });
});

describe("VCard accessors", () => {
  it("reads TYPE values, splitting quoted comma lists", () => {
    const card = parseOne(rfcExample);
    expect(card.tel?.map(VCard.types)).toEqual([
      ["work", "voice"],
      ["work", "cell", "voice", "video", "text"],
    ]);
  });

  it("picks the preferred property", () => {
    const card = parseOne(rfcExample);
    expect(Option.map(VCard.preferred(card.lang ?? []), (lang) => lang.value)).toEqual(
      Option.some("fr"),
    );
    expect(
      VCard.preferred([
        { value: "a" },
        { value: "b", parameters: [{ name: "PREF", values: ["50"] }] },
      ]),
    ).toEqual(Option.some({ value: "b", parameters: [{ name: "PREF", values: ["50"] }] }));
    expect(VCard.preferred([])).toEqual(Option.none());
  });
});

describe("VCard Effect API", () => {
  it("parses and encodes when run", async () => {
    const cards = await runTest(VCard.parse(rfcExample));
    expect(cards).toHaveLength(1);
    const text = await runTest(VCard.encode(cards));
    expect(text.startsWith("BEGIN:VCARD\r\nVERSION:4.0\r\n")).toBe(true);
  });
});
