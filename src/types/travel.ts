export type SupportedLanguage = "en" | "hi" | "es" | "fr" | "ja" | "de" | "ar";

export type BudgetTier = "budget" | "moderate" | "luxury";

export type CurrencyCode = "USD" | "EUR" | "INR" | "GBP" | "JPY" | "AED";

export interface TravelPreferences {
  originCity: string;
  budgetAmount: number;
  budgetTier: BudgetTier;
  currency: CurrencyCode;
  days: number;
  travelers: number;
  interests: string[];
  language: SupportedLanguage;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ItineraryActivity {
  id: string;
  timeSlot: "Morning" | "Afternoon" | "Evening" | "Night";
  time: string;
  title: string;
  description: string;
  category: "sightseeing" | "food" | "culture" | "adventure" | "relax" | "shopping" | "transit" | "nature";
  locationName: string;
  lat: number;
  lng: number;
  estimatedCostUsd: number;
  durationHours: number;
  indoorAlternative?: string;
}

export interface DayPlan {
  dayNumber: number;
  theme: string;
  summary: string;
  activities: ItineraryActivity[];
}

export interface ExpenseLineItem {
  id: string;
  stage: "Trip Start" | "Accommodation" | "Day-by-Day" | "Trip End";
  dayNumber?: number;
  category: "accommodation" | "food" | "transport" | "activities" | "buffer";
  title: string;
  detail: string;
  amountUsd: number;
}

export interface BudgetBreakdown {
  totalUsd: number;
  perDayUsd: number;
  accommodationUsd: number;
  foodUsd: number;
  transportUsd: number;
  activitiesUsd: number;
  bufferUsd: number;
  tips: string[];
  lineItems?: ExpenseLineItem[];
}

export interface HotelRecommendation {
  id: string;
  name: string;
  tier: BudgetTier;
  neighborhood: string;
  pricePerNightUsd: number;
  rating: number;
  highlights: string[];
  lat: number;
  lng: number;
}

export interface RestaurantRecommendation {
  id: string;
  name: string;
  cuisine: string;
  priceLevel: "$" | "$$" | "$$$";
  mustTryDish: string;
  neighborhood: string;
  rating: number;
  lat: number;
  lng: number;
}

export interface TransportOption {
  id: string;
  mode: "Flight" | "High-Speed Train" | "Metro & Transit Pass" | "Airport Express" | "Cab / Ride-share" | "Ferry / Boat";
  title: string;
  duration: string;
  estimatedCostUsd: number;
  notes: string;
}

export interface DestinationSuggestion {
  name: string;
  country: string;
  lat: number;
  lng: number;
  matchScore: number;
  bestTime: string;
  estimatedDailyUsd: number;
  tagline: string;
  highlights: string[];
}

export interface DailyWeather {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  condition: string;
  precipProbability: number;
}

export interface WeatherData {
  locationName: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  currentTempC: number;
  apparentTempC: number;
  humidity: number;
  windKmh: number;
  weatherCode: number;
  condition: string;
  isDay: boolean;
  daily: DailyWeather[];
  packingTips: string[];
  fetchedAt: string;
}

export interface CountryTravelInfo {
  name: string;
  code: string;
  flag: string;
  capital: string;
  region: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  languages: string[];
  callingCode: string;
  drivingSide: string;
}

export interface TripPlan {
  id: string;
  title: string;
  destination: string;
  country: string;
  originCity: string;
  originLat: number;
  originLng: number;
  lat: number;
  lng: number;
  daysCount: number;
  travelers: number;
  budgetTier: BudgetTier;
  currency: CurrencyCode;
  language: SupportedLanguage;
  interests: string[];
  overview: string;
  bestSeason: string;
  days: DayPlan[];
  budget: BudgetBreakdown;
  hotels: HotelRecommendation[];
  restaurants: RestaurantRecommendation[];
  transport: TransportOption[];
  suggestedDestinations?: DestinationSuggestion[];
  weather?: WeatherData | null;
  countryInfo?: CountryTravelInfo | null;
  isFavorite: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  engine?: "gemini" | "smart-demo";
  tripUpdated?: boolean;
  suggestions?: DestinationSuggestion[];
  adjustmentSummary?: string;
}

export interface ChatResponsePayload {
  sessionId: string;
  assistantMessage: ChatMessage;
  tripPlan: TripPlan | null;
  suggestions?: DestinationSuggestion[];
  weather: WeatherData | null;
  countryInfo: CountryTravelInfo | null;
  exchangeRates: Record<string, number>;
  previousInteractionId?: string;
  engine: "gemini" | "smart-demo";
}
