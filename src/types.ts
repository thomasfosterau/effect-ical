/**
 * The plain iCalendar (RFC 5545) object model the parser produces and the
 * encoder consumes: one interface per component, each with a `component`
 * discriminant. Date, time, duration and recurrence values are RFC 5545
 * strings, kept verbatim.
 *
 * @module
 */

/**
 * Properties every scheduling component (event, to-do, journal, free/busy) may carry.
 */
export interface BaseProperties {
  /** Unique identifier for the component */
  uid?: string;
  /** Date-time stamp indicating when the component was created */
  dtstamp?: string;
}

/**
 * A `VEVENT` component: a scheduled event.
 */
export interface VEvent extends BaseProperties {
  /** Component type identifier */
  readonly component: "VEVENT";
  /** Date-time when the event begins */
  dtstart: string;
  /** Date-time when the event ends */
  dtend?: string;
  /** Duration of the event (alternative to dtend) */
  duration?: string;
  /** Short summary or subject for the event */
  summary?: string;
  /** Complete description of the event */
  description?: string;
  /** Physical location of the event */
  location?: string;
  /** Organizer of the event */
  organizer?: string;
  /** List of attendees */
  attendee?: string[];
  /** Categories for the event */
  categories?: string[];
  /** Status of the event */
  status?: "TENTATIVE" | "CONFIRMED" | "CANCELLED";
  /** Recurrence rule */
  rrule?: string;
  /** Recurrence date-times */
  rdate?: string[];
  /** Exception date-times */
  exdate?: string[];
  /** URL associated with the event */
  url?: string;
  /** Geographic position */
  geo?: { lat: number; lon: number };
  /** Priority (0 = undefined, 1 = highest, 9 = lowest) */
  priority?: number;
  /** Classification (PUBLIC, PRIVATE, CONFIDENTIAL) */
  class?: "PUBLIC" | "PRIVATE" | "CONFIDENTIAL";
  /** Alarm components */
  alarms?: VAlarm[];
}

/**
 * A `VTODO` component: an action item.
 */
export interface VTodo extends BaseProperties {
  /** Component type identifier */
  readonly component: "VTODO";
  /** Date-time when the to-do begins */
  dtstart?: string;
  /** Date-time when the to-do is due */
  due?: string;
  /** Duration of the to-do */
  duration?: string;
  /** Short summary or subject for the to-do */
  summary?: string;
  /** Complete description of the to-do */
  description?: string;
  /** Physical location */
  location?: string;
  /** Status of the to-do */
  status?: "NEEDS-ACTION" | "COMPLETED" | "IN-PROCESS" | "CANCELLED";
  /** Percent complete (0-100) */
  percent?: number;
  /** Date-time when completed */
  completed?: string;
  /** Priority (0 = undefined, 1 = highest, 9 = lowest) */
  priority?: number;
  /** Recurrence rule */
  rrule?: string;
  /** Alarm components */
  alarms?: VAlarm[];
}

/**
 * A `VJOURNAL` component: a journal entry.
 */
export interface VJournal extends BaseProperties {
  /** Component type identifier */
  readonly component: "VJOURNAL";
  /** Date-time when the journal entry begins */
  dtstart?: string;
  /** Short summary or subject for the journal */
  summary?: string;
  /** Complete description of the journal */
  description?: string;
  /** Status of the journal */
  status?: "DRAFT" | "FINAL" | "CANCELLED";
  /** Classification */
  class?: "PUBLIC" | "PRIVATE" | "CONFIDENTIAL";
}

/**
 * A `VFREEBUSY` component: free or busy time information.
 */
export interface VFreeBusy extends BaseProperties {
  /** Component type identifier */
  readonly component: "VFREEBUSY";
  /** Date-time when the free/busy time begins */
  dtstart: string;
  /** Date-time when the free/busy time ends */
  dtend: string;
  /** Organizer of the free/busy time */
  organizer?: string;
  /** URL for the free/busy time */
  url?: string;
  /** Attendees */
  attendee?: string[];
  /** Free/busy time periods */
  freebusy?: Array<{
    type?: "FREE" | "BUSY" | "BUSY-UNAVAILABLE" | "BUSY-TENTATIVE";
    periods: Array<{ start: string; end: string }>;
  }>;
}

/**
 * A `VTIMEZONE` component: a time zone definition, with its standard and daylight observances.
 */
export interface VTimezone {
  /** Component type identifier */
  readonly component: "VTIMEZONE";
  /** Timezone identifier */
  tzid: string;
  /** Last modified date */
  lastmod?: string;
  /** Timezone URL */
  tzurl?: string;
  /** Standard time components */
  standard?: Array<{
    dtstart: string;
    tzoffsetfrom: string;
    tzoffsetto: string;
    rrule?: string;
    tzname?: string;
  }>;
  /** Daylight saving time components */
  daylight?: Array<{
    dtstart: string;
    tzoffsetfrom: string;
    tzoffsetto: string;
    rrule?: string;
    tzname?: string;
  }>;
}

/**
 * A `VALARM` component: a reminder attached to an event or to-do.
 */
export interface VAlarm {
  /** Component type identifier */
  readonly component: "VALARM";
  /** Action to perform when alarm triggers */
  action: "AUDIO" | "DISPLAY" | "EMAIL";
  /** Trigger time relative to event or absolute */
  trigger: string;
  /** Duration for alarm repetition */
  duration?: string;
  /** Number of times to repeat alarm */
  repeat?: number;
  /** Description for display/email alarms */
  description?: string;
  /** Summary for email alarms */
  summary?: string;
  /** Attendees for email alarms */
  attendee?: string[];
  /** Attachment for audio alarms */
  attach?: string;
}

/**
 * Any component a `VCALENDAR` can hold directly.
 */
export type Component = VEvent | VTodo | VJournal | VFreeBusy | VTimezone;

/**
 * A `VCALENDAR` object: the top-level iCalendar container.
 */
export interface VCalendar {
  /** Component type identifier */
  readonly component: "VCALENDAR";
  /** Product identifier */
  prodid: string;
  /** iCalendar version (must be "2.0" for RFC 5545) */
  version: "2.0";
  /** Calendar scale (default: GREGORIAN) */
  calscale?: "GREGORIAN";
  /** Method (used with iTIP) */
  method?: string;
  /** Calendar name */
  name?: string;
  /** Calendar description */
  description?: string;
  /** Timezone components */
  timezones?: VTimezone[];
  /** Event components */
  events?: VEvent[];
  /** Todo components */
  todos?: VTodo[];
  /** Journal components */
  journals?: VJournal[];
  /** Free/busy components */
  freebusys?: VFreeBusy[];
}
