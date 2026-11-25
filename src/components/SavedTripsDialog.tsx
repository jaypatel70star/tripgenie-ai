"use client";

import { useEffect, useRef } from "react";
import { Calendar, FolderHeart, MapPin, Trash2, X } from "lucide-react";
import { formatPrice } from "@/lib/currency";
import type { CurrencyCode, TripPlan } from "@/types/travel";

interface SavedTripsDialogProps {
  isOpen: boolean;
  trips: TripPlan[];
  activeTripId?: string;
  currency: CurrencyCode;
  exchangeRates: Record<string, number>;
  onClose: () => void;
  onLoadTrip: (trip: TripPlan) => void;
  onDeleteTrip: (id: string) => void;
}

export default function SavedTripsDialog({
  isOpen,
  trips,
  activeTripId,
  currency,
  exchangeRates,
  onClose,
  onLoadTrip,
  onDeleteTrip,
}: SavedTripsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="saved-trips-title"
      onClose={onClose}
      className="studio-dialog w-[min(92dvw,680px)]"
    >
      <div className="glass-panel rounded-2xl overflow-hidden flex flex-col max-h-[82dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <FolderHeart className="h-5 w-5 text-rose-400" />
            <h1 id="saved-trips-title" className="text-base font-bold text-white font-display">
              Saved Favorite Trips ({trips.length})
            </h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close saved trips"
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scroll-region p-4 space-y-3">
          {trips.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No saved trips yet. Generate an itinerary and click the Heart button to store it in SQLite!
            </div>
          ) : (
            trips.map((trip) => {
              const isActive = trip.id === activeTripId;
              return (
                <div
                  key={trip.id}
                  className={`glass-subcard rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                    isActive ? "border-cyan-400/50 bg-cyan-950/20" : "hover:border-white/25"
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white truncate">{trip.title}</h2>
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase font-semibold text-amber-300">
                        {trip.budgetTier}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-cyan-400" /> {trip.destination}, {trip.country}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-emerald-400" /> {trip.daysCount} Days
                      </span>
                      <span className="font-mono text-emerald-300">
                        {formatPrice(trip.budget.totalUsd, currency, exchangeRates)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onLoadTrip(trip);
                        onClose();
                      }}
                      className="rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition-colors cursor-pointer"
                    >
                      Open Trip
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTrip(trip.id)}
                      aria-label={`Delete ${trip.title}`}
                      className="rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-400/25 p-2 text-rose-300 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </dialog>
  );
}
