import { GoogleGenAI } from "@google/genai";
import { calculateItemizedBudget } from "@/lib/budget-calculator";
import { formatPrice } from "@/lib/currency";
import {
  DESTINATION_CATALOG,
  matchCatalogCity,
  suggestDestinationsByProfile,
  type CatalogCity,
} from "@/lib/destination-catalog";
import { getLanguageMeta } from "@/lib/i18n";
import {
  fetchCountryInfo,
  fetchExchangeRates,
  fetchLiveWeather,
  geocodeLocation,
} from "@/lib/travel-apis";
import type {
  BudgetBreakdown,
  BudgetTier,
  CountryTravelInfo,
  DayPlan,
  DestinationSuggestion,
  ItineraryActivity,
  SupportedLanguage,
  TravelPreferences,
  TripPlan,
  WeatherData,
} from "@/types/travel";

export interface EngineInput {
  message: string;
  preferences: TravelPreferences;
  currentTrip: TripPlan | null;
  apiKey?: string;
  previousInteractionId?: string;
}

export interface EngineOutput {
  replyText: string;
  tripPlan: TripPlan | null;
  suggestions?: DestinationSuggestion[];
  adjustmentSummary?: string;
  weather: WeatherData | null;
  countryInfo: CountryTravelInfo | null;
  exchangeRates: Record<string, number>;
  previousInteractionId?: string;
  engine: "gemini" | "smart-demo";
}

const SLOT_TIMES: Record<ItineraryActivity["timeSlot"], string> = {
  Morning: "09:30 AM",
  Afternoon: "01:30 PM",
  Evening: "06:00 PM",
  Night: "08:30 PM",
};

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildBudget(
  daysCount: number,
  travelers: number,
  tier: BudgetTier,
  baseDailyPerPersonUsd: number,
  requestedTotalUsd?: number
): BudgetBreakdown {
  const tierFactor = tier === "budget" ? 0.68 : tier === "luxury" ? 2.15 : 1.0;
  let totalUsd = Math.round(daysCount * travelers * baseDailyPerPersonUsd * tierFactor);

  if (requestedTotalUsd && requestedTotalUsd > 120) {
    totalUsd = Math.round(requestedTotalUsd);
  }

  const accommodationUsd = Math.round(totalUsd * 0.41);
  const foodUsd = Math.round(totalUsd * 0.24);
  const transportUsd = Math.round(totalUsd * 0.16);
  const activitiesUsd = Math.round(totalUsd * 0.12);
  const bufferUsd = Math.max(0, totalUsd - accommodationUsd - foodUsd - transportUsd - activitiesUsd);

  return {
    totalUsd,
    perDayUsd: Math.round(totalUsd / Math.max(1, daysCount)),
    accommodationUsd,
    foodUsd,
    transportUsd,
    activitiesUsd,
    bufferUsd,
    tips: [
      tier === "budget"
        ? "Favor neighborhood guesthouses, street markets, and multi-day transit passes to stay well under cap."
        : tier === "luxury"
          ? "Reserve flagship dining and private transfers early for peak-season availability."
          : "Mix one signature dining experience with local cafes and public metro passes for best value.",
      "Keep ~7% contingency buffer for spontaneous local experiences or weather pivots.",
    ],
  };
}

function synthesizeCustomCity(name: string, country: string, lat: number, lng: number, countryCode: string): CatalogCity {
  return {
    name,
    country,
    countryCode,
    lat,
    lng,
    bestTime: "Spring & Autumn",
    baseDailyUsd: 130,
    vibes: ["culture", "food", "sightseeing", "relax"],
    tagline: `Historic landmarks, vibrant culinary districts, and scenic walks in ${name}.`,
    activities: [
      {
        title: `${name} Old Town & Iconic Landmarks Walk`,
        description: `Discover the architectural heart of ${name}, historic plazas, and morning market stalls.`,
        category: "culture",
        locationName: `${name} Center`,
        lat: lat + 0.006,
        lng: lng + 0.005,
        estimatedCostUsd: 15,
        durationHours: 2.5,
        indoorAlternative: `${name} City History & Art Museum`,
      },
      {
        title: `Local Culinary & Street Market Tasting`,
        description: `Sample regional specialties and artisan desserts loved by ${name} locals.`,
        category: "food",
        locationName: `${name} Market Quarter`,
        lat: lat - 0.005,
        lng: lng + 0.008,
        estimatedCostUsd: 24,
        durationHours: 2,
        indoorAlternative: `Covered Artisan Food Hall in ${name}`,
      },
      {
        title: `${name} Panoramic Viewpoint & Waterfront`,
        description: `Golden-hour stroll along scenic viewpoints, bridges, and skyline promenades.`,
        category: "sightseeing",
        locationName: `${name} Promenade`,
        lat: lat + 0.009,
        lng: lng - 0.007,
        estimatedCostUsd: 18,
        durationHours: 2.5,
        indoorAlternative: `${name} Contemporary Cultural Center`,
      },
      {
        title: `Botanical Gardens & Artisan Quarter`,
        description: `Relaxed afternoon exploring lush parks, independent studios, and tea houses.`,
        category: "relax",
        locationName: `${name} Arts District`,
        lat: lat - 0.008,
        lng: lng - 0.006,
        estimatedCostUsd: 12,
        durationHours: 2,
        indoorAlternative: `Craft Workshop & Specialty Roastery`,
      },
      {
        title: `Evening Cultural District & Signature Dinner`,
        description: `Atmosphere-rich night lanes with live acoustics and authentic ${country} cuisine.`,
        category: "food",
        locationName: `${name} Old Quarter`,
        lat: lat + 0.003,
        lng: lng - 0.004,
        estimatedCostUsd: 32,
        durationHours: 2.5,
        indoorAlternative: `Historic Bistro & Music Salon`,
      },
      {
        title: `Neighborhood Hidden Gems & Boutique Walk`,
        description: `Venture off the main trail to local bookshops, murals, and neighborhood cafes.`,
        category: "shopping",
        locationName: `${name} Midtown`,
        lat: lat - 0.003,
        lng: lng + 0.003,
        estimatedCostUsd: 20,
        durationHours: 2,
        indoorAlternative: `${name} Design Gallery & Indoor Arcade`,
      },
    ],
    hotels: [
      {
        name: `${name} Central Backpackers & Suites`,
        tier: "budget",
        neighborhood: "City Center",
        pricePerNightUsd: 55,
        rating: 4.5,
        highlights: ["Walkable to transit", "Free Wi-Fi & breakfast", "Social rooftop"],
        lat: lat + 0.004,
        lng: lng + 0.002,
      },
      {
        name: `Grand Boutique ${name}`,
        tier: "moderate",
        neighborhood: "Historic District",
        pricePerNightUsd: 138,
        rating: 4.7,
        highlights: ["Design rooms", "Concierge local tours", "Courtyard lounge"],
        lat: lat - 0.004,
        lng: lng - 0.003,
      },
      {
        name: `The ${name} Palace & Spa`,
        tier: "luxury",
        neighborhood: "Waterfront",
        pricePerNightUsd: 410,
        rating: 4.9,
        highlights: ["Panoramic suites", "Thermal spa", "Chef's tasting restaurant"],
        lat: lat + 0.007,
        lng: lng - 0.005,
      },
    ],
    restaurants: [
      {
        name: `${name} Heritage Kitchen`,
        cuisine: `Authentic ${country}`,
        priceLevel: "$$",
        mustTryDish: "Chef's Regional Platter",
        neighborhood: "Old Quarter",
        rating: 4.7,
        lat: lat + 0.002,
        lng: lng + 0.006,
      },
      {
        name: `Bistro Lumière ${name}`,
        cuisine: "Contemporary Fusion",
        priceLevel: "$",
        mustTryDish: "Seasonal Market Bowl & Artisan Coffee",
        neighborhood: "Arts District",
        rating: 4.6,
        lat: lat - 0.006,
        lng: lng + 0.002,
      },
    ],
    transport: [
      {
        mode: "Metro & Transit Pass",
        title: `${name} Day Transit Pass`,
        duration: "City-wide unlimited",
        estimatedCostUsd: 9,
        notes: "Covers central metro/tram/bus routes with zero parking hassle.",
      },
      {
        mode: "Airport Express",
        title: `Airport Shuttle / Express Rail to ${name} Center`,
        duration: "30 – 45 mins",
        estimatedCostUsd: 16,
        notes: "Direct connection from arrival terminal to central station.",
      },
    ],
  };
}

function buildDayPlansFromCatalog(city: CatalogCity, daysCount: number, tier: BudgetTier): DayPlan[] {
  const slots: ItineraryActivity["timeSlot"][] = ["Morning", "Afternoon", "Evening"];
  const themes = [
    "Iconic Arrivals & Skyline Magic",
    "Cultural Heart & Local Flavors",
    "Hidden Gems & Scenic Trails",
    "Artisan Quarters & Sunset Views",
    "Leisurely Discovery & Farewell Feast",
    "Nature Escape & Neighborhood Charms",
    "Deep Dive & Golden-Hour Highlights",
  ];
  const costMultiplier = tier === "budget" ? 0.72 : tier === "luxury" ? 1.55 : 1.0;

  const days: DayPlan[] = [];
  for (let d = 1; d <= daysCount; d++) {
    const dayActivities: ItineraryActivity[] = [];
    for (let s = 0; s < 3; s++) {
      const template = city.activities[((d - 1) * 3 + s) % city.activities.length];
      const slot = slots[s];
      dayActivities.push({
        id: uid(`act-d${d}`),
        timeSlot: slot,
        time: SLOT_TIMES[slot],
        title: template.title,
        description: template.description,
        category: template.category,
        locationName: template.locationName,
        lat: template.lat + (d - 1) * 0.0012,
        lng: template.lng - (d - 1) * 0.001,
        estimatedCostUsd: Math.round(template.estimatedCostUsd * costMultiplier),
        durationHours: template.durationHours,
        indoorAlternative: template.indoorAlternative,
      });
    }
    days.push({
      dayNumber: d,
      theme: themes[(d - 1) % themes.length],
      summary: `Curated ${slots.length}-part rhythm across ${city.name}'s top neighborhoods and culinary stops.`,
      activities: dayActivities,
    });
  }
  return days;
}

function parseDaysFromMessage(msg: string, fallback: number): number {
  const m = msg.match(/(\d+)\s*[- ]?\s*(day|days|night|nights|दिन|días|jours|日間|tage|أيام)/i);
  if (m) {
    const val = parseInt(m[1], 10);
    if (val >= 1 && val <= 14) return val;
  }
  return fallback;
}

function parseBudgetFromMessage(
  msg: string,
  prefs: TravelPreferences
): { tier: BudgetTier; requestedUsd?: number } {
  const lower = msg.toLowerCase();
  let tier: BudgetTier = prefs.budgetTier;
  if (/(cheap|budget|backpack|student|affordable|low cost|सस्ता|कम बजट|económico)/i.test(lower)) {
    tier = "budget";
  } else if (/(luxury|5 star|five star|honeymoon|premium|lavish|लग्जरी)/i.test(lower)) {
    tier = "luxury";
  } else if (/(moderate|mid|balanced|comfort)/i.test(lower)) {
    tier = "moderate";
  }

  const numMatch =
    msg.match(/(?:\$|usd|rs\.?|inr|₹|€|£)\s*([\d,]+)/i) ??
    msg.match(/([\d,]+)\s*(?:usd|dollars|rupees|inr|euros)/i) ??
    msg.match(/(?:under|budget|within|around|below)\s+([\d,]{3,})/i);
  let requestedUsd: number | undefined;
  if (numMatch) {
    const raw = parseInt(numMatch[1].replace(/,/g, ""), 10);
    if (!Number.isNaN(raw) && raw > 50) {
      if (/\b(?:usd|dollars)\b|\$/i.test(numMatch[0])) {
        requestedUsd = raw;
      } else if (/₹|inr|rs|rupees/i.test(numMatch[0]) || prefs.currency === "INR" || raw >= 3000) {
        requestedUsd = Math.round(raw / 84.5);
      } else {
        requestedUsd = raw;
      }
      if (requestedUsd / Math.max(1, prefs.days) < 110) tier = "budget";
      else if (requestedUsd / Math.max(1, prefs.days) > 360) tier = "luxury";
    }
  }
  return { tier, requestedUsd };
}

function extractDestinationCandidate(msg: string): string | null {
  const catalogHit = matchCatalogCity(msg);
  if (catalogHit) return catalogHit.name;

  const patterns = [
    /(?:trip to|travel to|visit|itinerary for|plan for|going to|vacation in|explore|days in|day in|to)\s+([A-Z][a-zA-Z\s-]{2,26}?)(?=\s+(?:for|with|under|in|on|during|focusing|budget|\d)|[,.!?]|$)/,
    /(?:to|in|for)\s+([a-zA-Z]{3,20})/i,
  ];
  for (const pat of patterns) {
    const match = msg.match(pat);
    if (match?.[1]) {
      const candidate = match[1].trim();
      if (
        !/^(day|days|night|nights|people|person|budget|cheap|cheaper|luxury|relax|relaxed|slower|trip|plan|me|my|the|some|best|this|that|current|itinerary|rainy|indoor|extra|more|less|our|your)$/i.test(
          candidate
        )
      ) {
        return candidate;
      }
    }
  }
  return null;
}

function applyPlanAdjustment(
  trip: TripPlan,
  message: string,
  currency: TravelPreferences["currency"],
  exchangeRates: Record<string, number>
): { adjustedTrip: TripPlan; summary: string } | null {
  const lower = message.toLowerCase();
  const cloned: TripPlan = JSON.parse(JSON.stringify(trip));

  if (/(rain|rainy|indoor|weather|storm|umbrella|बारिश|lluvia|pluie|雨|regen|مطر)/i.test(lower)) {
    let swapped = 0;
    cloned.days = cloned.days.map((day) => ({
      ...day,
      theme: `${day.theme} (Rain-Proof Edition)`,
      activities: day.activities.map((act) => {
        if (act.indoorAlternative) {
          swapped++;
          return {
            ...act,
            title: act.indoorAlternative,
            description: `Rain-ready indoor swap for "${act.title}" — stays dry and comfortable without missing local culture.`,
          };
        }
        return act;
      }),
    }));
    return {
      adjustedTrip: cloned,
      summary: `Converted ${swapped} outdoor stops to curated indoor rain-proof alternatives.`,
    };
  }

  if (/(cheaper|cut cost|reduce|budget|save money|less expensive|20%|25%|सस्ता|barato|günstiger)/i.test(lower)) {
    cloned.budgetTier = "budget";
    cloned.days = cloned.days.map((d) => ({
      ...d,
      activities: d.activities.map((a) => ({
        ...a,
        estimatedCostUsd: Math.max(0, Math.round(a.estimatedCostUsd * 0.75)),
      })),
    }));
    cloned.hotels = cloned.hotels.map((h) => ({
      ...h,
      pricePerNightUsd: Math.max(15, Math.round(h.pricePerNightUsd * 0.78)),
    }));
    cloned.transport = cloned.transport.map((t) => ({
      ...t,
      estimatedCostUsd: Math.max(4, Math.round(t.estimatedCostUsd * 0.8)),
    }));
    cloned.budget = calculateItemizedBudget(cloned, cloned.budget.tips);
    return {
      adjustedTrip: cloned,
      summary: `Optimized stay, transport & activities down to ${formatPrice(cloned.budget.totalUsd, currency, exchangeRates)} total (start to end).`,
    };
  }

  if (/(relax|slow|chill|easy|less packed|spa|आराम|relajado|détendu|ゆったり|entspannt)/i.test(lower)) {
    const dayMatch = lower.match(/day\s*(\d+)/);
    const targetDay = dayMatch ? parseInt(dayMatch[1], 10) : null;
    cloned.days = cloned.days.map((day) => {
      if (targetDay && day.dayNumber !== targetDay) return day;
      const trimmed = day.activities.slice(0, 2);
      if (trimmed[1]) {
        trimmed[1] = {
          ...trimmed[1],
          timeSlot: "Afternoon",
          time: "03:00 PM",
          category: "relax",
          title: `Slow Café, Wellness & Sunset Stroll in ${cloned.destination}`,
          description: "Unrushed afternoon coffee terrace, spa/park time, and scenic golden-hour walk.",
        };
      }
      return {
        ...day,
        theme: `${day.theme} (Relaxed Pace)`,
        activities: trimmed,
      };
    });
    cloned.budget = calculateItemizedBudget(cloned, cloned.budget.tips);
    return {
      adjustedTrip: cloned,
      summary: targetDay
        ? `Lightened Day ${targetDay} and recalculated total to ${formatPrice(cloned.budget.totalUsd, currency, exchangeRates)}.`
        : `Adjusted itinerary to a relaxed pace — updated total: ${formatPrice(cloned.budget.totalUsd, currency, exchangeRates)}.`,
    };
  }

  if (/(add.*day|extra day|extend|more day|जोड़ें|\+1)/i.test(lower)) {
    const nextDayNum = cloned.days.length + 1;
    const baseActivities = cloned.days[0]?.activities ?? [];
    cloned.days.push({
      dayNumber: nextDayNum,
      theme: "Bonus Exploration & Local Market Discovery",
      summary: `Extra flexible day added to discover hidden cafés, artisan shops, and twilight vistas in ${cloned.destination}.`,
      activities: [
        {
          id: uid(`act-d${nextDayNum}`),
          timeSlot: "Morning",
          time: "10:00 AM",
          title: `${cloned.destination} Hidden Neighborhood Walk`,
          description: "Slow morning exploring local bakeries, murals, and quiet side streets.",
          category: "culture",
          locationName: baseActivities[0]?.locationName ?? cloned.destination,
          lat: cloned.lat + 0.008,
          lng: cloned.lng + 0.007,
          estimatedCostUsd: 15,
          durationHours: 2.5,
          indoorAlternative: `${cloned.destination} Local Design Museum`,
        },
        {
          id: uid(`act-d${nextDayNum}`),
          timeSlot: "Evening",
          time: "06:30 PM",
          title: `Farewell Panoramic Rooftop Dinner`,
          description: `Celebrate your final evening in ${cloned.destination} with regional specialties.`,
          category: "food",
          locationName: cloned.destination,
          lat: cloned.lat - 0.005,
          lng: cloned.lng - 0.004,
          estimatedCostUsd: 35,
          durationHours: 2,
          indoorAlternative: "Cozy Heritage Brasserie",
        },
      ],
    });
    cloned.daysCount = cloned.days.length;
    cloned.title = `${cloned.destination} (${cloned.daysCount} Days)`;
    cloned.budget = calculateItemizedBudget(cloned, cloned.budget.tips);
    return {
      adjustedTrip: cloned,
      summary: `Extended trip to ${cloned.daysCount} days — updated start-to-end total: ${formatPrice(cloned.budget.totalUsd, currency, exchangeRates)}.`,
    };
  }

  return null;
}

function localizedReplyPrefix(lang: SupportedLanguage, destination: string, days: number): string {
  switch (lang) {
    case "hi":
      return `मैंने **${destination}** के लिए आपकी **${days}-दिन की स्मार्ट यात्रा योजना** तैयार कर दी है! दाईं ओर 3D ग्लोब, लाइव मौसम, बजट विश्लेषण और मैप देखें।`;
    case "es":
      return `¡He diseñado tu itinerario inteligente de **${days} días en ${destination}**! Explora el globo 3D, el clima en vivo y el desglose de presupuesto en el panel lateral.`;
    case "fr":
      return `J'ai créé votre itinéraire intelligent de **${days} jours à ${destination}** ! Explorez le globe 3D, la météo en direct et le budget détaillé.`;
    case "ja":
      return `**${destination} ${days}日間**のスマート旅行プランを作成しました！右側の3D地球儀、ライブ天気、予算グラフをご確認ください。`;
    case "de":
      return `Ich habe deinen **${days}-Tage-Reiseplan für ${destination}** erstellt! Entdecke den 3D-Globus, Live-Wetter und die Budgetanalyse.`;
    case "ar":
      return `لقد قمت بإعداد خطة السفر الذكية لمدة **${days} أيام إلى ${destination}**! استكشف الكرة الأرضية ثلاثية الأبعاد والطقس المباشر وتفاصيل الميزانية.`;
    default:
      return `I've crafted your personalized **${days}-day ${destination} itinerary**! Watch the 3D Globe fly there and explore your day-by-day schedule, live weather, street map, and budget breakdown.`;
  }
}

async function runGeminiEngine(
  input: EngineInput,
  apiKey: string,
  originCoords: { lat: number; lng: number },
  weather: WeatherData | null,
  countryInfo: CountryTravelInfo | null,
  exchangeRates: Record<string, number>
): Promise<EngineOutput | null> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const langMeta = getLanguageMeta(input.preferences.language);

    const systemInstruction = `You are TripGenie AI, an elite 3D travel planning concierge.
Respond strictly in ${langMeta.aiName}.
Always quote prices in Indian Rupees (₹ / INR) inside replyText, overview, and tips (e.g., ₹25,000). Note: numeric schema fields ending in *Usd must still contain approximate USD values so currency conversion works cleanly.
User profile:
- Origin city: ${input.preferences.originCity}
- Budget tier: ${input.preferences.budgetTier} (Target ~₹${input.preferences.budgetAmount.toLocaleString("en-IN")} ${input.preferences.currency})
- Duration: ${input.preferences.days} days, ${input.preferences.travelers} traveler(s)
- Interests: ${input.preferences.interests.join(", ") || "sightseeing, food, culture"}
- Current active trip JSON (null if none yet): ${input.currentTrip ? JSON.stringify({ destination: input.currentTrip.destination, daysCount: input.currentTrip.daysCount, budgetTier: input.currentTrip.budgetTier }) : "none"}
- Live weather context if available: ${weather ? `${weather.locationName}: ${weather.currentTempC}°C, ${weather.condition}` : "not fetched yet"}

Return a valid JSON object matching the schema so the UI can update the 3D Globe, Leaflet Map, Budget Chart, and Itinerary Cards.
Always include realistic latitude/longitude coordinates for the destination and each activity.`;

    const responseSchema = {
      type: "object",
      properties: {
        replyText: { type: "string", description: "Friendly markdown response to the user in the requested language." },
        intent: { type: "string", enum: ["itinerary", "suggest_destinations", "adjust_itinerary", "chat"] },
        adjustmentSummary: { type: "string" },
        destination: { type: "string" },
        country: { type: "string" },
        lat: { type: "number" },
        lng: { type: "number" },
        daysCount: { type: "number" },
        overview: { type: "string" },
        bestSeason: { type: "string" },
        days: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dayNumber: { type: "number" },
              theme: { type: "string" },
              summary: { type: "string" },
              activities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    timeSlot: { type: "string", enum: ["Morning", "Afternoon", "Evening", "Night"] },
                    time: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string", enum: ["sightseeing", "food", "culture", "adventure", "relax", "shopping", "transit"] },
                    locationName: { type: "string" },
                    lat: { type: "number" },
                    lng: { type: "number" },
                    estimatedCostUsd: { type: "number" },
                    durationHours: { type: "number" },
                    indoorAlternative: { type: "string" },
                  },
                  required: ["timeSlot", "time", "title", "description", "category", "locationName", "lat", "lng", "estimatedCostUsd", "durationHours"],
                },
              },
            },
            required: ["dayNumber", "theme", "summary", "activities"],
          },
        },
        budget: {
          type: "object",
          properties: {
            totalUsd: { type: "number" },
            perDayUsd: { type: "number" },
            accommodationUsd: { type: "number" },
            foodUsd: { type: "number" },
            transportUsd: { type: "number" },
            activitiesUsd: { type: "number" },
            bufferUsd: { type: "number" },
            tips: { type: "array", items: { type: "string" } },
          },
        },
        hotels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              tier: { type: "string", enum: ["budget", "moderate", "luxury"] },
              neighborhood: { type: "string" },
              pricePerNightUsd: { type: "number" },
              rating: { type: "number" },
              highlights: { type: "array", items: { type: "string" } },
              lat: { type: "number" },
              lng: { type: "number" },
            },
          },
        },
        restaurants: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              cuisine: { type: "string" },
              priceLevel: { type: "string", enum: ["$", "$$", "$$$"] },
              mustTryDish: { type: "string" },
              neighborhood: { type: "string" },
              rating: { type: "number" },
              lat: { type: "number" },
              lng: { type: "number" },
            },
          },
        },
        transport: {
          type: "array",
          items: {
            type: "object",
            properties: {
              mode: { type: "string" },
              title: { type: "string" },
              duration: { type: "string" },
              estimatedCostUsd: { type: "number" },
              notes: { type: "string" },
            },
          },
        },
        suggestedDestinations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              country: { type: "string" },
              lat: { type: "number" },
              lng: { type: "number" },
              matchScore: { type: "number" },
              bestTime: { type: "string" },
              estimatedDailyUsd: { type: "number" },
              tagline: { type: "string" },
              highlights: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      required: ["replyText", "intent"],
    };

    const interaction = await ai.interactions.create({
      model: "gemini-4-hydrogen",
      input: input.message,
      system_instruction: systemInstruction,
      previous_interaction_id: input.previousInteractionId,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: responseSchema,
      },
    });

    const rawText = interaction.output_text;
    if (!rawText) return null;
    const parsed = JSON.parse(rawText);

    let tripPlan: TripPlan | null = input.currentTrip;
    let resolvedWeather = weather;
    let resolvedCountry = countryInfo;

    if (parsed.destination && Array.isArray(parsed.days) && parsed.days.length > 0) {
      const geo = await geocodeLocation(parsed.destination);
      const lat = Number(parsed.lat ?? geo?.lat ?? 35.6762);
      const lng = Number(parsed.lng ?? geo?.lng ?? 139.6503);
      const country = parsed.country ?? geo?.country ?? "International";

      const [freshWeather, freshCountry] = await Promise.all([
        fetchLiveWeather(lat, lng, parsed.destination, country),
        geo?.countryCode ? fetchCountryInfo(geo.countryCode, country) : fetchCountryInfo("", country),
      ]);
      resolvedWeather = freshWeather ?? weather;
      resolvedCountry = freshCountry ?? countryInfo;

      const daysCount = Number(parsed.daysCount ?? parsed.days.length);
      const draftTrip: TripPlan = {
        id: input.currentTrip && input.currentTrip.destination === parsed.destination ? input.currentTrip.id : uid("trip"),
        title: `${parsed.destination} (${daysCount} Days)`,
        destination: parsed.destination,
        country,
        originCity: input.preferences.originCity,
        originLat: originCoords.lat,
        originLng: originCoords.lng,
        lat,
        lng,
        daysCount,
        travelers: input.preferences.travelers,
        budgetTier: input.preferences.budgetTier,
        currency: input.preferences.currency,
        language: input.preferences.language,
        interests: input.preferences.interests,
        overview: parsed.overview ?? `Personalized ${daysCount}-day trip to ${parsed.destination}.`,
        bestSeason: parsed.bestSeason ?? "Year-round",
        days: parsed.days.map((d: DayPlan) => ({
          ...d,
          activities: (d.activities ?? []).map((a) => ({ ...a, id: a.id || uid("act") })),
        })),
        budget:
          parsed.budget && parsed.budget.totalUsd
            ? parsed.budget
            : buildBudget(daysCount, input.preferences.travelers, input.preferences.budgetTier, 145),
        hotels: (parsed.hotels ?? []).map((h: Record<string, unknown>) => ({ ...h, id: uid("hotel") })),
        restaurants: (parsed.restaurants ?? []).map((r: Record<string, unknown>) => ({ ...r, id: uid("rest") })),
        transport: (parsed.transport ?? []).map((t: Record<string, unknown>) => ({ ...t, id: uid("trans") })),
        suggestedDestinations: parsed.suggestedDestinations,
        weather: resolvedWeather,
        countryInfo: resolvedCountry,
        isFavorite: input.currentTrip?.isFavorite ?? false,
      };
      draftTrip.budget = calculateItemizedBudget(draftTrip, parsed.budget?.tips);
      tripPlan = draftTrip;
    }

    return {
      replyText: parsed.replyText,
      tripPlan,
      suggestions: parsed.suggestedDestinations,
      adjustmentSummary: parsed.adjustmentSummary,
      weather: resolvedWeather,
      countryInfo: resolvedCountry,
      exchangeRates,
      previousInteractionId: interaction.id,
      engine: "gemini",
    };
  } catch (err) {
    console.warn("Gemini fallback triggered:", err);
    return null;
  }
}

export async function processTravelChat(input: EngineInput): Promise<EngineOutput> {
  const effectiveKey = input.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || "";
  const [originGeo, exchangeRates] = await Promise.all([
    geocodeLocation(input.preferences.originCity || "Mumbai"),
    fetchExchangeRates(),
  ]);
  const originCoords = {
    lat: originGeo?.lat ?? 19.076,
    lng: originGeo?.lng ?? 72.8777,
  };

  if (effectiveKey) {
    const geminiResult = await runGeminiEngine(
      input,
      effectiveKey,
      originCoords,
      input.currentTrip?.weather ?? null,
      input.currentTrip?.countryInfo ?? null,
      exchangeRates
    );
    if (geminiResult) {
      return geminiResult;
    }
  }

  // Built-in Smart Demo Engine (works out-of-the-box with zero API keys + live Open-Meteo APIs)
  const msg = input.message.trim();
  const lower = msg.toLowerCase();

  // 1. Check if user wants destination suggestions
  const isSuggestRequest =
    /(suggest|recommend.*destination|where should i go|best places|ideas for|destinations under|सुझाएं|sugiere|suggère|提案|schlage|اقترح)/i.test(
      lower
    ) && !matchCatalogCity(msg);

  if (isSuggestRequest) {
    const { tier } = parseBudgetFromMessage(msg, input.preferences);
    const suggestions = suggestDestinationsByProfile(input.preferences.interests, tier, 4);
    const top = suggestions[0];
    const [weather, countryInfo] = await Promise.all([
      fetchLiveWeather(top.lat, top.lng, top.name, top.country),
      fetchCountryInfo("", top.country),
    ]);

    return {
      replyText:
        `Based on your **${tier}** budget and interests (${input.preferences.interests.join(", ") || "culture & food"}), here are **${suggestions.length} top destination matches**! Click any destination card below to fly the 3D Globe there and auto-generate its full itinerary.`,
      tripPlan: input.currentTrip,
      suggestions,
      weather,
      countryInfo,
      exchangeRates,
      engine: "smart-demo",
    };
  }

  // 2. Check if user wants to adjust the currently loaded itinerary
  const catalogMatch = matchCatalogCity(msg);
  const switchingToNewCity =
    catalogMatch &&
    input.currentTrip &&
    catalogMatch.name.toLowerCase() !== input.currentTrip.destination.toLowerCase();

  if (input.currentTrip && !switchingToNewCity) {
    const adjusted = applyPlanAdjustment(
      input.currentTrip,
      msg,
      input.preferences.currency,
      exchangeRates
    );
    if (adjusted) {
      const weather =
        adjusted.adjustedTrip.weather ??
        (await fetchLiveWeather(
          adjusted.adjustedTrip.lat,
          adjusted.adjustedTrip.lng,
          adjusted.adjustedTrip.destination,
          adjusted.adjustedTrip.country
        ));
      return {
        replyText: `Done! **${adjusted.summary}** Check the updated Itinerary and Budget tabs to review the changes.`,
        tripPlan: adjusted.adjustedTrip,
        adjustmentSummary: adjusted.summary,
        weather,
        countryInfo: adjusted.adjustedTrip.countryInfo ?? null,
        exchangeRates,
        engine: "smart-demo",
      };
    }
  }

  // 3. Otherwise, build or switch to a full destination itinerary
  const candidateName = extractDestinationCandidate(msg) ?? input.currentTrip?.destination ?? "Tokyo";
  let catalogCity = matchCatalogCity(candidateName);
  const geo = await geocodeLocation(catalogCity?.name ?? candidateName);

  if (!catalogCity && geo) {
    catalogCity = synthesizeCustomCity(geo.name, geo.country, geo.lat, geo.lng, geo.countryCode);
  } else if (!catalogCity) {
    catalogCity = DESTINATION_CATALOG[0];
  }

  const daysCount = parseDaysFromMessage(msg, input.preferences.days || 4);
  const { tier } = parseBudgetFromMessage(msg, input.preferences);

  const [weather, countryInfo] = await Promise.all([
    fetchLiveWeather(
      geo?.lat ?? catalogCity.lat,
      geo?.lng ?? catalogCity.lng,
      catalogCity.name,
      catalogCity.country
    ),
    fetchCountryInfo(geo?.countryCode ?? catalogCity.countryCode, catalogCity.country),
  ]);

  const builtDays = buildDayPlansFromCatalog(catalogCity, daysCount, tier);
  const builtHotels = catalogCity.hotels.map((h) => ({ ...h, id: uid("hotel") }));
  const builtRestaurants = catalogCity.restaurants.map((r) => ({ ...r, id: uid("rest") }));
  const builtTransport = catalogCity.transport.map((t) => ({ ...t, id: uid("trans") }));

  const newTrip: TripPlan = {
    id: uid("trip"),
    title: `${catalogCity.name} (${daysCount} Days)`,
    destination: catalogCity.name,
    country: catalogCity.country,
    originCity: input.preferences.originCity,
    originLat: originCoords.lat,
    originLng: originCoords.lng,
    lat: geo?.lat ?? catalogCity.lat,
    lng: geo?.lng ?? catalogCity.lng,
    daysCount,
    travelers: input.preferences.travelers,
    budgetTier: tier,
    currency: input.preferences.currency,
    language: input.preferences.language,
    interests: input.preferences.interests,
    overview: "",
    bestSeason: catalogCity.bestTime,
    days: builtDays,
    budget: buildBudget(daysCount, input.preferences.travelers, tier, catalogCity.baseDailyUsd),
    hotels: builtHotels,
    restaurants: builtRestaurants,
    transport: builtTransport,
    weather,
    countryInfo,
    isFavorite: false,
  };

  newTrip.budget = calculateItemizedBudget(newTrip);
  const formattedTotal = formatPrice(newTrip.budget.totalUsd, input.preferences.currency, exchangeRates);
  newTrip.overview = `${catalogCity.tagline} Tuned for ${input.preferences.travelers} traveler(s) on a ${tier} plan — complete start-to-end expense: ${formattedTotal} (${newTrip.budget.lineItems?.length ?? 0} itemized items).`;

  const weatherLine = weather
    ? `\n\nLive Weather in **${catalogCity.name}**: **${weather.currentTempC}°C** (${weather.condition}), humidity ${weather.humidity}%.`
    : "";
  const expenseLine = `\n\n**Total Start-to-End Expense:** **${formattedTotal}** (covers outbound travel, ${Math.max(1, daysCount - 1)} night(s) stay, all ${daysCount} days of activities & meals, and return travel).`;

  return {
    replyText: `${localizedReplyPrefix(input.preferences.language, catalogCity.name, daysCount)}${expenseLine}${weatherLine}`,
    tripPlan: newTrip,
    weather,
    countryInfo,
    exchangeRates,
    engine: "smart-demo",
  };
}
