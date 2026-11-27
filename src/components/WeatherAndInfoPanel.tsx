"use client";

import {
  Backpack,
  CloudRain,
  Droplets,
  Globe2,
  Phone,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react";
import type { CountryTravelInfo, WeatherData } from "@/types/travel";

interface WeatherAndInfoPanelProps {
  weather: WeatherData | null;
  countryInfo: CountryTravelInfo | null;
  exchangeRates: Record<string, number>;
}

export default function WeatherAndInfoPanel({
  weather,
  countryInfo,
  exchangeRates,
}: WeatherAndInfoPanelProps) {
  const inrRate = exchangeRates.INR ?? 84.5;
  const targetRate = countryInfo?.currencyCode ? exchangeRates[countryInfo.currencyCode] : undefined;
  const localCurrencyRate =
    countryInfo?.currencyCode && targetRate
      ? countryInfo.currencyCode === "INR"
        ? "Local Currency: Indian Rupee (₹)"
        : `1 ${countryInfo.currencyCode} ≈ ₹${(inrRate / targetRate).toFixed(2)}`
      : null;

  return (
    <div className="space-y-4">
      {/* Live Weather Hero */}
      {weather ? (
        <div className="glass-subcard rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-300 font-semibold">
                {weather.weatherCode >= 51 ? (
                  <CloudRain className="h-4 w-4 text-sky-400" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-400" />
                )}
                <span>Live Weather • {weather.locationName}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-4xl font-bold text-white font-display">
                  {weather.currentTempC}°C
                </span>
                <span className="text-sm text-slate-300">{weather.condition}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-slate-300">
              <div className="rounded-lg bg-slate-900/70 px-3 py-2 border border-white/10 flex items-center gap-1.5">
                <Thermometer className="h-3.5 w-3.5 text-amber-400" />
                <span>Feels {weather.apparentTempC}°C</span>
              </div>
              <div className="rounded-lg bg-slate-900/70 px-3 py-2 border border-white/10 flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-cyan-400" />
                <span>{weather.humidity}% Humidity</span>
              </div>
              <div className="rounded-lg bg-slate-900/70 px-3 py-2 border border-white/10 flex items-center gap-1.5">
                <Wind className="h-3.5 w-3.5 text-indigo-400" />
                <span>{weather.windKmh} km/h</span>
              </div>
            </div>
          </div>

          {/* 7-Day Forecast */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {weather.daily.map((day) => {
              const label = new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
              });
              return (
                <div
                  key={day.date}
                  className="rounded-xl bg-slate-900/65 border border-white/10 p-2.5 text-center space-y-1"
                >
                  <div className="text-[11px] font-semibold text-slate-300">{label}</div>
                  <div className="text-xs font-bold text-white">
                    {day.tempMax}° <span className="text-slate-500 font-normal">/ {day.tempMin}°</span>
                  </div>
                  <div className="text-[10px] text-cyan-300 truncate" title={day.condition}>
                    {day.condition}
                  </div>
                  <div className="text-[10px] text-sky-400/90">💧 {day.precipProbability}%</div>
                </div>
              );
            })}
          </div>

          {/* Packing Recommendations */}
          <div className="rounded-xl bg-cyan-950/25 border border-cyan-400/20 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <Backpack className="h-3.5 w-3.5" />
              <span>AI Weather Packing Checklist</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-300">
              {weather.packingTips.map((tip, i) => (
                <li key={i}>• {tip}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="glass-subcard rounded-xl p-6 text-center text-xs text-slate-400">
          Plan or select a destination to fetch live Open-Meteo weather & 7-day forecast.
        </div>
      )}

      {/* Destination Travel Intelligence */}
      {countryInfo && (
        <div className="glass-subcard rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Globe2 className="h-4 w-4" />
              <span>Country Travel Intel</span>
            </div>
            <span className="text-xl" aria-label={countryInfo.name}>
              {countryInfo.flag} {countryInfo.name}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-lg bg-slate-900/65 p-2.5 border border-white/10">
              <div className="text-slate-400">Capital & Region</div>
              <div className="mt-0.5 font-semibold text-white">
                {countryInfo.capital} ({countryInfo.region})
              </div>
            </div>
            <div className="rounded-lg bg-slate-900/65 p-2.5 border border-white/10">
              <div className="text-slate-400">Currency</div>
              <div className="mt-0.5 font-semibold text-white">
                {countryInfo.currencyCode} ({countryInfo.currencySymbol})
              </div>
              {localCurrencyRate && (
                <div className="text-[10px] text-emerald-300 font-mono mt-0.5">{localCurrencyRate}</div>
              )}
            </div>
            <div className="rounded-lg bg-slate-900/65 p-2.5 border border-white/10">
              <div className="text-slate-400">Languages</div>
              <div className="mt-0.5 font-semibold text-white truncate">
                {countryInfo.languages.join(", ") || "Local"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-900/65 p-2.5 border border-white/10">
              <div className="text-slate-400 flex items-center gap-1">
                <Phone className="h-3 w-3" /> Dial Code
              </div>
              <div className="mt-0.5 font-semibold text-white font-mono">{countryInfo.callingCode}</div>
            </div>
            <div className="rounded-lg bg-slate-900/65 p-2.5 border border-white/10">
              <div className="text-slate-400">Driving Side</div>
              <div className="mt-0.5 font-semibold text-white">{countryInfo.drivingSide}-hand</div>
            </div>
            <div className="rounded-lg bg-slate-900/65 p-2.5 border border-white/10">
              <div className="text-slate-400">Local Timezone</div>
              <div className="mt-0.5 font-semibold text-white truncate">{weather?.timezone ?? "UTC"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
