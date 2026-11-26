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
  type GeocodedPlace,
} from "@/lib/travel-apis";
import type {
  BudgetBreakdown,
  BudgetTier,
  CountryTravelInfo,
  DayPlan,
  DestinationSuggestion,
  HotelRecommendation,
  ItineraryActivity,
  RestaurantRecommendation,
  SupportedLanguage,
  TransportOption,
  TravelPreferences,
  TripPlan,
  WeatherData,
} from "@/types/travel";

export interface EngineInput {
  message: string;
  preferences: TravelPreferences;
  currentTrip: TripPlan | null;
  history?: { role: "user" | "assistant"; content: string }[];
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
  geminiError?: string;
}

const SLOT_TIMES: Record<ItineraryActivity["timeSlot"], string> = {
  Morning: "09:30 AM",
  Afternoon: "01:30 PM",
  Evening: "06:00 PM",
  Night: "08:30 PM",
};

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "in", "on", "at", "for", "of", "by", "from", "with", "about", "near",
  "plan", "trip", "travel", "itinerary", "vacation", "holiday", "tour", "visit", "explore",
  "going", "want", "need", "please", "can", "you", "give", "make", "create", "build", "show",
  "tell", "me", "my", "our", "your", "this", "that", "it", "is", "are", "was", "will", "how",
  "much", "cost", "price", "budget", "cheap", "cheaper", "moderate", "luxury", "expensive",
  "affordable", "under", "below", "within", "around", "day", "days", "night", "nights",
  "people", "person", "travelers", "couple", "solo", "family", "friends", "weather", "forecast",
  "rain", "temperature", "climate", "hotel", "hotels", "stay", "stays", "resort", "hostel",
  "restaurant", "restaurants", "food", "eat", "cafe", "cafes", "transport", "reach", "flight",
  "train", "bus", "cab", "suggest", "recommend", "best", "places", "destinations", "ideas",
  "relax", "relaxed", "slower", "rainy", "indoor", "backup", "add", "extra", "more", "less",
  "change", "update", "modify", "adjust", "swap", "remove", "extend", "reduce", "cut", "only",
  "focusing", "good", "nice", "top", "famous", "things", "do", "see", "and", "or", "some",
  "tomorrow", "today", "next", "week", "weekend", "month", "year", "inr", "usd", "rs", "rupees",
]);

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildFallbackBudget(
  daysCount: number,
  travelers: number,
  tier: BudgetTier,
  baseDailyPerPersonUsd: number
): BudgetBreakdown {
  const tierFactor = tier === "budget" ? 0.68 : tier === "luxury" ? 2.15 : 1.0;
  const totalUsd = Math.round(daysCount * travelers * baseDailyPerPersonUsd * tierFactor);
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
    tips: [],
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
    baseDailyUsd: 110,
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
        pricePerNightUsd: 42,
        rating: 4.5,
        highlights: ["Walkable to transit", "Free Wi-Fi & breakfast", "Social rooftop"],
        lat: lat + 0.004,
        lng: lng + 0.002,
      },
      {
        name: `Grand Boutique ${name}`,
        tier: "moderate",
        neighborhood: "Historic District",
        pricePerNightUsd: 118,
        rating: 4.7,
        highlights: ["Design rooms", "Concierge local tours", "Courtyard lounge"],
        lat: lat - 0.004,
        lng: lng - 0.003,
      },
      {
        name: `The ${name} Palace & Spa`,
        tier: "luxury",
        neighborhood: "Waterfront",
        pricePerNightUsd: 340,
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

function parseDaysFromMessage(msg: string, fallback: number): number | null {
  const m = msg.match(/(\d+)\s*[- ]?\s*(day|days|night|nights|दिन|días|jours|日間|tage|أيام)/i);
  if (m) {
    const val = parseInt(m[1], 10);
    if (val >= 1 && val <= 14) return val;
  }
  if (/\bweekend\b/i.test(msg)) return 2;
  return fallback > 0 ? null : null;
}

function parseTravelersFromMessage(msg: string): number | null {
  const m = msg.match(/(\d+)\s*(?:people|persons|travelers|travellers|pax|guests|friends|adults)/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 20) return n;
  }
  if (/\bsolo\b|\bjust me\b|\bmyself\b/i.test(msg)) return 1;
  if (/\bcouple\b|\bhoneymoon\b|\b2 of us\b/i.test(msg)) return 2;
  return null;
}

function parseInterestsFromMessage(msg: string, fallback: string[]): string[] {
  const lower = msg.toLowerCase();
  const map: [RegExp, string][] = [
    [/\b(beach|beaches|island|coast|sea|ocean|tropical)\b/i, "beaches"],
    [/\b(mountain|mountains|hill|hills|snow|trek|hiking|alps|himalaya)\b/i, "mountains"],
    [/\b(food|eat|culinary|cafe|street food|dining|restaurant)\b/i, "food"],
    [/\b(culture|temple|museum|heritage|history|fort|palace|art)\b/i, "culture"],
    [/\b(adventure|rafting|paragliding|snorkel|safari|trekking)\b/i, "adventure"],
    [/\b(relax|spa|chill|calm|wellness|resort|slow)\b/i, "relax"],
    [/\b(romance|romantic|honeymoon|couple)\b/i, "romance"],
    [/\b(nightlife|party|club|bars)\b/i, "nightlife"],
    [/\b(shop|shopping|market|bazaar|mall)\b/i, "shopping"],
  ];
  const found = map.filter(([re]) => re.test(lower)).map(([, tag]) => tag);
  return found.length > 0 ? found : fallback;
}

function parseBudgetFromMessage(
  msg: string,
  prefs: TravelPreferences
): { tier: BudgetTier; requestedUsd?: number; explicitTier: boolean } {
  const lower = msg.toLowerCase();
  let tier: BudgetTier = prefs.budgetTier;
  let explicitTier = false;

  if (/(cheap|cheaper|budget|backpack|student|affordable|low cost|economy|सस्ता|कम बजट|económico)/i.test(lower)) {
    tier = "budget";
    explicitTier = true;
  } else if (/(luxury|5 star|five star|honeymoon|premium|lavish|royal|लग्जरी)/i.test(lower)) {
    tier = "luxury";
    explicitTier = true;
  } else if (/(moderate|mid|balanced|comfort|standard)/i.test(lower)) {
    tier = "moderate";
    explicitTier = true;
  }

  const numMatch =
    msg.match(/(?:\$|usd|rs\.?|inr|₹|€|£)\s*([\d,]+)/i) ??
    msg.match(/([\d,]+)\s*(?:usd|dollars|rupees|inr|euros)/i) ??
    msg.match(/(?:under|budget|within|around|below|max)\s+([\d,]{3,})/i);

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
      if (requestedUsd / Math.max(1, prefs.days) < 110) {
        tier = "budget";
        explicitTier = true;
      } else if (requestedUsd / Math.max(1, prefs.days) > 360) {
        tier = "luxury";
        explicitTier = true;
      }
    }
  }
  return { tier, requestedUsd, explicitTier };
}

function extractOriginFromMessage(msg: string): string | null {
  // Matches "from delhi to china", "departing from pune", "starting from bangalore", "my current location is surat"
  const m =
    msg.match(
      /(?:from|depart(?:ing)?\s+from|starting\s+from|origin(?:\s+(?:is|city\s+is|to|as))?|current\s+location(?:\s+is)?)\s+([a-zA-Z][a-zA-Z\s-]{1,24}?)(?=\s+(?:to|towards|for|with|under|in|on|\d)|[,.!?]|$)/i
    );
  if (!m?.[1]) return null;
  const cleaned = m[1]
    .trim()
    .split(/\s+/)
    .filter((w) => !STOP_WORDS.has(w.toLowerCase()))
    .join(" ");
  return cleaned.length >= 3 ? cleaned : null;
}

function extractPlacePhrase(msg: string): string | null {
  // Priority 1: Explicit "from <origin> to <destination>"
  const fromToMatch = msg.match(
    /\bfrom\s+[a-zA-Z][a-zA-Z\s-]{1,24}?\s+to\s+([a-zA-Z][a-zA-Z\s-]{1,28}?)(?=\s+(?:for|with|under|below|around|in|on|during|focusing|budget|tomorrow|today|\d)|[,.!?]|$)/i
  );
  if (fromToMatch?.[1]) {
    const cleanedDest = fromToMatch[1]
      .trim()
      .split(/\s+/)
      .filter((w) => !STOP_WORDS.has(w.toLowerCase()))
      .join(" ");
    if (cleanedDest.length >= 3) return cleanedDest;
  }

  // Strip "from <origin>" so matchCatalogCity doesn't confuse the origin city (e.g. Delhi/Mumbai) for the destination
  const msgWithoutOrigin = msg.replace(
    /\b(?:from|depart(?:ing)?\s+from|starting\s+from|current\s+location(?:\s+is)?)\s+[a-zA-Z][a-zA-Z\s-]{1,24}?(?=\s+(?:to|towards|for|with|under|\d)|[,.!?]|$)/gi,
    " "
  );

  const catalogHit = matchCatalogCity(msgWithoutOrigin);
  if (catalogHit) return catalogHit.name;

  // Match explicit prepositions case-insensitively (e.g., "trip to udaipur", "weather in kerala", "visit amsterdam")
  const prepPatterns = [
    /(?:trip to|travel to|visit|itinerary for|plan for|going to|vacation in|holiday in|explore|weather in|temperature in|hotels in|restaurants in|reach|to|in|for|about)\s+([a-zA-Z][a-zA-Z\s-]{1,28}?)(?=\s+(?:for|with|under|below|around|in|on|during|focusing|budget|tomorrow|today|\d)|[,.!?]|$)/gi,
  ];
  for (const pat of prepPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pat.exec(msgWithoutOrigin)) !== null) {
      const cleaned = m[1]
        .trim()
        .split(/\s+/)
        .filter((w) => !STOP_WORDS.has(w.toLowerCase()))
        .join(" ");
      if (cleaned.length >= 3) {
        return cleaned;
      }
    }
  }

  // Fallback: check remaining non-stop-words (handles short inputs like "udaipur" or "ladakh 4 days")
  const tokens = msgWithoutOrigin
    .replace(/[^a-zA-Z\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));

  if (tokens.length >= 1 && tokens.length <= 3) {
    return tokens.join(" ");
  }
  return null;
}

const REGION_ALIASES: Record<string, string> = {
  china: "Beijing",
  beijing: "Beijing",
  shanghai: "Shanghai",
  kerala: "Kochi",
  munnar: "Munnar",
  ladakh: "Leh",
  kashmir: "Srinagar",
  andaman: "Port Blair",
  sikkim: "Gangtok",
  rajasthan: "Jaipur",
  himachal: "Manali",
  uttarakhand: "Rishikesh",
  maldives: "Male",
  thailand: "Bangkok",
  vietnam: "Hanoi",
  nepal: "Kathmandu",
  italy: "Rome",
  uk: "London",
  england: "London",
  usa: "New York",
  america: "New York",
  korea: "Seoul",
};

async function resolveDestinationCity(
  candidate: string
): Promise<{ city: CatalogCity; geo: GeocodedPlace | null } | null> {
  const normalized = candidate.trim().toLowerCase();
  const mappedQuery = REGION_ALIASES[normalized] ?? candidate;

  const catalogHit = matchCatalogCity(mappedQuery);
  if (catalogHit) {
    // Keep exact curated catalog coordinates so homonyms (e.g. Goa) never resolve to the wrong country
    return {
      city: catalogHit,
      geo: {
        name: catalogHit.name,
        country: catalogHit.country,
        countryCode: catalogHit.countryCode,
        lat: catalogHit.lat,
        lng: catalogHit.lng,
        timezone: "UTC",
      },
    };
  }
  const geo = await geocodeLocation(mappedQuery);
  if (geo) {
    const displayName =
      REGION_ALIASES[normalized] && normalized === "kerala"
        ? "Kochi (Kerala)"
        : REGION_ALIASES[normalized] && normalized === "ladakh"
          ? "Leh (Ladakh)"
          : geo.name;
    return {
      city: synthesizeCustomCity(displayName, geo.country, geo.lat, geo.lng, geo.countryCode),
      geo: { ...geo, name: displayName },
    };
  }
  return null;
}

async function applyPlanAdjustment(
  trip: TripPlan,
  message: string,
  currency: TravelPreferences["currency"],
  exchangeRates: Record<string, number>
): Promise<{ adjustedTrip: TripPlan; summary: string } | null> {
  const lower = message.toLowerCase();
  const cloned: TripPlan = JSON.parse(JSON.stringify(trip));

  // 1. Change Origin City (e.g., "change origin to Pune", "starting from Bangalore")
  const originMatch = message.match(
    /(?:origin(?:\s+(?:city\s+)?(?:to|as))?|depart(?:ing)?\s+from|starting\s+from|from)\s+([a-zA-Z][a-zA-Z\s-]{2,24}?)(?=\s+(?:to|for|with)|[,.!?]|$)/i
  );
  if (originMatch?.[1] && !/\b(?:day|airport|hotel)\b/i.test(originMatch[1])) {
    const newOrigin = originMatch[1].trim();
    const originGeo = await geocodeLocation(newOrigin);
    if (originGeo) {
      cloned.originCity = originGeo.name;
      cloned.originLat = originGeo.lat;
      cloned.originLng = originGeo.lng;
      cloned.budget = calculateItemizedBudget(cloned, cloned.budget.tips);
      return {
        adjustedTrip: cloned,
        summary: `Updated departure city to ${originGeo.name} — recalculated start-to-end total: ${formatPrice(cloned.budget.totalUsd, currency, exchangeRates)}.`,
      };
    }
  }

  // 2. Change Travelers count
  const newTravelers = parseTravelersFromMessage(message);
  if (newTravelers !== null && newTravelers !== cloned.travelers && !/add.*day|extra day/i.test(lower)) {
    cloned.travelers = newTravelers;
    cloned.budget = calculateItemizedBudget(cloned, cloned.budget.tips);
    return {
      adjustedTrip: cloned,
      summary: `Updated group size to ${newTravelers} traveler(s) — new total: ${formatPrice(cloned.budget.totalUsd, currency, exchangeRates)}.`,
    };
  }

  // 3. Rainy day indoor backup
  if (/(rain|rainy|indoor|storm|umbrella|बारिश|lluvia|pluie|雨|regen|مطر)/i.test(lower)) {
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

  // 4. Cut cost / Budget mode / Switch to luxury
  if (/(cheaper|cut cost|reduce.*cost|save money|less expensive|20%|25%|सस्ता|barato|günstiger)/i.test(lower)) {
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

  if (/(switch to luxury|upgrade to luxury|make it luxury|more luxury)/i.test(lower)) {
    cloned.budgetTier = "luxury";
    cloned.budget = calculateItemizedBudget(cloned, cloned.budget.tips);
    return {
      adjustedTrip: cloned,
      summary: `Upgraded trip to Luxury tier — updated start-to-end total: ${formatPrice(cloned.budget.totalUsd, currency, exchangeRates)}.`,
    };
  }

  // 5. Relaxed pace
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

  // 6. Remove a specific day (e.g., "remove day 3")
  const removeDayMatch = lower.match(/(?:remove|delete|skip)\s+day\s*(\d+)/i);
  if (removeDayMatch && cloned.days.length > 1) {
    const target = parseInt(removeDayMatch[1], 10);
    const filtered = cloned.days.filter((d) => d.dayNumber !== target);
    if (filtered.length < cloned.days.length) {
      cloned.days = filtered.map((d, i) => ({ ...d, dayNumber: i + 1 }));
      cloned.daysCount = cloned.days.length;
      cloned.title = `${cloned.destination} (${cloned.daysCount} Days)`;
      cloned.budget = calculateItemizedBudget(cloned, cloned.budget.tips);
      return {
        adjustedTrip: cloned,
        summary: `Removed Day ${target} — updated ${cloned.daysCount}-day total: ${formatPrice(cloned.budget.totalUsd, currency, exchangeRates)}.`,
      };
    }
  }

  // 7. Add extra day OR change exact number of days (e.g., "make it 3 days", "change to 6 days")
  const addMatch = lower.match(/(?:add|extend|extra)\s*(\d+)?\s*(?:more\s+)?day/i);
  const exactDaysMatch = lower.match(/(?:make it|change to|set to|convert to|reduce to|shorten to)\s*(\d+)\s*days?/i);

  if (addMatch || exactDaysMatch || /\+1/.test(lower)) {
    let targetDays = cloned.days.length + 1;
    if (addMatch?.[1]) targetDays = Math.min(14, cloned.days.length + parseInt(addMatch[1], 10));
    if (exactDaysMatch?.[1]) targetDays = Math.max(1, Math.min(14, parseInt(exactDaysMatch[1], 10)));

    if (targetDays < cloned.days.length) {
      cloned.days = cloned.days.slice(0, targetDays);
    } else {
      const catalog = matchCatalogCity(cloned.destination);
      while (cloned.days.length < targetDays) {
        const nextDayNum = cloned.days.length + 1;
        const sampleActs = catalog?.activities ?? cloned.days[0]?.activities ?? [];
        const pickA = sampleActs[(nextDayNum * 2) % Math.max(1, sampleActs.length)];
        const pickB = sampleActs[(nextDayNum * 2 + 1) % Math.max(1, sampleActs.length)];
        cloned.days.push({
          dayNumber: nextDayNum,
          theme: "Bonus Exploration & Local Market Discovery",
          summary: `Extra curated day in ${cloned.destination} featuring local gems and evening dining.`,
          activities: [
            {
              id: uid(`act-d${nextDayNum}`),
              timeSlot: "Morning",
              time: "10:00 AM",
              title: pickA ? pickA.title : `${cloned.destination} Hidden Neighborhood Walk`,
              description: pickA ? pickA.description : "Slow morning exploring local bakeries and quiet side streets.",
              category: pickA?.category ?? "culture",
              locationName: pickA?.locationName ?? cloned.destination,
              lat: (pickA?.lat ?? cloned.lat) + 0.004,
              lng: (pickA?.lng ?? cloned.lng) + 0.004,
              estimatedCostUsd: pickA?.estimatedCostUsd ?? 15,
              durationHours: pickA?.durationHours ?? 2.5,
              indoorAlternative: pickA?.indoorAlternative ?? `${cloned.destination} Local Museum`,
            },
            {
              id: uid(`act-d${nextDayNum}`),
              timeSlot: "Evening",
              time: "06:30 PM",
              title: pickB ? pickB.title : `Farewell Panoramic Dinner`,
              description: pickB ? pickB.description : `Celebrate your evening in ${cloned.destination} with regional dishes.`,
              category: pickB?.category ?? "food",
              locationName: pickB?.locationName ?? cloned.destination,
              lat: (pickB?.lat ?? cloned.lat) - 0.004,
              lng: (pickB?.lng ?? cloned.lng) - 0.004,
              estimatedCostUsd: pickB?.estimatedCostUsd ?? 30,
              durationHours: pickB?.durationHours ?? 2,
              indoorAlternative: pickB?.indoorAlternative ?? "Cozy Heritage Bistro",
            },
          ],
        });
      }
    }
    cloned.daysCount = cloned.days.length;
    cloned.title = `${cloned.destination} (${cloned.daysCount} Days)`;
    cloned.budget = calculateItemizedBudget(cloned, cloned.budget.tips);
    return {
      adjustedTrip: cloned,
      summary: `Updated trip to ${cloned.daysCount} day(s) — new start-to-end total: ${formatPrice(cloned.budget.totalUsd, currency, exchangeRates)}.`,
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
      return `I've crafted your personalized **${days}-day ${destination} itinerary**! Watch the 3D Globe fly there and explore your day-by-day schedule, live weather, street map, and itemized ₹ budget.`;
  }
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Model returned non-JSON response");
  }
}

async function runGeminiEngine(
  input: EngineInput,
  apiKey: string,
  originCoords: { lat: number; lng: number },
  weather: WeatherData | null,
  countryInfo: CountryTravelInfo | null,
  exchangeRates: Record<string, number>
): Promise<{ output: EngineOutput | null; error?: string }> {
  const ai = new GoogleGenAI({ apiKey });
  const langMeta = getLanguageMeta(input.preferences.language);

  const historyText = (input.history ?? [])
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const systemInstruction = `You are TripGenie AI, an intelligent 3D travel planning assistant.
Respond strictly in ${langMeta.aiName}.
Always quote prices in Indian Rupees (₹ / INR) inside replyText, overview, and tips (e.g., ₹25,000).
Numeric schema fields ending in *Usd must contain approximate USD equivalents (1 USD ≈ ₹84.5) so multi-currency conversion works accurately.

User preferences:
- Origin city: ${input.preferences.originCity}
- Budget tier: ${input.preferences.budgetTier} (Target ~₹${input.preferences.budgetAmount.toLocaleString("en-IN")})
- Default duration: ${input.preferences.days} days, ${input.preferences.travelers} traveler(s)
- Interests: ${input.preferences.interests.join(", ") || "sightseeing, food, culture"}
- Current active trip: ${input.currentTrip ? JSON.stringify({ destination: input.currentTrip.destination, daysCount: input.currentTrip.daysCount, budgetTier: input.currentTrip.budgetTier, originCity: input.currentTrip.originCity }) : "none"}
- Live weather context: ${weather ? `${weather.locationName}: ${weather.currentTempC}°C, ${weather.condition}` : "none yet"}

Rules:
1. Understand ANY user intent accurately:
   - Greetings / general Q&A ("hi", "packing tips", "best time"): set intent="chat" and answer naturally in replyText WITHOUT returning days[] so the current trip stays intact.
   - Weather question ("weather in Goa"): set intent="weather_query", set destination/country so the app fetches live weather, and answer helpfully.
   - Suggest destinations ("suggest beach trips"): set intent="suggest_destinations" and return 4 items in suggestedDestinations[].
   - New itinerary OR trip modification ("plan 4 days in Jaipur", "make it 3 days", "rainy backup", "swap day 2"): set intent="itinerary" or "adjust_itinerary" and return complete days[], hotels[], restaurants[], transport[] with accurate lat/lng.
2. Always return valid JSON matching the schema.`;

  const responseSchema = {
    type: "object",
    properties: {
      replyText: { type: "string" },
      intent: {
        type: "string",
        enum: ["itinerary", "suggest_destinations", "adjust_itinerary", "weather_query", "budget_query", "stays_query", "chat"],
      },
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
                  category: { type: "string", enum: ["sightseeing", "food", "culture", "adventure", "relax", "shopping", "transit", "nature"] },
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

  const modelsToTry = ["gemini-4-hydrogen", "gemini-3.5-flash-lite"];
  let rawText: string | null = null;
  let interactionId: string | undefined;
  let lastError = "";

  // Attempt 1: Official Interactions API
  for (const model of modelsToTry) {
    try {
      const interaction = await ai.interactions.create({
        model,
        input: input.message,
        system_instruction: systemInstruction,
        previous_interaction_id: input.previousInteractionId,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: responseSchema,
        },
      });
      if (interaction.output_text) {
        rawText = interaction.output_text;
        interactionId = interaction.id;
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Retry without previous_interaction_id once if stale
      if (input.previousInteractionId) {
        try {
          const interaction = await ai.interactions.create({
            model,
            input: historyText ? `${historyText}\nUser: ${input.message}` : input.message,
            system_instruction: systemInstruction,
            response_format: {
              type: "text",
              mime_type: "application/json",
              schema: responseSchema,
            },
          });
          if (interaction.output_text) {
            rawText = interaction.output_text;
            interactionId = interaction.id;
            break;
          }
        } catch (retryErr) {
          lastError = retryErr instanceof Error ? retryErr.message : String(retryErr);
        }
      }
    }
  }

  // Attempt 2: Fallback to models.generateContent if Interactions API failed
  if (!rawText) {
    for (const model of modelsToTry) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: historyText ? `${historyText}\nUser: ${input.message}` : input.message,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
          },
        });
        if (res.text) {
          rawText = res.text;
          break;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  if (!rawText) {
    console.warn("Gemini failed across models:", lastError);
    return { output: null, error: lastError || "Gemini API request failed." };
  }

  try {
    const parsed = extractJsonObject(rawText) as Record<string, unknown>;
    let tripPlan: TripPlan | null = input.currentTrip;
    let resolvedWeather = weather;
    let resolvedCountry = countryInfo;

    const parsedDest = typeof parsed.destination === "string" ? parsed.destination : undefined;
    const parsedDays = Array.isArray(parsed.days) ? (parsed.days as DayPlan[]) : [];

    if (parsedDest && parsedDays.length > 0) {
      const geo = await geocodeLocation(parsedDest);
      const lat = Number(parsed.lat ?? geo?.lat ?? 35.6762);
      const lng = Number(parsed.lng ?? geo?.lng ?? 139.6503);
      const country = (typeof parsed.country === "string" && parsed.country) || geo?.country || "International";

      const [freshWeather, freshCountry] = await Promise.all([
        fetchLiveWeather(lat, lng, parsedDest, country),
        geo?.countryCode ? fetchCountryInfo(geo.countryCode, country) : fetchCountryInfo("", country),
      ]);
      resolvedWeather = freshWeather ?? weather;
      resolvedCountry = freshCountry ?? countryInfo;

      const daysCount = Number(parsed.daysCount ?? parsedDays.length);
      const draftTrip: TripPlan = {
        id: input.currentTrip && input.currentTrip.destination === parsedDest ? input.currentTrip.id : uid("trip"),
        title: `${parsedDest} (${daysCount} Days)`,
        destination: parsedDest,
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
        overview:
          (typeof parsed.overview === "string" && parsed.overview) ||
          `Personalized ${daysCount}-day trip to ${parsedDest}.`,
        bestSeason: (typeof parsed.bestSeason === "string" && parsed.bestSeason) || "Year-round",
        days: parsedDays.map((d) => ({
          ...d,
          activities: (d.activities ?? []).map((a) => ({ ...a, id: a.id || uid("act") })),
        })),
        budget: buildFallbackBudget(daysCount, input.preferences.travelers, input.preferences.budgetTier, 130),
        hotels: (Array.isArray(parsed.hotels) ? (parsed.hotels as HotelRecommendation[]) : []).map((h) => ({
          ...h,
          id: uid("hotel"),
        })),
        restaurants: (Array.isArray(parsed.restaurants) ? (parsed.restaurants as RestaurantRecommendation[]) : []).map((r) => ({
          ...r,
          id: uid("rest"),
        })),
        transport: (Array.isArray(parsed.transport) ? (parsed.transport as TransportOption[]) : []).map((t) => ({
          ...t,
          id: uid("trans"),
        })),
        suggestedDestinations: Array.isArray(parsed.suggestedDestinations)
          ? (parsed.suggestedDestinations as DestinationSuggestion[])
          : undefined,
        weather: resolvedWeather,
        countryInfo: resolvedCountry,
        isFavorite: input.currentTrip?.isFavorite ?? false,
      };
      draftTrip.budget = calculateItemizedBudget(draftTrip);
      tripPlan = draftTrip;
    } else if (parsedDest && parsed.intent === "weather_query") {
      const geo = await geocodeLocation(parsedDest);
      if (geo) {
        resolvedWeather = await fetchLiveWeather(geo.lat, geo.lng, geo.name, geo.country);
        resolvedCountry = await fetchCountryInfo(geo.countryCode, geo.country);
      }
    }

    return {
      output: {
        replyText: String(parsed.replyText || "Here is your travel update!"),
        tripPlan,
        suggestions: Array.isArray(parsed.suggestedDestinations)
          ? (parsed.suggestedDestinations as DestinationSuggestion[])
          : undefined,
        adjustmentSummary:
          typeof parsed.adjustmentSummary === "string" ? parsed.adjustmentSummary : undefined,
        weather: resolvedWeather,
        countryInfo: resolvedCountry,
        exchangeRates,
        previousInteractionId: interactionId,
        engine: "gemini",
      },
    };
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    return { output: null, error: `Gemini JSON parse error: ${msg}` };
  }
}

export async function processTravelChat(input: EngineInput): Promise<EngineOutput> {
  const effectiveKey = input.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || "";
  const messageOrigin = extractOriginFromMessage(input.message);
  const resolvedOriginName = messageOrigin || input.preferences.originCity?.trim() || "Mumbai";

  const [originGeo, exchangeRates] = await Promise.all([
    geocodeLocation(resolvedOriginName),
    fetchExchangeRates(),
  ]);
  const finalOriginCity = originGeo?.name ?? resolvedOriginName;
  const originCoords = {
    lat: originGeo?.lat ?? 19.076,
    lng: originGeo?.lng ?? 72.8777,
  };

  const effectivePreferences: TravelPreferences = {
    ...input.preferences,
    originCity: finalOriginCity,
  };

  let geminiError: string | undefined;

  if (effectiveKey) {
    const geminiAttempt = await runGeminiEngine(
      { ...input, preferences: effectivePreferences },
      effectiveKey,
      originCoords,
      input.currentTrip?.weather ?? null,
      input.currentTrip?.countryInfo ?? null,
      exchangeRates
    );
    if (geminiAttempt.output) {
      return geminiAttempt.output;
    }
    geminiError = geminiAttempt.error;
  }

  // Built-in Intelligent Smart Demo Engine
  const msg = input.message.trim();
  const lower = msg.toLowerCase();
  const currency = input.preferences.currency;
  const fmt = (usd: number) => formatPrice(usd, currency, exchangeRates);

  // 1. Greetings & general help
  if (
    /^(hi|hello|hey|namaste|hola|bonjour|yo|good\s+(morning|afternoon|evening)|who are you|what can you do|help|capabilities)\b[!?. ]*$/i.test(
      lower
    ) ||
    /^(what can you do|how do you work|help me)\??$/i.test(lower)
  ) {
    const activeNote = input.currentTrip
      ? `\n\nYour current loaded trip is **${input.currentTrip.title}** (Start-to-End total: **${fmt(input.currentTrip.budget.totalUsd)}**). You can ask me to adjust it or plan a brand new city!`
      : "";
    return {
      replyText:
        `Hello! I'm **TripGenie AI**, your 3D travel assistant. Tell me anything naturally—for example:\n• *"Plan a 4-day trip to Jaipur under ₹25,000"*\n• *"What is the live weather in Goa?"*\n• *"Suggest 4 budget beach destinations"*\n• *"Best hotels & food in Manali"*\n• *"Make it 3 days"* or *"Cut cost 20%"*${activeNote}`,
      tripPlan: input.currentTrip,
      weather: input.currentTrip?.weather ?? null,
      countryInfo: input.currentTrip?.countryInfo ?? null,
      exchangeRates,
      engine: "smart-demo",
      geminiError,
    };
  }

  // Extract place candidate early (skip if user is explicitly changing their origin city)
  const isExplicitOriginChange =
    /(?:change|set|update|my)\s+origin|depart(?:ing)?\s+from|starting\s+from/i.test(lower);
  const explicitPlace = isExplicitOriginChange ? null : extractPlacePhrase(msg);
  const resolvedPlace = explicitPlace ? await resolveDestinationCity(explicitPlace) : null;

  // 2. Destination Suggestions
  const isSuggestRequest =
    /(suggest|recommend.*(?:place|destination|trip|city|country)|where should i go|best places|ideas for|which destination|सुझाएं|sugiere|suggère|提案|schlage|اقترح)/i.test(
      lower
    ) && !resolvedPlace;

  if (isSuggestRequest) {
    const { tier } = parseBudgetFromMessage(msg, input.preferences);
    const parsedInterests = parseInterestsFromMessage(msg, input.preferences.interests);
    const suggestions = suggestDestinationsByProfile(parsedInterests, tier, 4);
    const top = suggestions[0];
    const [weather, countryInfo] = await Promise.all([
      fetchLiveWeather(top.lat, top.lng, top.name, top.country),
      fetchCountryInfo("", top.country),
    ]);

    return {
      replyText: `Based on your **${tier}** budget and interests (**${parsedInterests.join(", ")}**), here are **${suggestions.length} top destination matches**! Tap any card below to fly the 3D Globe there and generate its complete itinerary.`,
      tripPlan: input.currentTrip,
      suggestions,
      weather,
      countryInfo,
      exchangeRates,
      engine: "smart-demo",
      geminiError,
    };
  }

  // 3. Weather Query (without explicit itinerary creation words)
  const isItineraryVerb = /\b(plan|itinerary|schedule|create|build|make a trip|days? trip|days? in)\b/i.test(lower);
  const isWeatherQuery =
    /\b(weather|temperature|temp|rain|raining|rainy|forecast|humidity|climate|umbrella|cold|hot)\b/i.test(lower) &&
    !isItineraryVerb &&
    !/rainy day backup|indoor/i.test(lower);

  if (isWeatherQuery) {
    const targetName = resolvedPlace?.city.name ?? input.currentTrip?.destination ?? "Mumbai";
    const targetCountry = resolvedPlace?.city.country ?? input.currentTrip?.country ?? "India";
    const lat = resolvedPlace?.geo?.lat ?? resolvedPlace?.city.lat ?? input.currentTrip?.lat ?? 19.076;
    const lng = resolvedPlace?.geo?.lng ?? resolvedPlace?.city.lng ?? input.currentTrip?.lng ?? 72.8777;
    const cc = resolvedPlace?.geo?.countryCode ?? resolvedPlace?.city.countryCode ?? "";

    const [weather, countryInfo] = await Promise.all([
      fetchLiveWeather(lat, lng, targetName, targetCountry),
      fetchCountryInfo(cc, targetCountry),
    ]);

    const replyText = weather
      ? `Live weather in **${weather.locationName}, ${weather.country}**: **${weather.currentTempC}°C** (feels like ${weather.apparentTempC}°C), **${weather.condition}**, humidity **${weather.humidity}%**, wind **${weather.windKmh} km/h**.\n\n**Packing tip:** ${weather.packingTips[0]} Check the **Weather & Intel** tab for the full 7-day forecast!`
      : `I couldn't reach the live weather service for **${targetName}** right now—please check your internet connection and try again.`;

    return {
      replyText,
      tripPlan: input.currentTrip,
      weather,
      countryInfo,
      exchangeRates,
      engine: "smart-demo",
      geminiError,
    };
  }

  // 4. Hotels / Restaurants / Transport Query (when not creating a whole new trip)
  const isStaysQuery =
    /\b(hotel|hotels|hostel|resort|stay|stays|restaurant|restaurants|food|eat|dish|dishes|cafe|cafes|transport|how to reach|flight|train|bus)\b/i.test(
      lower
    ) && !isItineraryVerb;

  if (isStaysQuery && (resolvedPlace || input.currentTrip)) {
    const city = resolvedPlace?.city ?? (input.currentTrip ? matchCatalogCity(input.currentTrip.destination) : null);
    if (city || input.currentTrip) {
      const name = city?.name ?? input.currentTrip!.destination;
      const hotels = city?.hotels ?? input.currentTrip!.hotels;
      const rests = city?.restaurants ?? input.currentTrip!.restaurants;
      const trans = city?.transport ?? input.currentTrip!.transport;

      if (/\b(restaurant|restaurants|food|eat|dish|dishes|cafe|cafes)\b/i.test(lower)) {
        const list = rests
          .map((r) => `• **${r.name}** (${r.cuisine}, ${r.neighborhood}) — Must try: *${r.mustTryDish}*`)
          .join("\n");
        return {
          replyText: `Top dining picks in **${name}**:\n${list}\n\nOpen the **Stays & Dining** tab to pinpoint them on the map!`,
          tripPlan: input.currentTrip,
          weather: input.currentTrip?.weather ?? null,
          countryInfo: input.currentTrip?.countryInfo ?? null,
          exchangeRates,
          engine: "smart-demo",
          geminiError,
        };
      }
      if (/\b(transport|how to reach|flight|train|bus)\b/i.test(lower)) {
        const list = trans
          .map((t) => `• **${t.title}** (${t.mode}, ${t.duration}) — ~**${fmt(t.estimatedCostUsd)}**: ${t.notes}`)
          .join("\n");
        return {
          replyText: `Best transport options for **${name}**:\n${list}`,
          tripPlan: input.currentTrip,
          weather: input.currentTrip?.weather ?? null,
          countryInfo: input.currentTrip?.countryInfo ?? null,
          exchangeRates,
          engine: "smart-demo",
          geminiError,
        };
      }
      const list = hotels
        .map((h) => `• **${h.name}** (${h.tier.toUpperCase()}, ${h.neighborhood}) — **${fmt(h.pricePerNightUsd)}/night** ★ ${h.rating}`)
        .join("\n");
      return {
        replyText: `Recommended stays in **${name}**:\n${list}\n\nYou can inspect all stays and focus them on the 3D Globe in the **Stays & Dining** tab.`,
        tripPlan: input.currentTrip,
        weather: input.currentTrip?.weather ?? null,
        countryInfo: input.currentTrip?.countryInfo ?? null,
        exchangeRates,
        engine: "smart-demo",
        geminiError,
      };
    }
  }

  // 5. Budget Breakdown Question on Current Trip (if no new city named)
  const isBudgetQuestion =
    /\b(how much|total cost|total expense|budget breakdown|expense breakdown|expenses|cost breakdown)\b/i.test(lower) &&
    !resolvedPlace;

  if (isBudgetQuestion && input.currentTrip) {
    const b = input.currentTrip.budget;
    return {
      replyText:
        `Here is your complete start-to-end **${input.currentTrip.title}** expense breakdown:\n` +
        `• **Stay:** ${fmt(b.accommodationUsd)}\n` +
        `• **Food & Dining:** ${fmt(b.foodUsd)}\n` +
        `• **Transport (Outbound + Local + Return):** ${fmt(b.transportUsd)}\n` +
        `• **Activities & Tickets:** ${fmt(b.activitiesUsd)}\n` +
        `• **Extras & 5% Buffer:** ${fmt(b.bufferUsd)}\n\n` +
        `**Grand Total (Start → End): ${fmt(b.totalUsd)}** (${fmt(b.perDayUsd)}/day for ${input.currentTrip.travelers} traveler(s)).`,
      tripPlan: input.currentTrip,
      weather: input.currentTrip.weather ?? null,
      countryInfo: input.currentTrip.countryInfo ?? null,
      exchangeRates,
      engine: "smart-demo",
      geminiError,
    };
  }

  // 6. Adjust Current Trip (when no different city is requested)
  const switchingToNewCity =
    resolvedPlace &&
    input.currentTrip &&
    resolvedPlace.city.name.toLowerCase() !== input.currentTrip.destination.toLowerCase();

  if (input.currentTrip && !switchingToNewCity) {
    const adjusted = await applyPlanAdjustment(input.currentTrip, msg, currency, exchangeRates);
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
        geminiError,
      };
    }
  }

  // 7. Build a New Destination Itinerary (only if we actually resolved a destination or user explicitly asked for a trip)
  if (!resolvedPlace && !isItineraryVerb) {
    return {
      replyText:
        `I want to make sure I help you accurately! Could you tell me which **city or destination** you'd like to plan, or what you'd like to check?\n\nFor example:\n• *"Plan a 4-day trip to Udaipur under ₹25,000"*\n• *"What's the weather in London?"*\n• *"Suggest 4 budget mountain trips"*`,
      tripPlan: input.currentTrip,
      weather: input.currentTrip?.weather ?? null,
      countryInfo: input.currentTrip?.countryInfo ?? null,
      exchangeRates,
      engine: "smart-demo",
      geminiError,
    };
  }

  const finalPlace = resolvedPlace ?? {
    city: input.currentTrip ? matchCatalogCity(input.currentTrip.destination) ?? DESTINATION_CATALOG[0] : DESTINATION_CATALOG[0],
    geo: null,
  };

  const catalogCity = finalPlace.city;
  const geo = finalPlace.geo;
  const daysCount = parseDaysFromMessage(msg, input.preferences.days) ?? input.preferences.days ?? 4;
  const travelersCount = parseTravelersFromMessage(msg) ?? input.preferences.travelers ?? 2;
  const { tier, requestedUsd } = parseBudgetFromMessage(msg, input.preferences);
  const interests = parseInterestsFromMessage(msg, input.preferences.interests);

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
    originCity: finalOriginCity,
    originLat: originCoords.lat,
    originLng: originCoords.lng,
    lat: geo?.lat ?? catalogCity.lat,
    lng: geo?.lng ?? catalogCity.lng,
    daysCount,
    travelers: travelersCount,
    budgetTier: tier,
    currency,
    language: input.preferences.language,
    interests,
    overview: "",
    bestSeason: catalogCity.bestTime,
    days: builtDays,
    budget: buildFallbackBudget(daysCount, travelersCount, tier, catalogCity.baseDailyUsd),
    hotels: builtHotels,
    restaurants: builtRestaurants,
    transport: builtTransport,
    weather,
    countryInfo,
    isFavorite: false,
  };

  newTrip.budget = calculateItemizedBudget(newTrip, undefined, {
    targetBudgetUsd: requestedUsd,
  });
  const formattedTotal = fmt(newTrip.budget.totalUsd);
  newTrip.overview = `${catalogCity.tagline} Tuned for ${travelersCount} traveler(s) from ${finalOriginCity} on a ${tier} plan — complete start-to-end expense: ${formattedTotal} (${newTrip.budget.lineItems?.length ?? 0} itemized items).`;

  const weatherLine = weather
    ? `\n\nLive Weather in **${catalogCity.name}**: **${weather.currentTempC}°C** (${weather.condition}), humidity ${weather.humidity}%.`
    : "";
  const expenseLine = `\n\n**Total Start-to-End Expense (${finalOriginCity} ↔ ${catalogCity.name}):** **${formattedTotal}** (covers outbound travel, ${Math.max(1, daysCount - 1)} night(s) stay, all ${daysCount} days of activities & meals, and return travel).`;

  return {
    replyText: `${localizedReplyPrefix(input.preferences.language, catalogCity.name, daysCount)}${expenseLine}${weatherLine}`,
    tripPlan: newTrip,
    weather,
    countryInfo,
    exchangeRates,
    engine: "smart-demo",
    geminiError,
  };
}
