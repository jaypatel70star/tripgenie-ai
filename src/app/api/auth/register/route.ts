import { NextResponse } from "next/server";
import { createSessionToken, getSessionCookieOptions, hashPassword } from "@/lib/auth";
import { createUser } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Please enter your name (at least 2 characters)." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(password);
    const user = createUser({ name, email, passwordHash });
    const token = createSessionToken(user.id);

    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set({
      ...getSessionCookieOptions(request),
      value: token,
    });
    return response;
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_EXISTS") {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 409 }
      );
    }
    console.error("POST /api/auth/register error:", err);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
