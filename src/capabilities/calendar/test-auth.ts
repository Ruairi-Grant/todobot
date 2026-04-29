import "dotenv/config";
import { getCalendarClient } from "./auth";

async function test() {
  console.log("Authenticating with Google Calendar...");
  const calendar = await getCalendarClient();

  const res = await calendar.events.list({
    calendarId: "primary",
    maxResults: 5,
    timeMin: new Date().toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  console.log(
    `✅ Auth successful! Found ${res.data.items?.length ?? 0} upcoming events:`
  );
  for (const e of res.data.items ?? []) {
    console.log(
      `   • ${e.summary} — ${e.start?.dateTime ?? e.start?.date}`
    );
  }
}

test().catch((err) => {
  console.error("❌ Auth failed:", err.message);
  process.exit(1);
});
