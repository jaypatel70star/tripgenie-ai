import { NextResponse } from "next/server";
import { createSessionToken, getSessionCookieOptions, verifyPassword } from "@/lib/auth";
import { findUserByEmail } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const record = findUserByEmail(email);
    if (!record || !verifyPassword(password, record.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = createSessionToken(record.id);
    const user = {
      id: record.id,
      name: record.name,
      email: record.email,
      createdAt: record.createdAt,
    };

    const response = NextResponse.json({ user });
    response.cookies.set({
      ...getSessionCookieOptions(request),
      value: token,
    });
    return response;
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json({ error: "Failed to sign in" }, { status: 500 });
  }
}
