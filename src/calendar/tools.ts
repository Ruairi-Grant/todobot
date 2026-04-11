import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getCalendar } from "./auth";
import { TIMEZONE } from "../env";

// ── create_calendar_event ───────────────────────────────────
export const create_calendar_event = tool(
  async (input) => {
    const { calendar, calendarId } = await getCalendar();

    const event = {
      summary: input.title,
      description: input.description,
      location: input.location,
      start: {
        dateTime: input.start_time,
        timeZone: input.timezone ?? TIMEZONE,
      },
      end: {
        dateTime: input.end_time,
        timeZone: input.timezone ?? TIMEZONE,
      },
    };

    const res = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    console.log("[tool:create_calendar_event]", {
      title: input.title,
      start: input.start_time,
      end: input.end_time,
      id: res.data.id,
    });

    return JSON.stringify({
      id: res.data.id,
      title: res.data.summary,
      start: res.data.start?.dateTime,
      end: res.data.end?.dateTime,
      link: res.data.htmlLink,
    });
  },
  {
    name: "create_calendar_event",
    description:
      "Create a Google Calendar event. The LLM must parse natural language into structured fields BEFORE calling this tool. " +
      'For example, "gym tomorrow at 7pm" should be parsed to title="Gym", start_time="2026-04-12T19:00:00", end_time="2026-04-12T20:00:00". ' +
      "All times must be ISO 8601 datetime strings.",
    schema: z.object({
      title: z.string().min(1).describe("Event title"),
      start_time: z
        .string()
        .describe("Start time as ISO 8601 datetime (e.g. 2026-04-12T19:00:00)"),
      end_time: z
        .string()
        .describe("End time as ISO 8601 datetime (e.g. 2026-04-12T20:00:00)"),
      description: z.string().optional().describe("Event description"),
      location: z.string().optional().describe("Event location"),
      timezone: z
        .string()
        .optional()
        .describe(`IANA timezone (e.g. Europe/Amsterdam). Defaults to ${TIMEZONE}.`),
    }),
  }
);

// ── list_calendar_events ────────────────────────────────────
export const list_calendar_events = tool(
  async (input) => {
    const { calendar, calendarId } = await getCalendar();

    // Default to today if no range provided
    const now = new Date();
    const timeMin =
      input.start_date ??
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const timeMax =
      input.end_date ??
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      ).toISOString();

    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 20,
    });

    const events = (res.data.items ?? []).map((e) => ({
      id: e.id,
      title: e.summary,
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      location: e.location,
      description: e.description,
    }));

    console.log("[tool:list_calendar_events]", {
      range: `${timeMin} → ${timeMax}`,
      count: events.length,
    });

    return JSON.stringify(events);
  },
  {
    name: "list_calendar_events",
    description:
      "List Google Calendar events for a date range. Defaults to today if no dates are provided. " +
      "Parse natural language like 'tomorrow', 'this week', 'next Monday' into ISO dates before calling.",
    schema: z.object({
      start_date: z
        .string()
        .optional()
        .describe("Start of range as ISO 8601 datetime. Defaults to start of today."),
      end_date: z
        .string()
        .optional()
        .describe("End of range as ISO 8601 datetime. Defaults to end of today."),
    }),
  }
);

// ── find_free_slots ─────────────────────────────────────────
export const find_free_slots = tool(
  async (input) => {
    const { calendar, calendarId } = await getCalendar();

    const date = input.date;
    const dayStart = `${date}T${input.day_start ?? "08:00:00"}`;
    const dayEnd = `${date}T${input.day_end ?? "22:00:00"}`;
    const tz = input.timezone ?? TIMEZONE;
    const minMinutes = input.min_duration_minutes ?? 60;

    const res = await calendar.events.list({
      calendarId,
      timeMin: `${dayStart}+00:00`, // will be interpreted with timeZone
      timeMax: `${dayEnd}+00:00`,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
      timeZone: tz,
    });

    // Parse events into start/end minute-of-day pairs
    const busy: { start: number; end: number; title: string }[] = [];
    for (const e of res.data.items ?? []) {
      const s = e.start?.dateTime;
      const en = e.end?.dateTime;
      if (!s || !en) continue;
      const sd = new Date(s);
      const ed = new Date(en);
      busy.push({
        start: sd.getHours() * 60 + sd.getMinutes(),
        end: ed.getHours() * 60 + ed.getMinutes(),
        title: e.summary ?? "(no title)",
      });
    }
    busy.sort((a, b) => a.start - b.start);

    // Find gaps
    const toHHMM = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const dayStartMin =
      parseInt(dayStart.slice(11, 13)) * 60 + parseInt(dayStart.slice(14, 16));
    const dayEndMin =
      parseInt(dayEnd.slice(11, 13)) * 60 + parseInt(dayEnd.slice(14, 16));

    const slots: { start: string; end: string; durationMin: number }[] = [];
    let cursor = dayStartMin;

    for (const event of busy) {
      if (event.start > cursor) {
        const gap = event.start - cursor;
        if (gap >= minMinutes) {
          slots.push({
            start: toHHMM(cursor),
            end: toHHMM(event.start),
            durationMin: gap,
          });
        }
      }
      cursor = Math.max(cursor, event.end);
    }
    // Gap after last event
    if (dayEndMin > cursor) {
      const gap = dayEndMin - cursor;
      if (gap >= minMinutes) {
        slots.push({
          start: toHHMM(cursor),
          end: toHHMM(dayEndMin),
          durationMin: gap,
        });
      }
    }

    console.log(
      `[tool:find_free_slots] ${date} | ${busy.length} events | ${slots.length} free slots (≥${minMinutes}min)`,
    );

    if (slots.length === 0) {
      return `No free slots of ${minMinutes}+ minutes found on ${date} (${toHHMM(dayStartMin)}–${toHHMM(dayEndMin)}). The day is fully booked.`;
    }

    const lines = slots.map(
      (s) => `• ${s.start} – ${s.end} (${s.durationMin} min free)`,
    );
    return [`**Free slots on ${date}** (≥${minMinutes} min):`, "", ...lines].join("\n");
  },
  {
    name: "find_free_slots",
    description:
      "Find free time slots on a given day by analyzing calendar events. " +
      "Returns pre-formatted available windows. Use this when the user asks 'when am I free', " +
      "'find me a slot', 'what time works', etc. Much better than list_calendar_events for availability queries.",
    schema: z.object({
      date: z
        .string()
        .describe("The date to check, as YYYY-MM-DD (e.g. 2026-04-12)"),
      min_duration_minutes: z
        .number()
        .optional()
        .describe("Minimum slot duration in minutes. Defaults to 60."),
      day_start: z
        .string()
        .optional()
        .describe("Earliest time to consider, as HH:MM:SS. Defaults to 08:00:00."),
      day_end: z
        .string()
        .optional()
        .describe("Latest time to consider, as HH:MM:SS. Defaults to 22:00:00."),
      timezone: z
        .string()
        .optional()
        .describe(`IANA timezone. Defaults to ${TIMEZONE}.`),
    }),
  }
);

// ── delete_calendar_event ───────────────────────────────────
export const delete_calendar_event = tool(
  async (input) => {
    const { calendar, calendarId } = await getCalendar();

    await calendar.events.delete({
      calendarId,
      eventId: input.event_id,
    });

    console.log("[tool:delete_calendar_event]", input.event_id);
    return JSON.stringify({ deleted: true, event_id: input.event_id });
  },
  {
    name: "delete_calendar_event",
    description: "Delete a Google Calendar event by its event ID.",
    schema: z.object({
      event_id: z.string().describe("The Google Calendar event ID to delete"),
    }),
  }
);

// ── get_calendar_summary ────────────────────────────────────
export const get_calendar_summary = tool(
  async (input) => {
    const { calendar, calendarId } = await getCalendar();
    const tz = input.timezone ?? TIMEZONE;

    // Build date range
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (input.offset_days) {
      startDate.setDate(startDate.getDate() + input.offset_days);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (input.days ?? 1));

    const res = await calendar.events.list({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
      timeZone: tz,
    });

    const items = res.data.items ?? [];

    console.log(
      `[tool:get_calendar_summary] ${startDate.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)} | ${items.length} events`,
    );

    if (items.length === 0) {
      const rangeStr =
        (input.days ?? 1) === 1
          ? startDate.toISOString().slice(0, 10)
          : `${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`;
      return `No events found for ${rangeStr}. Your schedule is clear!`;
    }

    // Group events by date
    const byDate = new Map<string, typeof items>();
    for (const e of items) {
      const dt = e.start?.dateTime ?? e.start?.date ?? "";
      const day = dt.slice(0, 10);
      if (!byDate.has(day)) byDate.set(day, []);
      byDate.get(day)!.push(e);
    }

    // Format time from ISO datetime
    const fmtTime = (iso: string | undefined | null) => {
      if (!iso) return "??:??";
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const lines: string[] = [];

    for (const [day, events] of byDate) {
      const d = new Date(day + "T12:00:00");
      const dayName = dayNames[d.getDay()];
      lines.push(`**📅 ${dayName} ${day}** (${events.length} event${events.length > 1 ? "s" : ""}):`);

      for (const e of events) {
        const start = fmtTime(e.start?.dateTime);
        const end = fmtTime(e.end?.dateTime);
        const allDay = !e.start?.dateTime;
        const time = allDay ? "All day" : `${start}–${end}`;
        const loc = e.location ? ` 📍 ${e.location}` : "";
        lines.push(`  • ${time} — ${e.summary ?? "(no title)"}${loc}`);
      }
      lines.push("");
    }

    return lines.join("\n").trim();
  },
  {
    name: "get_calendar_summary",
    description:
      "Get a formatted summary of calendar events for a time range. " +
      "Use this for 'what's on tomorrow', 'my schedule this week', 'events in the next 3 days', etc. " +
      "Returns pre-formatted markdown grouped by day — relay directly to the user.",
    schema: z.object({
      days: z
        .number()
        .optional()
        .describe("Number of days to include. Defaults to 1. E.g. 7 for a week, 3 for next 3 days."),
      offset_days: z
        .number()
        .optional()
        .describe("Days offset from today. 0 = today (default), 1 = tomorrow, -1 = yesterday."),
      timezone: z
        .string()
        .optional()
        .describe(`IANA timezone. Defaults to ${TIMEZONE}.`),
    }),
  }
);
