import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { listSavedTrips, upsertTrip } from "@/lib/db";
import type { TripPlan } from "@/types/travel";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const trips = listSavedTrips(user.id);
    return NextResponse.json({ trips });
  } catch (err) {
    console.error("GET /api/trips error:", err);
    return NextResponse.json({ error: "Failed to load saved trips" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const body = await request.json();
    const trip: TripPlan = body.trip;
    if (!trip || !trip.id || !trip.destination) {
      return NextResponse.json({ error: "Invalid trip payload" }, { status: 400 });
    }
    const saved = upsertTrip({ ...trip, isFavorite: true }, user.id);
    return NextResponse.json({ trip: saved });
  } catch (err) {
    console.error("POST /api/trips error:", err);
    return NextResponse.json({ error: "Failed to save trip" }, { status: 500 });
  }
}
