import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const apiKey =
      String(body.apiKey || "").trim() ||
      request.headers.get("x-gemini-api-key")?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      "";

    if (!apiKey) {
      return NextResponse.json(
        {
          valid: false,
          source: "none",
          error: "No Gemini API key provided or set in GEMINI_API_KEY.",
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelsToTry = ["gemini-4-hydrogen", "gemini-3.5-flash-lite"];
    let lastError = "";

    for (const model of modelsToTry) {
      try {
        const interaction = await ai.interactions.create({
          model,
          input: "Reply with only: OK",
          store: false,
        });
        if (interaction.output_text) {
          return NextResponse.json({
            valid: true,
            model,
            api: "interactions",
            source: body.apiKey ? "user-settings" : "env",
          });
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      try {
        const res = await ai.models.generateContent({
          model,
          contents: "Reply with only: OK",
        });
        if (res.text) {
          return NextResponse.json({
            valid: true,
            model,
            api: "generateContent",
            source: body.apiKey ? "user-settings" : "env",
          });
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return NextResponse.json(
      {
        valid: false,
        error: lastError || "Gemini API rejected the key or model request.",
      },
      { status: 401 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        valid: false,
        error: err instanceof Error ? err.message : "Failed to verify Gemini API key.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const hasServerKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  return NextResponse.json({ hasServerKey });
}
