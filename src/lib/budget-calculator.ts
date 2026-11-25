import type { BudgetBreakdown, BudgetTier, ExpenseLineItem, TripPlan } from "@/types/travel";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateOneWayIntercityUsd(distanceKm: number, tier: BudgetTier): { costUsd: number; modeLabel: string } {
  const tierFactor = tier === "budget" ? 0.78 : tier === "luxury" ? 1.65 : 1.0;
  if (distanceKm < 120) {
    return { costUsd: Math.round(14 * tierFactor), modeLabel: "Highway Cab / Bus" };
  }
  if (distanceKm < 650) {
    return { costUsd: Math.round(32 * tierFactor), modeLabel: "Express Train / Volvo Coach" };
  }
  if (distanceKm < 2200) {
    return { costUsd: Math.round(78 * tierFactor), modeLabel: "Domestic Flight" };
  }
  if (distanceKm < 5500) {
    return { costUsd: Math.round(215 * tierFactor), modeLabel: "International Flight" };
  }
  return { costUsd: Math.round(390 * tierFactor), modeLabel: "Long-Haul International Flight" };
}

export function calculateItemizedBudget(
  trip: Pick<
    TripPlan,
    | "originCity"
    | "originLat"
    | "originLng"
    | "destination"
    | "lat"
    | "lng"
    | "daysCount"
    | "travelers"
    | "budgetTier"
    | "days"
    | "hotels"
    | "transport"
  >,
  existingTips?: string[]
): BudgetBreakdown {
  const travelers = Math.max(1, trip.travelers || 1);
  const daysCount = Math.max(1, trip.days.length || trip.daysCount || 1);
  const nights = Math.max(1, daysCount - 1);
  const rooms = Math.ceil(travelers / 2);
  const lineItems: ExpenseLineItem[] = [];

  // 1. Trip Start: Outbound Journey from Origin City -> Destination
  const distKm = Math.round(
    haversineKm(trip.originLat || 19.076, trip.originLng || 72.8777, trip.lat, trip.lng)
  );
  const oneWay = estimateOneWayIntercityUsd(distKm, trip.budgetTier);
  lineItems.push({
    id: "exp-outbound",
    stage: "Trip Start",
    category: "transport",
    title: `Outbound: ${trip.originCity || "Origin"} → ${trip.destination}`,
    detail: `${oneWay.modeLabel} (~${distKm.toLocaleString()} km) × ${travelers} traveler${travelers > 1 ? "s" : ""}`,
    amountUsd: oneWay.costUsd * travelers,
  });

  // 2. Local Transport & Airport Transfers
  const localTransports = trip.transport.filter((t) => t.mode !== "Flight");
  if (localTransports.length > 0) {
    localTransports.forEach((t, idx) => {
      const unitMultiplier =
        t.mode === "Metro & Transit Pass" || t.mode === "Airport Express" || t.mode === "Ferry / Boat"
          ? travelers
          : 1;
      const countLabel =
        unitMultiplier > 1 ? `× ${unitMultiplier} travelers` : "(shared vehicle/pass)";
      lineItems.push({
        id: `exp-local-trans-${idx}`,
        stage: "Trip Start",
        category: "transport",
        title: t.title,
        detail: `${t.mode} • ${t.duration} ${countLabel}`,
        amountUsd: Math.round(t.estimatedCostUsd * unitMultiplier),
      });
    });
  } else {
    lineItems.push({
      id: "exp-local-trans-default",
      stage: "Trip Start",
      category: "transport",
      title: `${trip.destination} Local Transit & Airport Transfers`,
      detail: `${daysCount} days local metro/cabs × ${travelers} traveler${travelers > 1 ? "s" : ""}`,
      amountUsd: Math.round(daysCount * 9 * travelers),
    });
  }

  // 3. Accommodation (Hotel Stay for Nights)
  const preferredHotel =
    trip.hotels.find((h) => h.tier === trip.budgetTier) ?? trip.hotels[0];
  const fallbackNightRate =
    trip.budgetTier === "budget" ? 42 : trip.budgetTier === "luxury" ? 360 : 128;
  const nightRateUsd = preferredHotel ? preferredHotel.pricePerNightUsd : fallbackNightRate;
  const hotelName = preferredHotel ? preferredHotel.name : `${trip.destination} ${trip.budgetTier} stay`;

  lineItems.push({
    id: "exp-stay",
    stage: "Accommodation",
    category: "accommodation",
    title: `Stay: ${hotelName}`,
    detail: `${nights} night${nights > 1 ? "s" : ""} × ${rooms} room${rooms > 1 ? "s" : ""} (${trip.budgetTier} tier)`,
    amountUsd: Math.round(nightRateUsd * nights * rooms),
  });

  // 4. Day-by-Day Every Single Activity + Daily Meals
  const dailyBaseMealPerPerson =
    trip.budgetTier === "budget" ? 14 : trip.budgetTier === "luxury" ? 58 : 26;

  trip.days.forEach((day) => {
    let foodActivitiesInDay = 0;

    day.activities.forEach((act) => {
      const isFood = act.category === "food";
      if (isFood) foodActivitiesInDay += 1;

      const totalActCost = Math.round((act.estimatedCostUsd || 0) * travelers);
      lineItems.push({
        id: `exp-day-${day.dayNumber}-${act.id}`,
        stage: "Day-by-Day",
        dayNumber: day.dayNumber,
        category: isFood ? "food" : "activities",
        title: `Day ${day.dayNumber}: ${act.title}`,
        detail: `${act.time} • ${act.locationName} (${travelers} traveler${travelers > 1 ? "s" : ""})`,
        amountUsd: totalActCost,
      });
    });

    // Remaining meals (breakfast / lunch / dinner) not already covered by scheduled food stops
    const uncoveredMealRatio = Math.max(0.35, 1 - foodActivitiesInDay * 0.35);
    const remainingMealsUsd = Math.round(
      dailyBaseMealPerPerson * uncoveredMealRatio * travelers
    );
    lineItems.push({
      id: `exp-meals-day-${day.dayNumber}`,
      stage: "Day-by-Day",
      dayNumber: day.dayNumber,
      category: "food",
      title: `Day ${day.dayNumber}: Daily Meals & Refreshments`,
      detail: `Breakfast/cafe/dinner allowance × ${travelers} traveler${travelers > 1 ? "s" : ""}`,
      amountUsd: remainingMealsUsd,
    });
  });

  // 5. Trip End: Return Journey + Travel Extras/Buffer
  lineItems.push({
    id: "exp-return",
    stage: "Trip End",
    category: "transport",
    title: `Return: ${trip.destination} → ${trip.originCity || "Origin"}`,
    detail: `${oneWay.modeLabel} (~${distKm.toLocaleString()} km) × ${travelers} traveler${travelers > 1 ? "s" : ""}`,
    amountUsd: oneWay.costUsd * travelers,
  });

  const subtotalUsd = lineItems.reduce((sum, item) => sum + item.amountUsd, 0);
  const miscBufferUsd = Math.max(12, Math.round(subtotalUsd * 0.05));
  lineItems.push({
    id: "exp-misc-buffer",
    stage: "Trip End",
    category: "buffer",
    title: "eSIM / Connectivity, Tips & Contingency Buffer",
    detail: "5% safety buffer for local tips, SIM, and spontaneous stops",
    amountUsd: miscBufferUsd,
  });

  // Exact bottom-up sums by category
  let accommodationUsd = 0;
  let foodUsd = 0;
  let transportUsd = 0;
  let activitiesUsd = 0;
  let bufferUsd = 0;

  for (const item of lineItems) {
    if (item.category === "accommodation") accommodationUsd += item.amountUsd;
    else if (item.category === "food") foodUsd += item.amountUsd;
    else if (item.category === "transport") transportUsd += item.amountUsd;
    else if (item.category === "activities") activitiesUsd += item.amountUsd;
    else bufferUsd += item.amountUsd;
  }

  const totalUsd =
    accommodationUsd + foodUsd + transportUsd + activitiesUsd + bufferUsd;

  return {
    totalUsd,
    perDayUsd: Math.round(totalUsd / daysCount),
    accommodationUsd,
    foodUsd,
    transportUsd,
    activitiesUsd,
    bufferUsd,
    tips:
      existingTips && existingTips.length > 0
        ? existingTips
        : [
            "Every expense from outbound departure, hotel nights, daily stops, meals, and return trip is summed above.",
            "Remove any activity in the Itinerary tab or adjust pace/cost to watch the grand total recalculate live.",
          ],
    lineItems,
  };
}
