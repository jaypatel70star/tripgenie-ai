import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  clearAllUserChatHistory,
  clearChatSession,
  listChatHistory,
  listChatMessages,
} from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    if (mode === "history") {
      const sessions = listChatHistory(user.id);
      return NextResponse.json({ sessions });
    }

    const sessionId = searchParams.get("sessionId") || "default-session";
    const messages = listChatMessages(user.id, sessionId);
    return NextResponse.json({ sessionId, messages });
  } catch (err) {
    console.error("GET /api/chats error:", err);
    return NextResponse.json({ error: "Failed to load chat history" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all");
    if (all === "1") {
      clearAllUserChatHistory(user.id);
      return NextResponse.json({ clearedAll: true });
    }

    const sessionId = searchParams.get("sessionId") || "default-session";
    clearChatSession(user.id, sessionId);
    return NextResponse.json({ cleared: true });
  } catch (err) {
    console.error("DELETE /api/chats error:", err);
    return NextResponse.json({ error: "Failed to clear chat" }, { status: 500 });
  }
}
