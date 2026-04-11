/**
 * Telegram integration placeholder (Phase 8).
 *
 * High-level steps:
 * 1. Install grammy: `npm install grammy`
 * 2. Add TELEGRAM_BOT_TOKEN to .env
 * 3. On each message:
 *    - Extract chat.id as threadId
 *    - Extract message.text as user message
 *    - Call supervisorClient({ threadId: String(chat.id), message: text })
 *    - Reply with the returned string
 * 4. Add "dev:telegram": "tsx src/telegram.ts" to package.json scripts
 */

// import { Bot } from "grammy";
// import { supervisorClient } from "./client";
//
// const token = process.env.TELEGRAM_BOT_TOKEN;
// if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
//
// const bot = new Bot(token);
//
// bot.on("message:text", async (ctx) => {
//   const threadId = String(ctx.chat.id);
//   const reply = await supervisorClient({ threadId, message: ctx.message.text });
//   await ctx.reply(reply || "Done.");
// });
//
// bot.start();
// console.log("Telegram bot running");
