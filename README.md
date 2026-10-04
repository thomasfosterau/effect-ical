# @thomasfosterau/effect-ical

A modern iCalendar (RFC 5545) library for JavaScript/TypeScript using Effect idioms. This library provides type-safe encoding and decoding of iCalendar files with comprehensive support for the iCal format.

## Features

- 🎯 **Type-safe**: Full TypeScript support with Effect Schema
- 🔄 **Effect-based**: Built using Effect idioms for functional, composable operations
- 📦 **Module Namespaces**: Clean API with Calendar, Event, and Todo modules
- 🔗 **Pipe API**: Composable functions using Effect's pipe for building calendars
- 📅 **RFC 5545 Compliant**: Implements the iCalendar format specification
- ✅ **Encode/Decode**: Full support for encoding and decoding iCalendar files
- 🧩 **Component Support**: VEVENT, VTODO, VJOURNAL, VFREEBUSY, VTIMEZONE, and VALARM
- ⚡ **Built with Bun**: Fast development and testing with Bun runtime
- 📦 **Changesets**: Versioning with changesets for clean release management

## Installation

```bash
npm install @thomasfosterau/effect-ical effect
```

or with Bun:

```bash
bun add @thomasfosterau/effect-ical effect
```

## Usage

### Effect-Style API (Recommended)

The Effect-style API uses module namespaces and pipe for composable calendar operations:

```typescript
import { pipe } from "effect";
import * as Calendar from "@thomasfosterau/effect-ical/Calendar";
import * as Event from "@thomasfosterau/effect-ical/Event";
import * as Todo from "@thomasfosterau/effect-ical/Todo";

// Create an event with pipe
const event = pipe(
  Event.make("20240115T100000Z"),
  Event.withUid("event-001"),
  Event.withSummary("Team Standup"),
  Event.withDtend("20240115T110000Z"),
  Event.withLocation("Conference Room A"),
  Event.withStatus("CONFIRMED")
);

// Create a todo with pipe
const todo = pipe(
  Todo.make(),
  Todo.withUid("todo-001"),
  Todo.withSummary("Complete proposal"),
  Todo.withDue("20240120T170000Z"),
  Todo.withStatus("IN-PROCESS"),
  Todo.withPercent(60)
);

// Build a calendar with pipe
const calendar = pipe(
  Calendar.builder(),
  Calendar.withProdid("-//My Company//My App//EN"),
  Calendar.withName("Work Calendar"),
  Calendar.withEvent(event),
  Calendar.withTodo(todo),
  Calendar.build
);

// Encode to iCal format
const program = Calendar.encode(calendar);
const icalString = await Effect.runPromise(program);
console.log(icalString);
```

### Decoding iCalendar Files

```typescript
import * as Calendar from "@thomasfosterau/effect-ical/Calendar";
import { Effect } from "effect";

const icalString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//My Company//My Product//EN
BEGIN:VEVENT
UID:event123
DTSTART:20240101T120000Z
DTEND:20240101T130000Z
SUMMARY:Team Meeting
DESCRIPTION:Monthly team sync
LOCATION:Conference Room A
END:VEVENT
END:VCALENDAR
`;

// Decode using Effect
const program = Calendar.decode(icalString);
const calendar = await Effect.runPromise(program);
console.log(calendar.events?.[0]?.summary); // Logs event details
```

### Legacy APIs (Backward Compatibility)

The library still includes the previous APIs for backward compatibility:

#### Fluent Builder API

```typescript
import { createCalendar } from "@thomasfosterau/effect-ical";

const icalString = createCalendar("-//My Company//My Product//EN")
  .name("Work Calendar")
  .event((e) =>
    e
      .uid("event123")
      .dtstart("20240101T120000Z")
      .summary("Team Meeting")
  )
  .toICalString();
```

#### Low-Level Parser/Encoder API

```typescript
import { parse, parseEither } from "effect-ical";
import { Effect } from "effect";

// Using Effect
const icalString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//My Company//My Product//EN
BEGIN:VEVENT
UID:event123
DTSTART:20240101T120000Z
DTEND:20240101T130000Z
SUMMARY:Team Meeting
DESCRIPTION:Monthly team sync
LOCATION:Conference Room A
END:VEVENT
END:VCALENDAR
`;

// Parse using Effect
const program = parse(icalString);
const calendar = await Effect.runPromise(program);

// Or use Either for synchronous parsing
const result = parseEither(icalString);
if (result._tag === "Right") {
  const calendar = result.right;
  console.log(calendar.events?.[0]?.summary); // "Team Meeting"
}
```

### Encoding iCalendar Files

```typescript
import { encode, encodeSync } from "effect-ical";
import type { VCalendar, VEvent } from "effect-ical";

// Create a calendar
const calendar: VCalendar = {
  component: "VCALENDAR",
  version: "2.0",
  prodid: "-//My Company//My Product//EN",
  events: [
    {
      component: "VEVENT",
      uid: "event123",
      dtstart: "20240101T120000Z",
      dtend: "20240101T130000Z",
      summary: "Team Meeting",
      description: "Monthly team sync",
      location: "Conference Room A",
    },
  ],
};

// Encode synchronously
const icalString = encodeSync(calendar);
console.log(icalString);

// Or use Effect
const program = encode(calendar);
const icalString2 = await Effect.runPromise(program);
```

### Working with Events (Builder API)

```typescript
import { createEvent } from "effect-ical";

// Create an event independently
const event = createEvent()
  .uid("event456")
  .dtstart("20240115T090000Z")
  .dtend("20240115T100000Z")
  .summary("Doctor Appointment")
  .location("Medical Center")
  .status("CONFIRMED")
  .priority(1)
  .addDisplayAlarm("-PT15M", "Appointment reminder")
  .build();
```

### Working with Todos (Builder API)

```typescript
import { createTodo } from "effect-ical";

const todo = createTodo()
  .uid("todo789")
  .dtstart("20240201T090000Z")
  .due("20240205T170000Z")
  .summary("Complete project documentation")
  .status("IN-PROCESS")
  .percentComplete(50)
  .priority(2)
  .build();
```

### Low-Level API (Direct Object Creation)

You can also create calendars directly using TypeScript objects:

```typescript
import { encodeSync } from "effect-ical";
import type { VCalendar, VEvent } from "effect-ical";

const calendar: VCalendar = {
  component: "VCALENDAR",
  version: "2.0",
  prodid: "-//My Company//My Product//EN",
  events: [
    {
      component: "VEVENT",
      uid: "event123",
      dtstart: "20240101T120000Z",
      dtend: "20240101T130000Z",
      summary: "Team Meeting",
      alarms: [
        {
          component: "VALARM",
          action: "DISPLAY",
          trigger: "-PT15M",
          description: "Appointment reminder",
        },
      ],
    },
  ],
};

const icalString = encodeSync(calendar);
```

### Working with Todos (Low-Level API)

```typescript
import type { VTodo } from "effect-ical";

const todo: VTodo = {
  component: "VTODO",
  uid: "todo789",
  dtstart: "20240201T090000Z",
  due: "20240205T170000Z",
  summary: "Complete project documentation",
  status: "IN-PROCESS",
  percent: 50,
  priority: 2,
};
```

### Complete Example

```typescript
import { parseEither, encodeSync } from "effect-ical";
import type { VCalendar } from "effect-ical";

// Parse an iCal file
const icalInput = `...`; // Your iCal string
const parseResult = parseEither(icalInput);

if (parseResult._tag === "Right") {
  const calendar = parseResult.right;
  
  // Modify the calendar
  if (calendar.events) {
    calendar.events[0].summary = "Updated Meeting Title";
  }
  
  // Encode back to iCal format
  const icalOutput = encodeSync(calendar);
  console.log(icalOutput);
}
```

## Supported Components

- **VCALENDAR**: Top-level calendar container
- **VEVENT**: Calendar events
- **VTODO**: Todo items/tasks
- **VJOURNAL**: Journal entries
- **VFREEBUSY**: Free/busy time information
- **VTIMEZONE**: Timezone definitions
- **VALARM**: Alarms/reminders

## RFC Compliance

This library implements:
- **RFC 5545**: Internet Calendaring and Scheduling Core Object Specification (iCalendar)

Note: Updates from RFC 5546, RFC 6868, RFC 7529, and RFC 7986 are not yet fully implemented.

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build

# Create a changeset
bun run changeset
```

## API Reference

### Types

All component types are exported from the main module:
- `VCalendar` - Main calendar object
- `VEvent` - Event component
- `VTodo` - Todo component
- `VJournal` - Journal component
- `VFreeBusy` - Free/busy component
- `VTimezone` - Timezone component
- `VAlarm` - Alarm component

### Functions

#### `parse(icalString: string): Effect<VCalendar, ParseError>`
Parse an iCalendar string into a VCalendar object using Effect.

#### `parseEither(icalString: string): Either<VCalendar, ParseError>`
Parse an iCalendar string synchronously, returning Either.

#### `encode(calendar: VCalendar): Effect<string, EncodeError>`
Encode a VCalendar object into an iCalendar string using Effect.

#### `encodeSync(calendar: VCalendar): string`
Encode a VCalendar object into an iCalendar string synchronously.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
