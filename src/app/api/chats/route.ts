import { NextResponse } from "next/server";
import { clearChatSession, listChatHistory, listChatMessages } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    if (mode === "history") {
      const sessions = listChatHistory();
      return NextResponse.json({ sessions });
    }

    const sessionId = searchParams.get("sessionId") || "default-session";
    const messages = listChatMessages(sessionId);
    return NextResponse.json({ sessionId, messages });
  } catch (err) {
    console.error("GET /api/chats error:", err);
    return NextResponse.json({ error: "Failed to load chat history" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all");
    if (all === "1") {
      const sessions = listChatHistory();
      for (const s of sessions) {
        clearChatSession(s.sessionId);
      }
      return NextResponse.json({ clearedAll: true });
    }

    const sessionId = searchParams.get("sessionId") || "default-session";
    clearChatSession(sessionId);
    return NextResponse.json({ cleared: true });
  } catch (err) {
    console.error("DELETE /api/chats error:", err);
    return NextResponse.json({ error: "Failed to clear chat" }, { status: 500 });
  }
}
