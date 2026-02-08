/**
 * Encoder for iCalendar format (RFC 5545) using Effect idioms
 */

import { Effect } from "effect";
import type * as Types from "./types.js";

/**
 * Encode errors
 */
export class EncodeError {
  readonly _tag = "EncodeError";
  constructor(readonly message: string) {}
}

/**
 * Fold lines according to RFC 5545 (3.1)
 * Lines should be no longer than 75 octets (excluding CRLF)
 */
const foldLine = (line: string): string => {
  if (line.length <= 75) {
    return line;
  }

  const lines: string[] = [];
  let remaining = line;

  // First line can be up to 75 characters
  lines.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);

  // Continuation lines start with a space and can be 74 characters (75 - 1 for space)
  while (remaining.length > 0) {
    lines.push(" " + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }

  return lines.join("\r\n");
};

/**
 * Escape special characters in text values
 */
const escapeValue = (value: string): string => {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
};

/**
 * Format a content line
 */
const formatContentLine = (name: string, value: string, params?: Record<string, string>): string => {
  let line = name.toUpperCase();

  if (params) {
    for (const [key, val] of Object.entries(params)) {
      line += `;${key.toUpperCase()}=${val}`;
    }
  }

  line += `:${value}`;
  return foldLine(line);
};

/**
 * Encode an alarm component
 */
const encodeAlarm = (alarm: Types.VAlarm): string[] => {
  const lines: string[] = [];

  lines.push("BEGIN:VALARM");
  lines.push(formatContentLine("ACTION", alarm.action));
  lines.push(formatContentLine("TRIGGER", alarm.trigger));

  if (alarm.duration) {
    lines.push(formatContentLine("DURATION", alarm.duration));
  }
  if (alarm.repeat !== undefined) {
    lines.push(formatContentLine("REPEAT", alarm.repeat.toString()));
  }
  if (alarm.description) {
    lines.push(formatContentLine("DESCRIPTION", escapeValue(alarm.description)));
  }
  if (alarm.summary) {
    lines.push(formatContentLine("SUMMARY", escapeValue(alarm.summary)));
  }
  if (alarm.attendee) {
    for (const attendee of alarm.attendee) {
      lines.push(formatContentLine("ATTENDEE", attendee));
    }
  }
  if (alarm.attach) {
    lines.push(formatContentLine("ATTACH", alarm.attach));
  }

  lines.push("END:VALARM");
  return lines;
};

/**
 * Encode a VEVENT component
 */
const encodeEvent = (event: Types.VEvent): string[] => {
  const lines: string[] = [];

  lines.push("BEGIN:VEVENT");

  // Required properties
  if (!event.dtstart) {
    throw new EncodeError("VEVENT requires DTSTART property");
  }
  lines.push(formatContentLine("DTSTART", event.dtstart));

  // Optional properties
  if (event.uid) {
    lines.push(formatContentLine("UID", event.uid));
  }
  if (event.dtstamp) {
    lines.push(formatContentLine("DTSTAMP", event.dtstamp));
  }
  if (event.dtend) {
    lines.push(formatContentLine("DTEND", event.dtend));
  }
  if (event.duration) {
    lines.push(formatContentLine("DURATION", event.duration));
  }
  if (event.summary) {
    lines.push(formatContentLine("SUMMARY", escapeValue(event.summary)));
  }
  if (event.description) {
    lines.push(formatContentLine("DESCRIPTION", escapeValue(event.description)));
  }
  if (event.location) {
    lines.push(formatContentLine("LOCATION", escapeValue(event.location)));
  }
  if (event.organizer) {
    lines.push(formatContentLine("ORGANIZER", event.organizer));
  }
  if (event.attendee) {
    for (const attendee of event.attendee) {
      lines.push(formatContentLine("ATTENDEE", attendee));
    }
  }
  if (event.categories) {
    lines.push(formatContentLine("CATEGORIES", event.categories.join(",")));
  }
  if (event.status) {
    lines.push(formatContentLine("STATUS", event.status));
  }
  if (event.rrule) {
    lines.push(formatContentLine("RRULE", event.rrule));
  }
  if (event.rdate) {
    for (const rdate of event.rdate) {
      lines.push(formatContentLine("RDATE", rdate));
    }
  }
  if (event.exdate) {
    for (const exdate of event.exdate) {
      lines.push(formatContentLine("EXDATE", exdate));
    }
  }
  if (event.url) {
    lines.push(formatContentLine("URL", event.url));
  }
  if (event.geo) {
    lines.push(formatContentLine("GEO", `${event.geo.lat};${event.geo.lon}`));
  }
  if (event.priority !== undefined) {
    lines.push(formatContentLine("PRIORITY", event.priority.toString()));
  }
  if (event.class) {
    lines.push(formatContentLine("CLASS", event.class));
  }

  // Alarms
  if (event.alarms) {
    for (const alarm of event.alarms) {
      lines.push(...encodeAlarm(alarm));
    }
  }

  lines.push("END:VEVENT");
  return lines;
};

/**
 * Encode a VTODO component
 */
const encodeTodo = (todo: Types.VTodo): string[] => {
  const lines: string[] = [];

  lines.push("BEGIN:VTODO");

  if (todo.uid) {
    lines.push(formatContentLine("UID", todo.uid));
  }
  if (todo.dtstamp) {
    lines.push(formatContentLine("DTSTAMP", todo.dtstamp));
  }
  if (todo.dtstart) {
    lines.push(formatContentLine("DTSTART", todo.dtstart));
  }
  if (todo.due) {
    lines.push(formatContentLine("DUE", todo.due));
  }
  if (todo.duration) {
    lines.push(formatContentLine("DURATION", todo.duration));
  }
  if (todo.summary) {
    lines.push(formatContentLine("SUMMARY", escapeValue(todo.summary)));
  }
  if (todo.description) {
    lines.push(formatContentLine("DESCRIPTION", escapeValue(todo.description)));
  }
  if (todo.location) {
    lines.push(formatContentLine("LOCATION", escapeValue(todo.location)));
  }
  if (todo.status) {
    lines.push(formatContentLine("STATUS", todo.status));
  }
  if (todo.percent !== undefined) {
    lines.push(formatContentLine("PERCENT-COMPLETE", todo.percent.toString()));
  }
  if (todo.completed) {
    lines.push(formatContentLine("COMPLETED", todo.completed));
  }
  if (todo.priority !== undefined) {
    lines.push(formatContentLine("PRIORITY", todo.priority.toString()));
  }
  if (todo.rrule) {
    lines.push(formatContentLine("RRULE", todo.rrule));
  }

  // Alarms
  if (todo.alarms) {
    for (const alarm of todo.alarms) {
      lines.push(...encodeAlarm(alarm));
    }
  }

  lines.push("END:VTODO");
  return lines;
};

/**
 * Encode a VJOURNAL component
 */
const encodeJournal = (journal: Types.VJournal): string[] => {
  const lines: string[] = [];

  lines.push("BEGIN:VJOURNAL");

  if (journal.uid) {
    lines.push(formatContentLine("UID", journal.uid));
  }
  if (journal.dtstamp) {
    lines.push(formatContentLine("DTSTAMP", journal.dtstamp));
  }
  if (journal.dtstart) {
    lines.push(formatContentLine("DTSTART", journal.dtstart));
  }
  if (journal.summary) {
    lines.push(formatContentLine("SUMMARY", escapeValue(journal.summary)));
  }
  if (journal.description) {
    lines.push(formatContentLine("DESCRIPTION", escapeValue(journal.description)));
  }
  if (journal.status) {
    lines.push(formatContentLine("STATUS", journal.status));
  }
  if (journal.class) {
    lines.push(formatContentLine("CLASS", journal.class));
  }

  lines.push("END:VJOURNAL");
  return lines;
};

/**
 * Encode a VFREEBUSY component
 */
const encodeFreeBusy = (freebusy: Types.VFreeBusy): string[] => {
  const lines: string[] = [];

  lines.push("BEGIN:VFREEBUSY");

  if (!freebusy.dtstart || !freebusy.dtend) {
    throw new EncodeError("VFREEBUSY requires DTSTART and DTEND properties");
  }

  if (freebusy.uid) {
    lines.push(formatContentLine("UID", freebusy.uid));
  }
  if (freebusy.dtstamp) {
    lines.push(formatContentLine("DTSTAMP", freebusy.dtstamp));
  }
  lines.push(formatContentLine("DTSTART", freebusy.dtstart));
  lines.push(formatContentLine("DTEND", freebusy.dtend));
  if (freebusy.organizer) {
    lines.push(formatContentLine("ORGANIZER", freebusy.organizer));
  }
  if (freebusy.url) {
    lines.push(formatContentLine("URL", freebusy.url));
  }
  if (freebusy.attendee) {
    for (const attendee of freebusy.attendee) {
      lines.push(formatContentLine("ATTENDEE", attendee));
    }
  }
  if (freebusy.freebusy) {
    for (const fb of freebusy.freebusy) {
      const periods = fb.periods.map((p) => `${p.start}/${p.end}`).join(",");
      const params = fb.type ? { FBTYPE: fb.type } : undefined;
      lines.push(formatContentLine("FREEBUSY", periods, params));
    }
  }

  lines.push("END:VFREEBUSY");
  return lines;
};

/**
 * Encode a VTIMEZONE component
 */
const encodeTimezone = (timezone: Types.VTimezone): string[] => {
  const lines: string[] = [];

  lines.push("BEGIN:VTIMEZONE");

  if (!timezone.tzid) {
    throw new EncodeError("VTIMEZONE requires TZID property");
  }

  lines.push(formatContentLine("TZID", timezone.tzid));

  if (timezone.lastmod) {
    lines.push(formatContentLine("LAST-MODIFIED", timezone.lastmod));
  }
  if (timezone.tzurl) {
    lines.push(formatContentLine("TZURL", timezone.tzurl));
  }

  // Standard time
  if (timezone.standard) {
    for (const std of timezone.standard) {
      lines.push("BEGIN:STANDARD");
      lines.push(formatContentLine("DTSTART", std.dtstart));
      lines.push(formatContentLine("TZOFFSETFROM", std.tzoffsetfrom));
      lines.push(formatContentLine("TZOFFSETTO", std.tzoffsetto));
      if (std.rrule) {
        lines.push(formatContentLine("RRULE", std.rrule));
      }
      if (std.tzname) {
        lines.push(formatContentLine("TZNAME", std.tzname));
      }
      lines.push("END:STANDARD");
    }
  }

  // Daylight saving time
  if (timezone.daylight) {
    for (const dst of timezone.daylight) {
      lines.push("BEGIN:DAYLIGHT");
      lines.push(formatContentLine("DTSTART", dst.dtstart));
      lines.push(formatContentLine("TZOFFSETFROM", dst.tzoffsetfrom));
      lines.push(formatContentLine("TZOFFSETTO", dst.tzoffsetto));
      if (dst.rrule) {
        lines.push(formatContentLine("RRULE", dst.rrule));
      }
      if (dst.tzname) {
        lines.push(formatContentLine("TZNAME", dst.tzname));
      }
      lines.push("END:DAYLIGHT");
    }
  }

  lines.push("END:VTIMEZONE");
  return lines;
};

/**
 * Encode a VCalendar object into an iCalendar string
 * 
 * @param calendar - The VCalendar object to encode
 * @returns Effect that succeeds with the iCalendar string or fails with EncodeError
 */
export const encode = (calendar: Types.VCalendar): Effect.Effect<string, EncodeError> => {
  return Effect.gen(function* (_) {
    const lines: string[] = [];

    lines.push("BEGIN:VCALENDAR");

    // Required properties
    if (!calendar.version) {
      return yield* _(Effect.fail(new EncodeError("VERSION property is required")));
    }
    if (!calendar.prodid) {
      return yield* _(Effect.fail(new EncodeError("PRODID property is required")));
    }

    lines.push(formatContentLine("VERSION", calendar.version));
    lines.push(formatContentLine("PRODID", calendar.prodid));

    // Optional properties
    if (calendar.calscale) {
      lines.push(formatContentLine("CALSCALE", calendar.calscale));
    }
    if (calendar.method) {
      lines.push(formatContentLine("METHOD", calendar.method));
    }
    if (calendar.name) {
      lines.push(formatContentLine("NAME", escapeValue(calendar.name)));
    }
    if (calendar.description) {
      lines.push(formatContentLine("DESCRIPTION", escapeValue(calendar.description)));
    }

    // Timezones
    if (calendar.timezones) {
      for (const timezone of calendar.timezones) {
        lines.push(...encodeTimezone(timezone));
      }
    }

    // Events
    if (calendar.events) {
      for (const event of calendar.events) {
        lines.push(...encodeEvent(event));
      }
    }

    // Todos
    if (calendar.todos) {
      for (const todo of calendar.todos) {
        lines.push(...encodeTodo(todo));
      }
    }

    // Journals
    if (calendar.journals) {
      for (const journal of calendar.journals) {
        lines.push(...encodeJournal(journal));
      }
    }

    // Free/Busy
    if (calendar.freebusys) {
      for (const freebusy of calendar.freebusys) {
        lines.push(...encodeFreeBusy(freebusy));
      }
    }

    lines.push("END:VCALENDAR");

    return lines.join("\r\n") + "\r\n";
  });
};

/**
 * Encode a VCalendar object and return the string directly (synchronous)
 */
export const encodeSync = (calendar: Types.VCalendar): string => {
  return Effect.runSync(encode(calendar));
};
