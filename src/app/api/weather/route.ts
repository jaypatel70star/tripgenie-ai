import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  fetchCountryInfo,
  fetchExchangeRates,
  fetchLiveWeather,
  geocodeLocation,
} from "@/lib/travel-apis";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");

    let lat = latParam ? Number(latParam) : NaN;
    let lng = lngParam ? Number(lngParam) : NaN;
    let locationName = city || "Tokyo";
    let country = "Japan";
    let countryCode = "JP";

    if (city && (Number.isNaN(lat) || Number.isNaN(lng))) {
      const geo = await geocodeLocation(city);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        locationName = geo.name;
        country = geo.country;
        countryCode = geo.countryCode;
      }
    }

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      lat = 35.6762;
      lng = 139.6503;
    }

    const [weather, countryInfo, exchangeRates] = await Promise.all([
      fetchLiveWeather(lat, lng, locationName, country),
      fetchCountryInfo(countryCode, country),
      fetchExchangeRates(),
    ]);

    return NextResponse.json({ weather, countryInfo, exchangeRates });
  } catch (err) {
    console.error("GET /api/weather error:", err);
    return NextResponse.json({ error: "Failed to fetch live weather" }, { status: 500 });
  }
}
