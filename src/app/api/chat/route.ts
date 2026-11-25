import { NextResponse } from "next/server";
import { processTravelChat } from "@/lib/ai-engine";
import {
  ensureChatSession,
  getSessionInteractionId,
  saveChatMessage,
  updateSessionContext,
  upsertTrip,
} from "@/lib/db";
import type { ChatMessage, TravelPreferences, TripPlan } from "@/types/travel";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId: string = body.sessionId || "default-session";
    const message: string = String(body.message || "").trim();
    const preferences: TravelPreferences = body.preferences;
    const currentTrip: TripPlan | null = body.currentTrip ?? null;
    const apiKeyHeader = request.headers.get("x-gemini-api-key") || undefined;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    ensureChatSession(
      sessionId,
      preferences?.language || "en",
      currentTrip ? currentTrip.title : "TripGenie AI Chat"
    );

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    saveChatMessage(sessionId, userMsg);

    const prevInteractionId = getSessionInteractionId(sessionId);

    const result = await processTravelChat({
      message,
      preferences,
      currentTrip,
      apiKey: apiKeyHeader,
      previousInteractionId: prevInteractionId,
    });

    if (result.tripPlan && result.tripPlan.isFavorite) {
      upsertTrip(result.tripPlan);
    }

    updateSessionContext(
      sessionId,
      result.tripPlan?.id ?? null,
      result.previousInteractionId
    );

    const assistantMsg: ChatMessage = {
      id: `msg-a-${Date.now() + 1}`,
      role: "assistant",
      content: result.replyText,
      createdAt: new Date().toISOString(),
      engine: result.engine,
      tripUpdated: Boolean(result.tripPlan),
      suggestions: result.suggestions,
      adjustmentSummary: result.adjustmentSummary,
    };
    saveChatMessage(sessionId, assistantMsg);

    return NextResponse.json({
      sessionId,
      assistantMessage: assistantMsg,
      tripPlan: result.tripPlan,
      suggestions: result.suggestions,
      weather: result.weather,
      countryInfo: result.countryInfo,
      exchangeRates: result.exchangeRates,
      previousInteractionId: result.previousInteractionId,
      engine: result.engine,
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Failed to process travel query" },
      { status: 500 }
    );
  }
}
