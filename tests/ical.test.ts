/**
 * Tests for the iCalendar encoder and parser
 */

import { describe, it, expect } from "bun:test";
import { parseEither } from "../src/parser";
import { encodeSync } from "../src/encoder";
import type { VCalendar, VEvent } from "../src/types";

describe("iCalendar Parser", () => {
  it("should parse a simple VCALENDAR", () => {
    const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
END:VCALENDAR
`;

    const result = parseEither(ical);
    expect(result._tag).toBe("Right");
    
    if (result._tag === "Right") {
      const calendar = result.right;
      expect(calendar.component).toBe("VCALENDAR");
      expect(calendar.version).toBe("2.0");
      expect(calendar.prodid).toBe("-//Test//Test//EN");
    }
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

    const result = parseEither(ical);
    expect(result._tag).toBe("Right");

    if (result._tag === "Right") {
      const calendar = result.right;
      expect(calendar.events).toBeDefined();
      expect(calendar.events?.length).toBe(1);
      
      const event = calendar.events?.[0];
      expect(event?.uid).toBe("event123");
      expect(event?.dtstart).toBe("20240101T120000Z");
      expect(event?.dtend).toBe("20240101T130000Z");
      expect(event?.summary).toBe("Test Event");
      expect(event?.description).toBe("This is a test event");
      expect(event?.location).toBe("Test Location");
    }
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

    const result = parseEither(ical);
    expect(result._tag).toBe("Right");

    if (result._tag === "Right") {
      const event = result.right.events?.[0];
      expect(event?.summary).toBe("This is a very long summary that has been folded according to RFC 5545 line folding rules");
    }
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

    const result = parseEither(ical);
    expect(result._tag).toBe("Right");

    if (result._tag === "Right") {
      const calendar = result.right;
      expect(calendar.events?.length).toBe(2);
      expect(calendar.events?.[0]?.uid).toBe("event1");
      expect(calendar.events?.[1]?.uid).toBe("event2");
    }
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

    const result = parseEither(ical);
    expect(result._tag).toBe("Right");

    if (result._tag === "Right") {
      const event = result.right.events?.[0];
      expect(event?.alarms).toBeDefined();
      expect(event?.alarms?.length).toBe(1);
      expect(event?.alarms?.[0]?.action).toBe("DISPLAY");
      expect(event?.alarms?.[0]?.trigger).toBe("-PT15M");
    }
  });

  it("should fail on invalid iCalendar (missing VERSION)", () => {
    const ical = `BEGIN:VCALENDAR
PRODID:-//Test//Test//EN
END:VCALENDAR
`;

    const result = parseEither(ical);
    expect(result._tag).toBe("Left");
  });

  it("should fail on invalid iCalendar (missing PRODID)", () => {
    const ical = `BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR
`;

    const result = parseEither(ical);
    expect(result._tag).toBe("Left");
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
      summary: "This is a very long summary that should be folded according to RFC 5545 line folding rules to ensure proper formatting",
    };

    const calendar: VCalendar = {
      component: "VCALENDAR",
      version: "2.0",
      prodid: "-//Test//Test//EN",
      events: [event],
    };

    const ical = encodeSync(calendar);
    const lines = ical.split("\r\n");
    
    // Check that no line exceeds 75 characters (except continuation lines)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && !line.startsWith(" ")) {
        expect(line.length).toBeLessThanOrEqual(75);
      }
    }
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
    const result = parseEither(encoded);

    expect(result._tag).toBe("Right");
    if (result._tag === "Right") {
      const parsed = result.right;
      expect(parsed.version).toBe(original.version);
      expect(parsed.prodid).toBe(original.prodid);
      expect(parsed.events?.length).toBe(1);
      expect(parsed.events?.[0]?.uid).toBe("event123");
      expect(parsed.events?.[0]?.summary).toBe("Test Event");
    }
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
    const result = parseEither(encoded);

    expect(result._tag).toBe("Right");
    if (result._tag === "Right") {
      const parsed = result.right;
      expect(parsed.version).toBe(original.version);
      expect(parsed.prodid).toBe(original.prodid);
      expect(parsed.calscale).toBe(original.calscale);
      expect(parsed.name).toBe(original.name);
      expect(parsed.events?.length).toBe(2);
      expect(parsed.todos?.length).toBe(1);
    }
  });
});
