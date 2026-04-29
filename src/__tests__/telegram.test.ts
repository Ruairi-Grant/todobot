/**
 * Unit tests for Telegram-specific utilities.
 *
 * Tests conversation threading (message ID derivation) and
 * message chunking for the 4096-char Telegram limit — without
 * needing a real Telegram bot connection.
 */
import { describe, it, expect } from "vitest";
import { chunkMessage } from "../entrypoints/telegram/langgraph-client";

describe("Telegram — Message Chunking", () => {
  it("returns a single chunk for short messages", () => {
    const chunks = chunkMessage("Hello world");
    expect(chunks).toEqual(["Hello world"]);
  });

  it("splits long messages at the size boundary", () => {
    const longText = "A".repeat(10000);
    const chunks = chunkMessage(longText, 4000);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(4000);
    expect(chunks[1]).toHaveLength(4000);
    expect(chunks[2]).toHaveLength(2000);
  });

  it("handles empty string", () => {
    const chunks = chunkMessage("");
    expect(chunks).toEqual([]);
  });

  it("handles text exactly at chunk size", () => {
    const text = "X".repeat(4000);
    const chunks = chunkMessage(text, 4000);
    expect(chunks).toEqual([text]);
  });
});

describe("Telegram — Conversation Threading", () => {
  /**
   * Tests the getConversationId logic from bot.ts.
   * The function walks the reply chain to find the root message,
   * then derives a thread ID as `tg-{chatId}-{rootMessageId}`.
   *
   * We test the logic inline since we can't easily import bot.ts
   * without Telegraf initialization (it throws on missing TELEGRAM_BOT_TOKEN).
   */

  function getConversationId(message: { chat: { id: number }; message_id: number; reply_to_message?: any }): string {
    let current = message;
    while (current.reply_to_message) {
      current = current.reply_to_message;
    }
    return `tg-${message.chat.id}-${current.message_id}`;
  }

  it("new message (no reply) uses its own message_id", () => {
    const id = getConversationId({ chat: { id: 100 }, message_id: 42 });
    expect(id).toBe("tg-100-42");
  });

  it("reply uses the root message's message_id", () => {
    const id = getConversationId({
      chat: { id: 100 },
      message_id: 45,
      reply_to_message: { chat: { id: 100 }, message_id: 42 },
    });
    expect(id).toBe("tg-100-42");
  });

  it("deep reply chain walks to the root", () => {
    const id = getConversationId({
      chat: { id: 100 },
      message_id: 50,
      reply_to_message: {
        chat: { id: 100 },
        message_id: 48,
        reply_to_message: {
          chat: { id: 100 },
          message_id: 42,
        },
      },
    });
    expect(id).toBe("tg-100-42");
  });

  it("different root messages produce different thread IDs (separate conversations)", () => {
    const id1 = getConversationId({ chat: { id: 100 }, message_id: 42 });
    const id2 = getConversationId({ chat: { id: 100 }, message_id: 99 });
    expect(id1).not.toBe(id2);
  });

  it("same root message produces same thread ID (continuous conversation)", () => {
    const id1 = getConversationId({
      chat: { id: 100 },
      message_id: 43,
      reply_to_message: { chat: { id: 100 }, message_id: 42 },
    });
    const id2 = getConversationId({
      chat: { id: 100 },
      message_id: 44,
      reply_to_message: { chat: { id: 100 }, message_id: 42 },
    });
    expect(id1).toBe(id2);
  });
});
