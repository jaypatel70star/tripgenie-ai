"use client";

import { useEffect, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { formatPrice } from "@/lib/currency";
import type { CurrencyCode, TripPlan } from "@/types/travel";

interface InteractiveMap2DProps {
  trip: TripPlan | null;
  focusedCoords?: { lat: number; lng: number; label?: string } | null;
  selectedDay: number | "all";
  currency: CurrencyCode;
  exchangeRates: Record<string, number>;
}

const DAY_COLORS = ["#2dd4bf", "#fbbf24", "#34d399", "#fb7185", "#38bdf8", "#a78bfa", "#f97316"];

export default function InteractiveMap2D({
  trip,
  focusedCoords,
  selectedDay,
  currency,
  exchangeRates,
}: InteractiveMap2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [mapStyle, setMapStyle] = useState<"dark" | "street">("dark");

  useEffect(() => {
    let active = true;
    const el = containerRef.current;
    if (!el || !trip) return;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!active || !el) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(el, {
        center: [trip.lat, trip.lng],
        zoom: 12,
        zoomControl: true,
      });
      mapRef.current = map;

      if (mapStyle === "dark") {
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Tiles &copy; Esri &mdash; English Basemap",
            maxZoom: 16,
          }
        ).addTo(map);
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 16,
          }
        ).addTo(map);
      } else {
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Tiles &copy; Esri &mdash; English World Street Map",
            maxZoom: 18,
          }
        ).addTo(map);
      }

      const boundsPoints: [number, number][] = [];

      const visibleDays =
        selectedDay === "all"
          ? trip.days
          : trip.days.filter((d) => d.dayNumber === selectedDay);

      visibleDays.forEach((day) => {
        const color = DAY_COLORS[(day.dayNumber - 1) % DAY_COLORS.length];
        const routePts: [number, number][] = [];

        day.activities.forEach((act, idx) => {
          const latlng: [number, number] = [act.lat, act.lng];
          routePts.push(latlng);
          boundsPoints.push(latlng);

          const icon = L.divIcon({
            className: "custom-trip-pin",
            html: `<div style="background:${color};color:#030712;font-weight:700;font-size:11px;width:26px;height:26px;border-radius:9999px;display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;box-shadow:0 0 12px ${color};">${day.dayNumber}.${idx + 1}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          L.marker(latlng, { icon })
            .addTo(map)
            .bindPopup(
              `<div style="min-width:170px">
                <div style="font-size:11px;color:${color};font-weight:700">Day ${day.dayNumber} • ${act.time}</div>
                <div style="font-weight:700;margin:2px 0">${act.title}</div>
                <div style="font-size:12px;opacity:.85">${act.locationName} • ~${formatPrice(act.estimatedCostUsd, currency, exchangeRates)}</div>
              </div>`
            );
        });

        if (routePts.length > 1) {
          L.polyline(routePts, {
            color,
            weight: 3,
            opacity: 0.85,
            dashArray: "6 6",
          }).addTo(map);
        }
      });

      // Add hotel pins
      trip.hotels.forEach((hotel) => {
        const latlng: [number, number] = [hotel.lat, hotel.lng];
        boundsPoints.push(latlng);
        const icon = L.divIcon({
          className: "custom-hotel-pin",
          html: `<div style="background:#0f172a;color:#fbbf24;font-weight:700;font-size:12px;width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fbbf24;box-shadow:0 4px 12px rgba(0,0,0,.5);">🏨</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker(latlng, { icon })
          .addTo(map)
          .bindPopup(`<b>${hotel.name}</b><br/>${formatPrice(hotel.pricePerNightUsd, currency, exchangeRates)}/night • ★ ${hotel.rating}`);
      });

      if (boundsPoints.length > 1) {
        map.fitBounds(boundsPoints, { padding: [36, 36], maxZoom: 14 });
      }
    })();

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [trip, selectedDay, currency, exchangeRates, mapStyle]);

  useEffect(() => {
    if (mapRef.current && focusedCoords) {
      mapRef.current.flyTo([focusedCoords.lat, focusedCoords.lng], 14, { duration: 1.1 });
    }
  }, [focusedCoords]);

  if (!trip) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-white/10 bg-slate-950/50 text-sm text-slate-400">
        Generate a trip to inspect street-level stops & routes on the interactive English map.
      </div>
    );
  }

  return (
    <div dir="ltr" className="relative h-full min-h-[360px] w-full overflow-hidden rounded-xl border border-white/15">
      <div ref={containerRef} className="h-full w-full min-h-[360px]" />

      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5 rounded-xl bg-slate-950/80 p-1 backdrop-blur-md border border-white/15">
        <span className="inline-flex items-center gap-1 px-2 text-[11px] font-medium text-teal-300">
          <Layers className="h-3 w-3" /> English Map:
        </span>
        <button
          type="button"
          onClick={() => setMapStyle("dark")}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
            mapStyle === "dark"
              ? "bg-amber-400/20 text-amber-200 border border-amber-400/45"
              : "text-slate-300 hover:text-white"
          }`}
        >
          Twilight
        </button>
        <button
          type="button"
          onClick={() => setMapStyle("street")}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
            mapStyle === "street"
              ? "bg-amber-400/20 text-amber-200 border border-amber-400/45"
              : "text-slate-300 hover:text-white"
          }`}
        >
          Street
        </button>
      </div>
    </div>
  );
}
