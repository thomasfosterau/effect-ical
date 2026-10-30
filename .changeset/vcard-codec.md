---
"@thomasfosterau/effect-ical": minor
---

Add `VCard`, a vCard 4.0 (RFC 6350) codec on the shared `ContentLine` layer (#26):

- `parse` / `parseResult` read every card in a `.vcf` input. Groups and parameters are kept; TEXT values are unescaped; `N`, `ADR`, `ORG` and `GENDER` are structured; URIs and dates stay verbatim.
- `encode` / `encodeResult` write one card or many.
- `make`, `types` and `preferred` are helpers.
- Nothing is lost: untyped properties, extra occurrences of at-most-once properties and misfit structured values are kept in `extra`.
- Failures are `VCardParseError` (with `line` / `column`) and `VCardEncodeError`.
