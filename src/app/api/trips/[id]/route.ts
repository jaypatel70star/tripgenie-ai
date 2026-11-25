import { NextResponse } from "next/server";
import { deleteSavedTrip, getSavedTrip, upsertTrip } from "@/lib/db";
import type { TripPlan } from "@/types/travel";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const trip = getSavedTrip(id);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
    return NextResponse.json({ trip });
  } catch (err) {
    console.error("GET /api/trips/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch trip" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const existing = getSavedTrip(id);
    const incoming: TripPlan | undefined = body.trip;
    if (!existing && !incoming) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
    const updated = upsertTrip({
      ...(existing ?? incoming!),
      ...(incoming ?? {}),
      id,
      isFavorite: body.isFavorite ?? incoming?.isFavorite ?? existing?.isFavorite ?? true,
    });
    return NextResponse.json({ trip: updated });
  } catch (err) {
    console.error("PATCH /api/trips/[id] error:", err);
    return NextResponse.json({ error: "Failed to update trip" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const ok = deleteSavedTrip(id);
    return NextResponse.json({ deleted: ok });
  } catch (err) {
    console.error("DELETE /api/trips/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete trip" }, { status: 500 });
  }
}
