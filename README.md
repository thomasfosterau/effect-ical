# @thomasfosterau/effect-ical

iCalendar ([RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545)) and vCard ([RFC 6350](https://datatracker.ietf.org/doc/html/rfc6350)) encoding and decoding for [Effect](https://effect.website): a typed object model, a parser and encoder, fluent builders and pipeable `Calendar` / `Event` / `Todo` modules.

> [!CAUTION]
> Experimental and pre-1.0, largely written with Claude Code. The API may change between minor versions.

## Install

```sh
pnpm add @thomasfosterau/effect-ical @thomasfosterau/effect-parse effect
```

`effect` (`^4.0.0`) and `@thomasfosterau/effect-parse` (`^0.5.0`) are peer dependencies. ESM only.

## Example

```ts
import { encodeSync, parse } from "@thomasfosterau/effect-ical";
import * as Effect from "effect/Effect";

const text = encodeSync({
  component: "VCALENDAR",
  version: "2.0",
  prodid: "-//Example Corp//Example App//EN",
  events: [{ component: "VEVENT", dtstart: "20240115T100000Z", summary: "Team standup" }],
});

const summary = parse(text).pipe(Effect.map((calendar) => calendar.events?.[0]?.summary));
```

## Links

- [API reference](https://unpkg.com/@thomasfosterau/effect-ical/docs/api.md) ([`docs/api.md`](docs/api.md))
- [Contributing](docs/CONTRIBUTING.md), [security](docs/SECURITY.md), [publishing](docs/PUBLISHING.md)
- License: [MIT](LICENSE.md)
