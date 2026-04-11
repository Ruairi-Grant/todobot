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
