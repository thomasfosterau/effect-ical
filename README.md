# effect-ical

A modern iCalendar (RFC 5545) library for JavaScript/TypeScript using Effect idioms. This library provides type-safe encoding and decoding of iCalendar files with comprehensive support for the iCal format.

## Features

- 🎯 **Type-safe**: Full TypeScript support with comprehensive type definitions
- 🔄 **Effect-based**: Built using Effect idioms for functional, composable operations
- 📅 **RFC 5545 Compliant**: Implements the iCalendar format specification
- ✅ **Encode/Decode**: Full support for encoding and decoding iCalendar files
- 🧩 **Component Support**: VEVENT, VTODO, VJOURNAL, VFREEBUSY, VTIMEZONE, and VALARM
- ⚡ **Built with Bun**: Fast development and testing with Bun runtime
- 📦 **Changesets**: Versioning with changesets for clean release management

## Installation

```bash
npm install effect-ical effect
```

or with Bun:

```bash
bun add effect-ical effect
```

## Usage

### Parsing iCalendar Files

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

### Working with Events

```typescript
import type { VEvent, VAlarm } from "effect-ical";

// Create an event with an alarm
const event: VEvent = {
  component: "VEVENT",
  uid: "event456",
  dtstart: "20240115T090000Z",
  dtend: "20240115T100000Z",
  summary: "Doctor Appointment",
  location: "Medical Center",
  status: "CONFIRMED",
  priority: 1,
  alarms: [
    {
      component: "VALARM",
      action: "DISPLAY",
      trigger: "-PT15M", // 15 minutes before
      description: "Appointment reminder",
    },
  ],
};
```

### Working with Todos

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
- Updates from RFC 5546, RFC 6868, RFC 7529, and RFC 7986

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
