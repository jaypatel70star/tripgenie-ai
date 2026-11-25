import { NextResponse } from "next/server";
import { clearChatSession, listChatMessages } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
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
    const sessionId = searchParams.get("sessionId") || "default-session";
    clearChatSession(sessionId);
    return NextResponse.json({ cleared: true });
  } catch (err) {
    console.error("DELETE /api/chats error:", err);
    return NextResponse.json({ error: "Failed to clear chat" }, { status: 500 });
  }
}
