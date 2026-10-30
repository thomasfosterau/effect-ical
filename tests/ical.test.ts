/**
 * Tests for the iCalendar encoder and parser
 */

import { assert, describe, expect, it } from "vite-plus/test";
import * as Result from "effect/Result";
import { parseResult } from "../src/parser";
import { encodeSync } from "../src/encoder";
import type { VCalendar, VEvent } from "../src/types";

describe("iCalendar Parser", () => {
  it("should parse a simple VCALENDAR", () => {
    const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
END:VCALENDAR
`;

    const result = parseResult(ical);
    assert(Result.isSuccess(result));
    const calendar = result.success;
    expect(calendar.component).toBe("VCALENDAR");
    expect(calendar.version).toBe("2.0");
    expect(calendar.prodid).toBe("-//Test//Test//EN");
  });

  it("should parse a VCALENDAR with VEVENT", () => {
    const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:event123
DTSTART:20240101T120000Z
DTEND:20240101T130000Z
SUMMARY:Test Event
DESCRIPTION:This is a test event
LOCATION:Test Location
END:VEVENT
END:VCALENDAR
`;

    const result = parseResult(ical);
    assert(Result.isSuccess(result));
    const calendar = result.success;
    expect(calendar.events).toBeDefined();
    expect(calendar.events?.length).toBe(1);

    const event = calendar.events?.[0];
    expect(event?.uid).toBe("event123");
    expect(event?.dtstart).toBe("20240101T120000Z");
    expect(event?.dtend).toBe("20240101T130000Z");
    expect(event?.summary).toBe("Test Event");
    expect(event?.description).toBe("This is a test event");
    expect(event?.location).toBe("Test Location");
  });

  it("should parse folded lines correctly", () => {
    const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:event123
DTSTART:20240101T120000Z
SUMMARY:This is a very long summary that has been folded according to RFC 5
 545 line folding rules
END:VEVENT
END:VCALENDAR
`;

    const result = parseResult(ical);
    assert(Result.isSuccess(result));
    const event = result.success.events?.[0];
    expect(event?.summary).toBe(
      "This is a very long summary that has been folded according to RFC 5545 line folding rules",
    );
  });

  it("should parse multiple events", () => {
    const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:event1
DTSTART:20240101T120000Z
SUMMARY:Event 1
END:VEVENT
BEGIN:VEVENT
UID:event2
DTSTART:20240102T120000Z
SUMMARY:Event 2
END:VEVENT
END:VCALENDAR
`;

    const result = parseResult(ical);
    assert(Result.isSuccess(result));
    const calendar = result.success;
    expect(calendar.events?.length).toBe(2);
    expect(calendar.events?.[0]?.uid).toBe("event1");
    expect(calendar.events?.[1]?.uid).toBe("event2");
  });

  it("should parse events with alarms", () => {
    const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:event123
DTSTART:20240101T120000Z
SUMMARY:Event with Alarm
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-PT15M
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
END:VCALENDAR
`;

    const result = parseResult(ical);
    assert(Result.isSuccess(result));
    const event = result.success.events?.[0];
    expect(event?.alarms).toBeDefined();
    expect(event?.alarms?.length).toBe(1);
    expect(event?.alarms?.[0]?.action).toBe("DISPLAY");
    expect(event?.alarms?.[0]?.trigger).toBe("-PT15M");
  });

  it("should fail on invalid iCalendar (missing VERSION)", () => {
    const ical = `BEGIN:VCALENDAR
PRODID:-//Test//Test//EN
END:VCALENDAR
`;

    expect(Result.isFailure(parseResult(ical))).toBe(true);
  });

  it("should fail on invalid iCalendar (missing PRODID)", () => {
    const ical = `BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR
`;

    expect(Result.isFailure(parseResult(ical))).toBe(true);
  });

  it("locates a line without a colon (#7)", () => {
    const ical =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n\r\nPRODID:-//Test//EN\r\nBEGIN:VEVENT\r\nSUMMARY:a\r\n  folded\r\nno colon here\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    const result = parseResult(ical);
    assert(Result.isFailure(result));
    // The message keeps the unfolded line's index; the position counts every
    // physical line, the empty one and the fold included.
    expect(result.failure.message).toBe(
      "Error parsing content line at index 5: Invalid content line: no colon here",
    );
    expect(result.failure.line).toBe(8);
    expect(result.failure.column).toBe(1);
  });

  it("locates an unclosed component at its BEGIN line (#7)", () => {
    const ical = "junk\nBEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//EN\n";
    const result = parseResult(ical);
    assert(Result.isFailure(result));
    expect(result.failure.message).toBe("Component VCALENDAR not closed");
    expect(result.failure.line).toBe(2);
    expect(result.failure.column).toBe(1);
  });

  it("leaves errors that belong to no line unlocated (#7)", () => {
    const result = parseResult("no calendar here");
    assert(Result.isFailure(result));
    expect(result.failure.line).toBeUndefined();
    expect(result.failure.column).toBeUndefined();
  });

  it("keeps a lone CR as line content and drops empty lines (#7)", () => {
    const ical =
      "\r\n\nBEGIN:VCALENDAR\nVERSION:2.0\r\n\r\n\nPRODID:a\rb\nNAME:x\n\n\ty\r\nEND:VCALENDAR";
    const result = parseResult(ical);
    assert(Result.isSuccess(result));
    expect(result.success.prodid).toBe("a\rb");
    expect(result.success.name).toBe("xy");
  });
});

describe("iCalendar Encoder", () => {
  it("should encode a simple VCALENDAR", () => {
    const calendar: VCalendar = {
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//Test//EN",
    };

    const ical = encodeSync(calendar);
    expect(ical).toContain("BEGIN:VCALENDAR");
    expect(ical).toContain("VERSION:2.0");
    expect(ical).toContain("PRODID:-//Test//Test//EN");
    expect(ical).toContain("END:VCALENDAR");
  });

  it("should encode a VCALENDAR with VEVENT", () => {
    const event: VEvent = {
      component: "VEVENT",
      uid: "event123",
      dtstart: "20240101T120000Z",
      dtend: "20240101T130000Z",
      summary: "Test Event",
      description: "This is a test event",
      location: "Test Location",
    };

    const calendar: VCalendar = {
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//Test//EN",
      events: [event],
    };

    const ical = encodeSync(calendar);
    expect(ical).toContain("BEGIN:VEVENT");
    expect(ical).toContain("UID:event123");
    expect(ical).toContain("DTSTART:20240101T120000Z");
    expect(ical).toContain("DTEND:20240101T130000Z");
    expect(ical).toContain("SUMMARY:Test Event");
    expect(ical).toContain("DESCRIPTION:This is a test event");
    expect(ical).toContain("LOCATION:Test Location");
    expect(ical).toContain("END:VEVENT");
  });

  it("should fold long lines", () => {
    const event: VEvent = {
      component: "VEVENT",
      uid: "long-event-123",
      dtstart: "20240101T120000Z",
      summary:
        "This is a very long summary that should be folded according to RFC 5545 line folding rules to ensure proper formatting",
    };

    const calendar: VCalendar = {
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//Test//EN",
      events: [event],
    };

    const ical = encodeSync(calendar);
    // No physical line exceeds 75 octets; continuation lines start with a space.
    const lines = ical.split("\r\n");
    expect(lines.filter((line) => line.length > 75)).toEqual([]);
    expect(lines.filter((line) => line.startsWith(" ")).length).toBeGreaterThan(0);
  });

  it("should escape special characters", () => {
    const event: VEvent = {
      component: "VEVENT",
      dtstart: "20240101T120000Z",
      summary: "Test; Event, with\\special\ncharacters",
    };

    const calendar: VCalendar = {
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//Test//EN",
      events: [event],
    };

    const ical = encodeSync(calendar);
    expect(ical).toContain("\\;");
    expect(ical).toContain("\\,");
    expect(ical).toContain("\\\\");
    expect(ical).toContain("\\n");
  });

  it("should encode events with alarms", () => {
    const event: VEvent = {
      component: "VEVENT",
      dtstart: "20240101T120000Z",
      summary: "Event with Alarm",
      alarms: [
        {
          component: "VALARM",
          action: "DISPLAY",
          trigger: "-PT15M",
          description: "Reminder",
        },
      ],
    };

    const calendar: VCalendar = {
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//Test//EN",
      events: [event],
    };

    const ical = encodeSync(calendar);
    expect(ical).toContain("BEGIN:VALARM");
    expect(ical).toContain("ACTION:DISPLAY");
    expect(ical).toContain("TRIGGER:-PT15M");
    expect(ical).toContain("DESCRIPTION:Reminder");
    expect(ical).toContain("END:VALARM");
  });
});

describe("Round-trip encoding and parsing", () => {
  it("should round-trip a simple calendar", () => {
    const original: VCalendar = {
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//Test//EN",
      events: [
        {
          component: "VEVENT",
          uid: "event123",
          dtstart: "20240101T120000Z",
          dtend: "20240101T130000Z",
          summary: "Test Event",
        },
      ],
    };

    const encoded = encodeSync(original);
    const result = parseResult(encoded);
    assert(Result.isSuccess(result));
    const parsed = result.success;
    expect(parsed.version).toBe(original.version);
    expect(parsed.prodid).toBe(original.prodid);
    expect(parsed.events?.length).toBe(1);
    expect(parsed.events?.[0]?.uid).toBe("event123");
    expect(parsed.events?.[0]?.summary).toBe("Test Event");
  });

  it("should round-trip a complex calendar with multiple components", () => {
    const original: VCalendar = {
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//Test//EN",
      calscale: "GREGORIAN",
      name: "Test Calendar",
      events: [
        {
          component: "VEVENT",
          uid: "event1",
          dtstart: "20240101T120000Z",
          dtend: "20240101T130000Z",
          summary: "Event 1",
          description: "First event",
          location: "Office",
          status: "CONFIRMED",
          priority: 5,
        },
        {
          component: "VEVENT",
          uid: "event2",
          dtstart: "20240102T140000Z",
          summary: "Event 2",
          alarms: [
            {
              component: "VALARM",
              action: "DISPLAY",
              trigger: "-PT15M",
            },
          ],
        },
      ],
      todos: [
        {
          component: "VTODO",
          uid: "todo1",
          dtstart: "20240103T090000Z",
          summary: "Task 1",
          status: "NEEDS-ACTION",
          priority: 1,
        },
      ],
    };

    const encoded = encodeSync(original);
    const result = parseResult(encoded);
    assert(Result.isSuccess(result));
    const parsed = result.success;
    expect(parsed.version).toBe(original.version);
    expect(parsed.prodid).toBe(original.prodid);
    expect(parsed.calscale).toBe(original.calscale);
    expect(parsed.name).toBe(original.name);
    expect(parsed.events?.length).toBe(2);
    expect(parsed.todos?.length).toBe(1);
  });
});

const priorityOf = (value: string) => {
  const result = parseResult(
    `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:x\nBEGIN:VEVENT\nDTSTART:1\nPRIORITY:${value}\nEND:VEVENT\nEND:VCALENDAR\n`,
  );
  assert(Result.isSuccess(result));
  return result.success.events?.[0]?.priority;
};

describe("numeric properties", () => {
  it("reads a leading integer, as parseInt did", () => {
    expect(priorityOf("5")).toBe(5);
    expect(priorityOf(" +7")).toBe(7);
    expect(priorityOf("-3")).toBe(-3);
    expect(priorityOf("12abc")).toBe(12);
  });

  it("keeps text that does not start with a safe integer", () => {
    expect(priorityOf("high")).toBe("high");
    expect(priorityOf("")).toBe("");
    expect(priorityOf("99999999999999999999")).toBe("99999999999999999999");
  });
});

const roundTrip = (calendar: VCalendar): VCalendar => {
  const result = parseResult(encodeSync(calendar));
  assert(Result.isSuccess(result));
  return result.success;
};

describe("TEXT round-trip (#23)", () => {
  it("unescapes TEXT values the encoder escaped", () => {
    const tricky = "Lunch; then 1:1, at C:\\Temp\nBring notes";
    const calendar: VCalendar = {
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//EN",
      name: tricky,
      description: tricky,
      timezones: [
        {
          component: "VTIMEZONE",
          tzid: "X",
          standard: [
            {
              dtstart: "19700101T000000",
              tzoffsetfrom: "+0000",
              tzoffsetto: "+0000",
              tzname: tricky,
            },
          ],
        },
      ],
      events: [
        {
          component: "VEVENT",
          dtstart: "20240101T120000Z",
          summary: tricky,
          description: tricky,
          location: tricky,
          categories: ["Work, mostly", "Back\\slash", "Plain"],
        },
      ],
    };
    const parsed = roundTrip(calendar);
    expect(parsed.name).toBe(tricky);
    expect(parsed.description).toBe(tricky);
    expect(parsed.timezones?.[0]?.standard?.[0]?.tzname).toBe(tricky);
    expect(parsed.events?.[0]).toMatchObject({
      summary: tricky,
      description: tricky,
      location: tricky,
      categories: ["Work, mostly", "Back\\slash", "Plain"],
    });
  });

  it("is stable: encode ∘ parse ∘ encode equals encode", () => {
    const calendar: VCalendar = {
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//EN",
      events: [
        {
          component: "VEVENT",
          dtstart: "20240101T120000Z",
          summary: "a\\b;c,d\ne",
          categories: ["x,y", "z"],
        },
      ],
    };
    const once = encodeSync(calendar);
    expect(encodeSync(roundTrip(calendar))).toBe(once);
  });

  it("reads \\N as a newline and keeps unknown escapes", () => {
    const result = parseResult(
      "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:x\nBEGIN:VEVENT\nDTSTART:1\nSUMMARY:a\\Nb\\tc\nEND:VEVENT\nEND:VCALENDAR\n",
    );
    assert(Result.isSuccess(result));
    expect(result.success.events?.[0]?.summary).toBe("a\nb\\tc");
  });
});
