import { Telegraf } from "telegraf";
import type { Message } from "telegraf/types";
import { callLangGraph, chunkMessage } from "./langgraph-client";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN in .env");
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ── Conversation threading ──────────────────────────────────

function getThreadRoot(message: Message): Message {
  let current = message;
  while ("reply_to_message" in current && current.reply_to_message) {
    current = current.reply_to_message;
  }
  return current;
}

export function getConversationId(message: Message): string {
  const root = getThreadRoot(message);
  return `tg-${message.chat.id}-${root.message_id}`;
}

// ── Middleware ───────────────────────────────────────────────

bot.use(async (ctx, next) => {
  const msg = ctx.message;
  if (msg && "text" in msg) {
    const threadId = getConversationId(msg);
    console.log(`[telegram] chat=${ctx.chat?.id} thread=${threadId}: ${msg.text}`);
  }
  await next();
});

bot.command("start", (ctx) => {
  ctx.reply("👋 Send me a task and I'll turn it into todos.");
});

bot.command("todos", async (ctx) => {
  const threadId = getConversationId(ctx.message);
  try {
    await ctx.sendChatAction("typing");
    const response = await callLangGraph("show my todos", threadId);
    await ctx.reply(response || "No todos yet.", {
      reply_parameters: { message_id: ctx.message.message_id },
    });
  } catch (error) {
    console.error("[telegram] /todos error:", error);
    await ctx.reply("⚠️ Something went wrong fetching todos.");
  }
});

bot.on("text", async (ctx) => {
  const message = ctx.message.text;
  const threadId = getConversationId(ctx.message);

  try {
    await ctx.sendChatAction("typing");
    const response = await callLangGraph(message, threadId);

    const chunks = chunkMessage(response);
    for (const chunk of chunks) {
      await ctx
        .reply(chunk, {
          parse_mode: "Markdown",
          reply_parameters: { message_id: ctx.message.message_id },
        })
        .catch(() =>
          ctx.reply(chunk, {
            reply_parameters: { message_id: ctx.message.message_id },
          })
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

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
