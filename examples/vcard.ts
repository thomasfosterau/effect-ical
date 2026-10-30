/**
 * vCard 4.0: parse a contact export, read its typed fields, add a card and
 * encode them all back.
 *
 * `tests/examples.test.ts` runs it (with `vp run test:unit`), so it is proved
 * to run against the current API.
 */

import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { VCard } from "../src/index.js";

const contacts = [
  "BEGIN:VCARD",
  "VERSION:4.0",
  "FN:Jane Doe",
  "N:Doe;Jane;;Dr.;",
  "EMAIL;TYPE=home;PREF=2:jane@home.example",
  "EMAIL;TYPE=work;PREF=1:jane@work.example",
  "ORG:Example\\, Inc.;Engineering",
  "item1.URL:https://jane.example",
  "item1.X-ABLabel:Blog",
  "END:VCARD",
  "",
].join("\r\n");

/** Runs this example, logging through the `Console` service. */
export const main = Effect.fn("examples/vcard")(function* () {
  const [jane] = yield* VCard.parse(contacts);
  if (jane === undefined) {
    return;
  }
  yield* Console.log(`Name: ${jane.fn[0].value}`);
  yield* Console.log(`Given name: ${jane.n?.value.givenNames.join(" ") ?? "?"}`);
  yield* Console.log(`Organisation: ${jane.org?.[0]?.value.join(" / ") ?? "?"}`);
  const email = VCard.preferred(jane.email ?? []).pipe(
    Option.map((property) => `${property.value} (${VCard.types(property).join(", ")})`),
    Option.getOrElse(() => "none"),
  );
  yield* Console.log(`Preferred email: ${email}`);
  yield* Console.log(`Kept as extra: ${(jane.extra ?? []).map((line) => line.name).join(", ")}`);

  const john: VCard.VCard = {
    ...VCard.make("John Doe"),
    tel: [{ value: "tel:+1-555-0100", parameters: [{ name: "VALUE", values: ["uri"] }] }],
  };
  const text = yield* VCard.encode([jane, john]);
  yield* Console.log(`\nEncoded ${text.split("BEGIN:VCARD").length - 1} cards:\n${text}`);
});
