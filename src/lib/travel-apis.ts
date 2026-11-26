import type { CountryTravelInfo, WeatherData } from "@/types/travel";

export interface GeocodedPlace {
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string;
}

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear Sky",
  1: "Mainly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing Rime Fog",
  51: "Light Drizzle",
  53: "Moderate Drizzle",
  55: "Dense Drizzle",
  61: "Slight Rain",
  63: "Moderate Rain",
  65: "Heavy Rain",
  71: "Slight Snow",
  73: "Moderate Snow",
  75: "Heavy Snow",
  80: "Rain Showers",
  81: "Moderate Showers",
  82: "Violent Showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ Hail",
};

export function describeWeatherCode(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? "Variable Skies";
}

function buildPackingTips(tempC: number, maxPrecipProb: number): string[] {
  const tips: string[] = [];
  if (tempC >= 27) {
    tips.push("Breathable linen/cotton outfits, polarized sunglasses, and high-SPF sunscreen.");
  } else if (tempC >= 16) {
    tips.push("Light layers (t-shirt + packable jacket) for comfortable day-to-evening transitions.");
  } else if (tempC >= 5) {
    tips.push("Warm mid-layer fleece, windproof jacket, and comfortable closed walking shoes.");
  } else {
    tips.push("Insulated thermal base layers, winter coat, gloves, and warm wool socks.");
  }

  if (maxPrecipProb >= 40) {
    tips.push("Compact travel umbrella or waterproof shell jacket — showers are likely.");
  } else {
    tips.push("Low rain risk expected — great conditions for outdoor walking routes.");
  }

  tips.push("Universal power adapter, portable 10,000mAh power bank, and offline maps backup.");
  return tips;
}

export async function geocodeLocation(query: string): Promise<GeocodedPlace | null> {
  try {
    const clean = query.trim();
    if (!clean) return null;
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=1&language=en&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const first = data?.results?.[0];
    if (!first) return null;
    return {
      name: first.name,
      country: first.country ?? "International",
      countryCode: first.country_code ?? "",
      lat: first.latitude,
      lng: first.longitude,
      timezone: first.timezone ?? "UTC",
    };
  } catch {
    return null;
  }
}

export async function fetchLiveWeather(
  lat: number,
  lng: number,
  locationName: string,
  country: string
): Promise<WeatherData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=7`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const current = json.current ?? {};
    const daily = json.daily ?? {};
    const dates: string[] = daily.time ?? [];

    const forecastDays = dates.map((date, idx) => {
      const code = Number(daily.weather_code?.[idx] ?? 0);
      return {
        date,
        tempMax: Math.round(Number(daily.temperature_2m_max?.[idx] ?? 24)),
        tempMin: Math.round(Number(daily.temperature_2m_min?.[idx] ?? 16)),
        weatherCode: code,
        condition: describeWeatherCode(code),
        precipProbability: Math.round(Number(daily.precipitation_probability_max?.[idx] ?? 10)),
      };
    });

    const maxPrecip = forecastDays.reduce((m, d) => Math.max(m, d.precipProbability), 0);
    const currentTemp = Math.round(Number(current.temperature_2m ?? 22));
    const currentCode = Number(current.weather_code ?? 1);

    return {
      locationName,
      country,
      lat,
      lng,
      timezone: json.timezone ?? "UTC",
      currentTempC: currentTemp,
      apparentTempC: Math.round(Number(current.apparent_temperature ?? currentTemp)),
      humidity: Math.round(Number(current.relative_humidity_2m ?? 55)),
      windKmh: Math.round(Number(current.wind_speed_10m ?? 12)),
      weatherCode: currentCode,
      condition: describeWeatherCode(currentCode),
      isDay: Boolean(current.is_day ?? 1),
      daily: forecastDays,
      packingTips: buildPackingTips(currentTemp, maxPrecip),
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchCountryInfo(countryCode: string, countryName?: string): Promise<CountryTravelInfo | null> {
  try {
    const endpoint = countryCode
      ? `https://restcountries.com/v3.1/alpha/${encodeURIComponent(countryCode)}`
      : countryName
        ? `https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}?fullText=false`
        : null;
    if (!endpoint) return null;

    const res = await fetch(endpoint, { signal: AbortSignal.timeout(4500), next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const raw = await res.json();
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return null;

    const currencyEntries = Object.entries(item.currencies ?? {}) as [string, { name?: string; symbol?: string }][];
    const [currencyCode, currencyMeta] = currencyEntries[0] ?? ["USD", { name: "US Dollar", symbol: "$" }];
    const languages = Object.values(item.languages ?? {}) as string[];
    const root = item.idd?.root ?? "";
    const suffix = Array.isArray(item.idd?.suffixes) ? item.idd.suffixes[0] ?? "" : "";

    return {
      name: item.name?.common ?? countryName ?? "Unknown",
      code: item.cca2 ?? countryCode ?? "",
      flag: item.flag ?? "🌍",
      capital: Array.isArray(item.capital) ? item.capital[0] ?? "—" : "—",
      region: item.region ?? "Global",
      currencyCode,
      currencyName: currencyMeta?.name ?? currencyCode,
      currencySymbol: currencyMeta?.symbol ?? "$",
      languages: languages.slice(0, 3),
      callingCode: root ? `${root}${suffix}` : "—",
      drivingSide: item.car?.side === "left" ? "Left" : "Right",
    };
  } catch {
    return null;
  }
}

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  INR: 84.5,
  GBP: 0.79,
  JPY: 154.0,
  AED: 3.67,
};

export async function fetchExchangeRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=EUR,INR,GBP,JPY",
      { signal: AbortSignal.timeout(4000), next: { revalidate: 3600 } }
    );
    if (!res.ok) return FALLBACK_RATES;
    const data = await res.json();
    return {
      USD: 1,
      EUR: Number(data.rates?.EUR ?? FALLBACK_RATES.EUR),
      INR: Number(data.rates?.INR ?? FALLBACK_RATES.INR),
      GBP: Number(data.rates?.GBP ?? FALLBACK_RATES.GBP),
      JPY: Number(data.rates?.JPY ?? FALLBACK_RATES.JPY),
      AED: 3.67, // AED is pegged to USD
    };
  } catch {
    return FALLBACK_RATES;
  }
}
