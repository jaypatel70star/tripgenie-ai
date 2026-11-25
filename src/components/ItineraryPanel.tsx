"use client";

import {
  Calendar,
  Clock,
  CloudRain,
  Compass,
  Heart,
  MapPin,
  Plane,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  TrendingDown,
  Umbrella,
  Coffee,
} from "lucide-react";
import TiltCard3D from "@/components/TiltCard3D";
import { formatPrice } from "@/lib/currency";
import type { CurrencyCode, DayPlan, ItineraryActivity, TripPlan } from "@/types/travel";
import type { UIStrings } from "@/lib/i18n";

interface ItineraryPanelProps {
  trip: TripPlan;
  selectedDay: number | "all";
  onSelectDay: (day: number | "all") => void;
  currency: CurrencyCode;
  exchangeRates: Record<string, number>;
  copy: UIStrings;
  isSaving: boolean;
  onSaveTrip: () => void;
  onQuickAdjust: (prompt: string) => void;
  onRemoveActivity: (dayNumber: number, activityId: string) => void;
  onFocusLocation: (lat: number, lng: number, label: string) => void;
}

const CATEGORY_BADGES: Record<ItineraryActivity["category"], string> = {
  sightseeing: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  food: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  culture: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  adventure: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  relax: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  shopping: "bg-pink-500/15 text-pink-300 border-pink-400/30",
  transit: "bg-slate-500/20 text-slate-300 border-slate-400/30",
  nature: "bg-teal-500/15 text-teal-300 border-teal-400/30",
};

export default function ItineraryPanel({
  trip,
  selectedDay,
  onSelectDay,
  currency,
  exchangeRates,
  copy,
  isSaving,
  onSaveTrip,
  onQuickAdjust,
  onRemoveActivity,
  onFocusLocation,
}: ItineraryPanelProps) {
  const fmt = (usd: number) => formatPrice(usd, currency, exchangeRates);

  const visibleDays: DayPlan[] =
    selectedDay === "all"
      ? trip.days
      : trip.days.filter((d) => d.dayNumber === selectedDay);

  return (
    <div className="space-y-4">
      {/* Animated Boarding-Pass Route Banner */}
      <TiltCard3D intensity={5} className="rounded-xl">
        <div className="glass-subcard rounded-xl p-4 space-y-3 bg-gradient-to-br from-teal-950/45 via-slate-900/65 to-amber-950/35 border border-amber-400/20">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950/55 px-3.5 py-2.5 border border-white/10">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-teal-300 font-semibold">
                Departure
              </div>
              <div className="text-sm font-bold text-white truncate">{trip.originCity || "Origin"}</div>
            </div>

            <div className="flex-1 min-w-[120px] max-w-[260px] flex items-center gap-2 px-2">
              <span className="h-2 w-2 rounded-full bg-teal-400 shrink-0" />
              <svg viewBox="0 0 120 20" className="w-full h-5 overflow-visible" aria-hidden="true">
                <path
                  d="M 2 14 Q 60 -2 118 14"
                  fill="none"
                  stroke="rgba(251, 191, 36, 0.55)"
                  strokeWidth="1.75"
                  className="flight-dash-anim"
                />
              </svg>
              <Plane className="h-4 w-4 text-amber-400 shrink-0 plane-cruise" />
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
            </div>

            <div className="text-right min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-amber-300 font-semibold">
                Destination
              </div>
              <div className="text-sm font-bold text-white truncate">
                {trip.destination}, {trip.country}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
                <Compass className="h-3 w-3" /> {trip.destination}, {trip.country}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 uppercase">
                {trip.budgetTier}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 px-2.5 py-0.5 text-[11px] font-mono font-bold text-emerald-300">
                Total (Start→End): {fmt(trip.budget.totalUsd)}
              </span>
              <span className="text-[11px] text-slate-400">Best time: {trip.bestSeason}</span>
            </div>
            <h2 className="text-lg font-bold text-white font-display truncate">{trip.title}</h2>
            <p className="text-xs text-slate-300 leading-relaxed">{trip.overview}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0 no-print">
            <button
              type="button"
              onClick={onSaveTrip}
              disabled={isSaving}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer border ${
                trip.isFavorite
                  ? "bg-rose-500/20 text-rose-200 border-rose-400/50"
                  : "bg-slate-900/70 text-slate-200 border-white/15 hover:border-rose-400/50 hover:text-rose-200"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${trip.isFavorite ? "fill-rose-400 text-rose-400" : ""}`} />
              <span>{trip.isFavorite ? copy.saved : copy.saveFavorite}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              title="Print or Save PDF"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 border border-white/15 hover:border-cyan-400/40 hover:text-cyan-200 transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>

        {/* One-Click Dynamic Plan Adjustment Bar */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5 no-print">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 mr-1">
            <Sparkles className="h-3 w-3 text-amber-400" /> Adjust Plan:
          </span>
          <button
            type="button"
            onClick={() => onQuickAdjust("Make this itinerary 20% cheaper")}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/25 px-2.5 py-1 text-[11px] font-medium text-emerald-200 transition-colors cursor-pointer"
          >
            <TrendingDown className="h-3 w-3" /> {copy.adjustCheaper}
          </button>
          <button
            type="button"
            onClick={() => onQuickAdjust("Switch outdoor activities to rainy day indoor backups")}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/25 px-2.5 py-1 text-[11px] font-medium text-sky-200 transition-colors cursor-pointer"
          >
            <CloudRain className="h-3 w-3" /> {copy.adjustRainy}
          </button>
          <button
            type="button"
            onClick={() => onQuickAdjust("Make the schedule more relaxed with café breaks")}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-400/25 px-2.5 py-1 text-[11px] font-medium text-violet-200 transition-colors cursor-pointer"
          >
            <Coffee className="h-3 w-3" /> {copy.adjustRelaxed}
          </button>
          <button
            type="button"
            onClick={() => onQuickAdjust("Add 1 extra day to this trip")}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/25 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition-colors cursor-pointer"
          >
            <Plus className="h-3 w-3" /> {copy.adjustAddDay}
          </button>
        </div>
        </div>
      </TiltCard3D>

      {/* Day Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-print">
        <button
          type="button"
          onClick={() => onSelectDay("all")}
          className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer border ${
            selectedDay === "all"
              ? "bg-cyan-400/20 text-cyan-200 border-cyan-400/50"
              : "bg-slate-900/60 text-slate-400 border-white/10 hover:text-slate-200"
          }`}
        >
          All {trip.days.length} Days
        </button>
        {trip.days.map((d) => (
          <button
            key={d.dayNumber}
            type="button"
            onClick={() => onSelectDay(d.dayNumber)}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer border ${
              selectedDay === d.dayNumber
                ? "bg-cyan-400/20 text-cyan-200 border-cyan-400/50"
                : "bg-slate-900/60 text-slate-400 border-white/10 hover:text-slate-200"
            }`}
          >
            Day {d.dayNumber}
          </button>
        ))}
      </div>

      {/* Day-by-Day Timeline */}
      <div className="space-y-4">
        {visibleDays.map((day) => (
          <div key={day.dayNumber} className="glass-subcard rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Day {day.dayNumber}</span>
                </div>
                <h3 className="text-sm font-bold text-white mt-0.5">{day.theme}</h3>
              </div>
              <p className="text-xs text-slate-400 max-w-md">{day.summary}</p>
            </div>

            <div className="space-y-2.5">
              {day.activities.map((act, idx) => (
                <TiltCard3D key={act.id} intensity={5} className="rounded-xl">
                  <div
                    style={{ animationDelay: `${idx * 65}ms` }}
                    className="card-enter-3d group relative rounded-xl bg-slate-900/65 border border-white/10 p-3 hover:border-amber-400/40 transition-all"
                  >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-amber-300">
                          <Clock className="h-3 w-3" /> {act.time}
                        </span>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            CATEGORY_BADGES[act.category] ?? CATEGORY_BADGES.sightseeing
                          }`}
                        >
                          {act.category}
                        </span>
                        <span className="text-slate-500">• {act.durationHours}h</span>
                      </div>

                      <h4 className="text-sm font-bold text-white">{act.title}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">{act.description}</p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => onFocusLocation(act.lat, act.lng, act.title)}
                          className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 cursor-pointer"
                        >
                          <MapPin className="h-3 w-3" /> {act.locationName}
                        </button>
                        {act.indoorAlternative && (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Umbrella className="h-3 w-3 text-sky-400" /> Backup: {act.indoorAlternative}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="rounded-lg bg-emerald-500/15 border border-emerald-400/25 px-2 py-1 text-xs font-mono font-semibold text-emerald-300">
                        {act.estimatedCostUsd === 0 ? "Free" : fmt(act.estimatedCostUsd)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveActivity(day.dayNumber, act.id)}
                        title="Remove activity"
                        className="opacity-60 hover:opacity-100 rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer no-print"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  </div>
                </TiltCard3D>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
