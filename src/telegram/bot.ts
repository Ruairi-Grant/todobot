import { Telegraf } from "telegraf";
import { callLangGraph, chunkMessage } from "../langgraph/client";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN in .env");
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Logging middleware
bot.use(async (ctx, next) => {
  const msg = ctx.message;
  if (msg && "text" in msg) {
    console.log(`[telegram] ${ctx.chat?.id}: ${msg.text}`);
  }
  await next();
});

// /start command
bot.command("start", (ctx) => {
  ctx.reply("👋 Send me a task and I'll turn it into todos.");
});

// /todos command
bot.command("todos", async (ctx) => {
  try {
    await ctx.sendChatAction("typing");
    const response = await callLangGraph("show my todos", String(ctx.chat.id));
    await ctx.reply(response || "No todos yet.");
  } catch (error) {
    console.error("[telegram] /todos error:", error);
    await ctx.reply("⚠️ Something went wrong fetching todos.");
  }
});

// Handle all text messages
bot.on("text", async (ctx) => {
  const message = ctx.message.text;
  const threadId = String(ctx.chat.id);

  try {
    await ctx.sendChatAction("typing");
    const response = await callLangGraph(message, threadId);

    // Split long messages to stay within Telegram's 4096 char limit
    const chunks = chunkMessage(response);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: "Markdown" }).catch(() =>
        // Fallback without Markdown if parsing fails
        ctx.reply(chunk)
      );
    }
  } catch (error) {
    console.error("[telegram] Error:", error);
    await ctx.reply("⚠️ Something went wrong. Is the LangGraph server running?");
  }
});

export function startBot() {
  bot.launch();
  console.log("🤖 Telegram bot started (long-polling)");

  // Graceful shutdown
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
