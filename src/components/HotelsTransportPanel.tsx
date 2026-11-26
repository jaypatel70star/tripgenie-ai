"use client";

import { Building2, MapPin, Star, Train, Utensils } from "lucide-react";
import TiltCard3D from "@/components/TiltCard3D";
import { formatPrice, formatPriceLevel } from "@/lib/currency";
import type {
  CurrencyCode,
  HotelRecommendation,
  RestaurantRecommendation,
  TransportOption,
} from "@/types/travel";

interface HotelsTransportPanelProps {
  hotels: HotelRecommendation[];
  restaurants: RestaurantRecommendation[];
  transport: TransportOption[];
  currency: CurrencyCode;
  exchangeRates: Record<string, number>;
  onFocusLocation: (lat: number, lng: number, label: string) => void;
}

export default function HotelsTransportPanel({
  hotels,
  restaurants,
  transport,
  currency,
  exchangeRates,
  onFocusLocation,
}: HotelsTransportPanelProps) {
  const fmt = (usd: number) => formatPrice(usd, currency, exchangeRates);

  return (
    <div className="space-y-5">
      {/* Hotels */}
      <section className="space-y-2.5">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
          <Building2 className="h-4 w-4" />
          <span>Recommended Stays</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hotels.map((hotel, idx) => (
            <TiltCard3D key={hotel.id} intensity={6} className="rounded-xl">
              <div
                style={{ animationDelay: `${idx * 70}ms` }}
                className="card-enter-3d h-full glass-subcard rounded-xl p-3.5 flex flex-col justify-between gap-2 hover:border-amber-400/40 transition-colors"
              >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block rounded-md bg-cyan-500/15 border border-cyan-400/30 px-2 py-0.5 text-[10px] uppercase font-semibold text-cyan-300">
                      {hotel.tier}
                    </span>
                    <h4 className="mt-1.5 text-sm font-bold text-white">{hotel.name}</h4>
                    <p className="text-xs text-slate-400">{hotel.neighborhood}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-emerald-300 font-mono">
                      {fmt(hotel.pricePerNightUsd)}
                      <span className="text-[10px] text-slate-400 font-sans">/night</span>
                    </div>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-300">
                      <Star className="h-3 w-3 fill-amber-300" /> {hotel.rating}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {hotel.highlights.map((h) => (
                    <span
                      key={h}
                      className="rounded-md bg-slate-900/75 px-2 py-0.5 text-[11px] text-slate-300 border border-white/5"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onFocusLocation(hotel.lat, hotel.lng, hotel.name)}
                className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200 cursor-pointer self-start"
              >
                <MapPin className="h-3.5 w-3.5" /> Focus on Globe & Map
              </button>
              </div>
            </TiltCard3D>
          ))}
        </div>
      </section>

      {/* Restaurants */}
      <section className="space-y-2.5">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
          <Utensils className="h-4 w-4" />
          <span>Must-Try Restaurants & Cafes</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {restaurants.map((rest, idx) => (
            <TiltCard3D key={rest.id} intensity={6} className="rounded-xl">
              <div
                style={{ animationDelay: `${idx * 70}ms` }}
                className="card-enter-3d h-full glass-subcard rounded-xl p-3.5 space-y-2 hover:border-teal-400/40 transition-colors"
              >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">{rest.name}</h4>
                  <p className="text-xs text-slate-400">
                    {rest.cuisine} • {rest.neighborhood}
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-mono text-emerald-300">
                    {formatPriceLevel(rest.priceLevel, currency)}
                  </span>
                  <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-300 ml-2">
                    <Star className="h-3 w-3 fill-amber-300" /> {rest.rating}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-300">
                <span className="text-amber-300 font-medium">Must try:</span> {rest.mustTryDish}
              </p>
              <button
                type="button"
                onClick={() => onFocusLocation(rest.lat, rest.lng, rest.name)}
                className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 cursor-pointer"
              >
                <MapPin className="h-3.5 w-3.5" /> Locate on Map
              </button>
              </div>
            </TiltCard3D>
          ))}
        </div>
      </section>

      {/* Transport */}
      <section className="space-y-2.5">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
          <Train className="h-4 w-4" />
          <span>Transport & Getting Around</span>
        </h3>
        <div className="space-y-2.5">
          {transport.map((t) => (
            <div
              key={t.id}
              className="glass-subcard rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="space-y-0.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                    {t.mode}
                  </span>
                  <h4 className="text-sm font-bold text-white">{t.title}</h4>
                </div>
                <p className="text-xs text-slate-300">{t.notes}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-white font-mono">{fmt(t.estimatedCostUsd)}</div>
                <div className="text-[11px] text-slate-400">{t.duration}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
