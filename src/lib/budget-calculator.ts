import type {
  BudgetBreakdown,
  BudgetTier,
  ExpenseLineItem,
  TravelTransportMode,
  TripPlan,
} from "@/types/travel";

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

function getCountryCostProfile(country: string): {
  stayFactor: number;
  mealPerDayUsd: Record<BudgetTier, number>;
  activityScale: number;
  label: "india" | "asia" | "high";
} {
  const c = country.toLowerCase();
  if (c.includes("india") || c.includes("nepal") || c.includes("sri lanka") || c.includes("vietnam")) {
    return {
      label: "india",
      stayFactor: 0.72,
      mealPerDayUsd: { budget: 8, moderate: 16, luxury: 42 },
      activityScale: 0.55,
    };
  }
  if (
    c.includes("china") ||
    c.includes("indonesia") ||
    c.includes("thailand") ||
    c.includes("malaysia") ||
    c.includes("egypt") ||
    c.includes("turkey")
  ) {
    return {
      label: "asia",
      stayFactor: 0.85,
      mealPerDayUsd: { budget: 12, moderate: 22, luxury: 54 },
      activityScale: 0.75,
    };
  }
  return {
    label: "high",
    stayFactor: 1.0,
    mealPerDayUsd: { budget: 18, moderate: 34, luxury: 78 },
    activityScale: 1.0,
  };
}

function estimateOneWayIntercityUsd(
  distanceKm: number,
  tier: BudgetTier,
  mode: TravelTransportMode,
  isDomesticIndia: boolean
): { costUsd: number; modeLabel: string; sharedVehicle: boolean } {
  const tierFactor = tier === "budget" ? 0.8 : tier === "luxury" ? 1.65 : 1.0;

  if (distanceKm < 25) {
    return { costUsd: 6, modeLabel: "Local Cab / Metro", sharedVehicle: true };
  }

  // Explicit mode override
  if (mode === "road") {
    const fuelAndToll = Math.max(12, Math.round(distanceKm * (isDomesticIndia ? 0.09 : 0.14)));
    return {
      costUsd: Math.round(fuelAndToll * (tier === "luxury" ? 1.4 : 1)),
      modeLabel: "Private Cab / Highway Road Trip",
      sharedVehicle: true,
    };
  }

  if (mode === "train") {
    const baseTrain =
      distanceKm < 350
        ? isDomesticIndia ? 10 : 28
        : distanceKm < 1200
          ? isDomesticIndia ? 20 : 62
          : isDomesticIndia ? 32 : 110;
    return {
      costUsd: Math.round(baseTrain * (tier === "luxury" ? 1.7 : tier === "budget" ? 0.75 : 1)),
      modeLabel: isDomesticIndia ? "AC Express Train / Volvo Coach" : "High-Speed Intercity Rail",
      sharedVehicle: false,
    };
  }

  if (mode === "flight" || distanceKm >= 1100) {
    if (distanceKm < 900) {
      return {
        costUsd: Math.round((isDomesticIndia ? 48 : 85) * tierFactor),
        modeLabel: "Short-Haul Flight",
        sharedVehicle: false,
      };
    }
    if (distanceKm < 2400) {
      return {
        costUsd: Math.round((isDomesticIndia ? 62 : 115) * tierFactor),
        modeLabel: isDomesticIndia ? "Domestic Flight" : "Regional Flight",
        sharedVehicle: false,
      };
    }
    if (distanceKm < 5500) {
      return {
        costUsd: Math.round(185 * tierFactor),
        modeLabel: "International Flight",
        sharedVehicle: false,
      };
    }
    return {
      costUsd: Math.round(340 * tierFactor),
      modeLabel: "Long-Haul International Flight",
      sharedVehicle: false,
    };
  }

  // Auto mode (< 1100 km)
  if (distanceKm < 180) {
    return {
      costUsd: Math.round((isDomesticIndia ? 14 : 26) * tierFactor),
      modeLabel: "Intercity Cab / Express Bus",
      sharedVehicle: true,
    };
  }
  if (distanceKm < 650) {
    return {
      costUsd: Math.round((isDomesticIndia ? 18 : 48) * tierFactor),
      modeLabel: isDomesticIndia ? "AC Train / Overnight Volvo" : "Express Rail",
      sharedVehicle: false,
    };
  }
  return {
    costUsd: Math.round((isDomesticIndia ? 52 : 95) * tierFactor),
    modeLabel: isDomesticIndia ? "Domestic Flight" : "Regional Flight",
    sharedVehicle: false,
  };
}

export function calculateItemizedBudget(
  trip: Pick<
    TripPlan,
    | "originCity"
    | "originLat"
    | "originLng"
    | "destination"
    | "country"
    | "lat"
    | "lng"
    | "daysCount"
    | "travelers"
    | "budgetTier"
    | "days"
    | "hotels"
    | "transport"
  >,
  existingTips?: string[],
  options?: {
    targetBudgetUsd?: number;
    transportMode?: TravelTransportMode;
  }
): BudgetBreakdown {
  const travelers = Math.max(1, trip.travelers || 1);
  const daysCount = Math.max(1, trip.days.length || trip.daysCount || 1);
  const nights = Math.max(1, daysCount - 1);
  const rooms = Math.ceil(travelers / 2);
  const profile = getCountryCostProfile(trip.country || "");
  const isDomesticIndia =
    profile.label === "india" &&
    /mumbai|delhi|pune|bangalore|bengaluru|hyderabad|chennai|kolkata|ahmedabad|jaipur|surat|kochi|goa|chandigarh|lucknow|indore|bhopal|nagpur|patna/i.test(
      trip.originCity || ""
    );

  const selectedMode: TravelTransportMode = options?.transportMode ?? "auto";
  const lineItems: ExpenseLineItem[] = [];

  // 1. Distance & Trip Start: Outbound Journey
  const distKm = Math.round(
    haversineKm(trip.originLat || 19.076, trip.originLng || 72.8777, trip.lat, trip.lng)
  );
  // If user gave a tight domestic India target budget, auto-select economical Train/Volvo over flights
  let effectiveMode = selectedMode;
  if (
    selectedMode === "auto" &&
    isDomesticIndia &&
    options?.targetBudgetUsd &&
    options.targetBudgetUsd / travelers < 220 &&
    distKm >= 180
  ) {
    effectiveMode = "train";
  }

  const oneWay = estimateOneWayIntercityUsd(distKm, trip.budgetTier, effectiveMode, isDomesticIndia);
  const outboundCost = oneWay.sharedVehicle ? oneWay.costUsd : oneWay.costUsd * travelers;
  const outboundDetail = oneWay.sharedVehicle
    ? `${oneWay.modeLabel} (~${distKm.toLocaleString()} km • shared for ${travelers})`
    : `${oneWay.modeLabel} (~${distKm.toLocaleString()} km) × ${travelers} traveler${travelers > 1 ? "s" : ""}`;

  lineItems.push({
    id: "exp-outbound",
    stage: "Trip Start",
    category: "transport",
    title: `Outbound: ${trip.originCity || "Mumbai"} → ${trip.destination}`,
    detail: outboundDetail,
    amountUsd: outboundCost,
  });

  // 2. Local Transport & Airport Transfers
  const localTransports = trip.transport.filter((t) => t.mode !== "Flight");
  if (localTransports.length > 0) {
    localTransports.forEach((t, idx) => {
      const isPerPerson =
        t.mode === "Metro & Transit Pass" || t.mode === "Airport Express" || t.mode === "Ferry / Boat";
      const mult = isPerPerson ? travelers : 1;
      const baseCost = Math.round(t.estimatedCostUsd * (profile.label === "india" ? 0.7 : 1));
      lineItems.push({
        id: `exp-local-trans-${idx}`,
        stage: "Trip Start",
        category: "transport",
        title: t.title,
        detail: `${t.mode} • ${t.duration} ${isPerPerson ? `× ${travelers} travelers` : "(shared)"}`,
        amountUsd: Math.max(2, Math.round(baseCost * mult)),
      });
    });
  } else {
    lineItems.push({
      id: "exp-local-trans-default",
      stage: "Trip Start",
      category: "transport",
      title: `${trip.destination} Local Transit & Transfers`,
      detail: `${daysCount} days local cabs/metro × ${travelers} traveler${travelers > 1 ? "s" : ""}`,
      amountUsd: Math.round(daysCount * (profile.label === "india" ? 5 : 9) * travelers),
    });
  }

  // 3. Accommodation (Night-by-Night Stay)
  const preferredHotel =
    trip.hotels.find((h) => h.tier === trip.budgetTier) ?? trip.hotels[0];
  const fallbackNightRate =
    trip.budgetTier === "budget"
      ? Math.round(28 * profile.stayFactor)
      : trip.budgetTier === "luxury"
        ? Math.round(240 * profile.stayFactor)
        : Math.round(78 * profile.stayFactor);

  const rawNightRate = preferredHotel ? preferredHotel.pricePerNightUsd : fallbackNightRate;
  const calibratedNightRate = Math.max(12, Math.round(rawNightRate * (preferredHotel ? 1 : profile.stayFactor)));
  const hotelName = preferredHotel ? preferredHotel.name : `${trip.destination} ${trip.budgetTier} stay`;

  lineItems.push({
    id: "exp-stay",
    stage: "Accommodation",
    category: "accommodation",
    title: `Stay: ${hotelName}`,
    detail: `${nights} night${nights > 1 ? "s" : ""} × ${rooms} room${rooms > 1 ? "s" : ""} (${trip.budgetTier} tier)`,
    amountUsd: Math.round(calibratedNightRate * nights * rooms),
  });

  // 4. Day-by-Day Every Activity + Calibrated Daily Meals
  const dailyBaseMealPerPerson = profile.mealPerDayUsd[trip.budgetTier];

  trip.days.forEach((day) => {
    let foodActivitiesInDay = 0;

    day.activities.forEach((act) => {
      const isFood = act.category === "food";
      if (isFood) foodActivitiesInDay += 1;

      const perPersonCost = Math.round((act.estimatedCostUsd || 0) * profile.activityScale);
      const totalActCost = perPersonCost * travelers;
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

  // 5. Trip End: Return Journey + 5% Contingency Buffer
  lineItems.push({
    id: "exp-return",
    stage: "Trip End",
    category: "transport",
    title: `Return: ${trip.destination} → ${trip.originCity || "Mumbai"}`,
    detail: outboundDetail,
    amountUsd: outboundCost,
  });

  const subtotalUsd = lineItems.reduce((sum, item) => sum + item.amountUsd, 0);
  const miscBufferUsd = Math.max(6, Math.round(subtotalUsd * 0.05));
  lineItems.push({
    id: "exp-misc-buffer",
    stage: "Trip End",
    category: "buffer",
    title: "Connectivity, Local Tips & 5% Contingency Buffer",
    detail: "Covers eSIM/roaming, gratuities, and unexpected transit",
    amountUsd: miscBufferUsd,
  });

  // 6. Optional target budget smart scaling (if user gave an explicit budget cap)
  if (options?.targetBudgetUsd && options.targetBudgetUsd > 40) {
    const rawTotal = lineItems.reduce((sum, item) => sum + item.amountUsd, 0);
    if (rawTotal > options.targetBudgetUsd * 1.12) {
      // Scale flexible items (stay, meals, activities, buffer) gently while keeping a realistic floor (65% minimum)
      const fixedTransport = lineItems
        .filter((i) => i.id === "exp-outbound" || i.id === "exp-return")
        .reduce((s, i) => s + i.amountUsd, 0);
      const flexibleSum = Math.max(1, rawTotal - fixedTransport);
      const targetFlexible = Math.max(flexibleSum * 0.65, options.targetBudgetUsd - fixedTransport);
      const scaleFactor = Math.min(1, targetFlexible / flexibleSum);

      if (scaleFactor < 0.98) {
        for (const item of lineItems) {
          if (item.id !== "exp-outbound" && item.id !== "exp-return") {
            item.amountUsd = Math.max(0, Math.round(item.amountUsd * scaleFactor));
          }
        }
      }
    }
  }

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

  const tips =
    existingTips && existingTips.length > 0
      ? existingTips
      : [
          `Distance calculated: ~${distKm.toLocaleString()} km (${trip.originCity || "Mumbai"} ↔ ${trip.destination}) using ${oneWay.modeLabel}.`,
          "Every night's stay, daily stop, meal allowance, and round-trip travel is summed above.",
        ];

  return {
    totalUsd,
    perDayUsd: Math.round(totalUsd / daysCount),
    accommodationUsd,
    foodUsd,
    transportUsd,
    activitiesUsd,
    bufferUsd,
    targetBudgetUsd: options?.targetBudgetUsd,
    transportMode: effectiveMode,
    distanceKm: distKm,
    tips,
    lineItems,
  };
}
