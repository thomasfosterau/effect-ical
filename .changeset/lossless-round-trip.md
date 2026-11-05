---
"@thomasfosterau/effect-ical": minor
---

Round-trip unknown properties and components losslessly (#24). Every component gains optional `extra` (the properties it does not type, such as `X-WR-CALNAME`, `SEQUENCE`, `CREATED`, `TRANSP`, `GEO` and `FREEBUSY`, as `ContentLine` values in their original order with raw values and parameters) and `components` (sub-components of a type it does not hold, such as `VAVAILABILITY` or `X-` components, verbatim as the new `UnknownComponent` type). The encoder writes both back, so `encode(parse(text))` keeps every line. The lower-cased untyped fields the parser already produced stay as they were.

The encoder now writes `geo` and `freebusy` only when they hold the structures the model types. Before, encoding a parsed event with `GEO` wrote `GEO:undefined;undefined`, and a parsed `VFREEBUSY` with `FREEBUSY` threw.
