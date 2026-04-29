import fs from "fs";
import path from "path";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

function loadClientConfig() {
  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  const key = raw.installed ?? raw.web;
  return {
    clientId: key.client_id,
    clientSecret: key.client_secret,
    redirectUri: key.redirect_uris?.[0] ?? "http://localhost",
  };
}

export async function getCalendarClient() {
  const { clientId, clientSecret, redirectUri } = loadClientConfig();
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    oauth2.setCredentials(token);
  } else {
    const tmpClient = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    oauth2.setCredentials(tmpClient.credentials);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tmpClient.credentials));
    console.log("[calendar] Token saved to", TOKEN_PATH);
  }

  return google.calendar({ version: "v3", auth: oauth2 });
}

export async function getCalendar() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
  const calendar = await getCalendarClient();
  return { calendar, calendarId };
}
