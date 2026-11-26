"use client";

import { CheckCircle2, Coins, Lightbulb, ReceiptText, TrendingDown } from "lucide-react";
import TiltCard3D from "@/components/TiltCard3D";
import { CURRENCY_SYMBOLS, formatPrice } from "@/lib/currency";
import type {
  BudgetBreakdown,
  BudgetTier,
  CurrencyCode,
  ExpenseLineItem,
  TravelTransportMode,
} from "@/types/travel";

interface BudgetVisualizerProps {
  budget: BudgetBreakdown;
  budgetTier: BudgetTier;
  currency: CurrencyCode;
  exchangeRates: Record<string, number>;
  daysCount: number;
  travelers: number;
  onChangeCurrency: (c: CurrencyCode) => void;
  onChangeBudgetTier?: (tier: BudgetTier) => void;
  onChangeTransportMode?: (mode: TravelTransportMode) => void;
}

const STAGE_ORDER: ExpenseLineItem["stage"][] = [
  "Trip Start",
  "Accommodation",
  "Day-by-Day",
  "Trip End",
];

const CATEGORY_COLORS: Record<ExpenseLineItem["category"], string> = {
  accommodation: "#22d3ee",
  food: "#34d399",
  transport: "#fbbf24",
  activities: "#a78bfa",
  buffer: "#64748b",
};

export default function BudgetVisualizer({
  budget,
  budgetTier,
  currency,
  exchangeRates,
  daysCount,
  travelers,
  onChangeCurrency,
  onChangeBudgetTier,
  onChangeTransportMode,
}: BudgetVisualizerProps) {
  const fmt = (usd: number) => formatPrice(usd, currency, exchangeRates);

  const segments = [
    { label: "Accommodation", value: budget.accommodationUsd, color: "#22d3ee" },
    { label: "Food & Dining", value: budget.foodUsd, color: "#34d399" },
    { label: "Transport (Start & End)", value: budget.transportUsd, color: "#fbbf24" },
    { label: "Activities & Tickets", value: budget.activitiesUsd, color: "#a78bfa" },
    { label: "Extras & Buffer", value: budget.bufferUsd, color: "#64748b" },
  ];

  const total = Math.max(1, segments.reduce((acc, s) => acc + s.value, 0));
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  const lineItems = budget.lineItems ?? [];

  return (
    <div className="space-y-4">
      {/* Header + Live Currency Switcher */}
      <TiltCard3D intensity={4} className="rounded-xl">
        <div className="glass-subcard rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 border border-amber-400/20">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-300 font-semibold">
            <Coins className="h-3.5 w-3.5" />
            <span>Total Trip Expense (Start → End)</span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-white font-display">
              {fmt(budget.totalUsd)}
            </span>
            <span className="text-xs text-slate-400">
              ({fmt(budget.perDayUsd)}/day • {daysCount}D • {travelers} traveler{travelers > 1 ? "s" : ""} • {lineItems.length} expenses counted)
            </span>
            {budget.targetBudgetUsd && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                  budget.totalUsd <= budget.targetBudgetUsd * 1.06
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/35"
                    : "bg-amber-500/15 text-amber-200 border-amber-400/35"
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                {budget.totalUsd <= budget.targetBudgetUsd * 1.06
                  ? `Fits ${fmt(budget.targetBudgetUsd)} target`
                  : `Target ${fmt(budget.targetBudgetUsd)} (switch to Train or Budget tier)`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => onChangeCurrency(code)}
              className={`rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition-colors cursor-pointer ${
                currency === code
                  ? "bg-amber-400/20 text-amber-200 border border-amber-400/50"
                  : "bg-slate-900/60 text-slate-400 border border-white/10 hover:text-slate-200"
              }`}
            >
              {code}
            </button>
          ))}
        </div>
        </div>
      </TiltCard3D>

      {/* Interactive Stay Tier & Transport Mode Calculator Controls */}
      {(onChangeBudgetTier || onChangeTransportMode) && (
        <div className="glass-subcard rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          {onChangeBudgetTier && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 font-semibold mr-1">Stay Tier:</span>
              {(["budget", "moderate", "luxury"] as BudgetTier[]).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => onChangeBudgetTier(tier)}
                  className={`rounded-lg px-2.5 py-1 capitalize font-semibold border transition-colors cursor-pointer ${
                    budgetTier === tier
                      ? "bg-teal-400/20 text-teal-200 border-teal-400/50"
                      : "bg-slate-900/60 text-slate-400 border-white/10 hover:text-white"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          )}

          {onChangeTransportMode && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 font-semibold mr-1">Travel Mode:</span>
              {(
                [
                  { id: "auto", label: "Smart Auto" },
                  { id: "flight", label: "Flight" },
                  { id: "train", label: "Train / Bus" },
                  { id: "road", label: "Road / Cab" },
                ] as { id: TravelTransportMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeTransportMode(m.id)}
                  className={`rounded-lg px-2.5 py-1 font-semibold border transition-colors cursor-pointer ${
                    (budget.transportMode ?? "auto") === m.id
                      ? "bg-amber-400/20 text-amber-200 border-amber-400/50"
                      : "bg-slate-900/60 text-slate-400 border-white/10 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Donut Chart + Category Bars */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center glass-subcard rounded-xl p-4">
        <div className="md:col-span-5 flex items-center justify-center">
          <div className="relative h-40 w-40">
            <svg viewBox="0 0 148 148" className="h-full w-full -rotate-90">
              <circle
                cx="74"
                cy="74"
                r={radius}
                fill="none"
                stroke="rgba(148,163,184,0.12)"
                strokeWidth="18"
              />
              {segments.map((seg) => {
                const frac = seg.value / total;
                const dash = frac * circumference;
                const offset = -cumulative * circumference;
                cumulative += frac;
                return (
                  <circle
                    key={seg.label}
                    cx="74"
                    cy="74"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="18"
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeDashoffset={offset}
                    strokeLinecap="butt"
                    className="transition-all duration-500"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] text-slate-400">Per Person</span>
              <span className="text-sm font-bold text-white">
                {fmt(Math.round(budget.totalUsd / Math.max(1, travelers)))}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-7 space-y-2.5">
          {segments.map((seg) => {
            const pct = Math.round((seg.value / total) * 100);
            return (
              <div key={seg.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-200 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                    {seg.label}
                  </span>
                  <span className="font-mono text-slate-300">
                    {fmt(seg.value)} <span className="text-slate-500">({pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: seg.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Complete Start-to-End Itemized Expense Ledger */}
      {lineItems.length > 0 && (
        <div className="glass-subcard rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <ReceiptText className="h-4 w-4" />
              <span>Start-to-End Expense Ledger ({lineItems.length} Items Counted)</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Every rupee from departure to return
            </span>
          </div>

          <div className="space-y-3">
            {STAGE_ORDER.map((stage) => {
              const items = lineItems.filter((item) => item.stage === stage);
              if (items.length === 0) return null;
              const stageSum = items.reduce((sum, item) => sum + item.amountUsd, 0);

              return (
                <div key={stage} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                    <span>{stage}</span>
                    <span className="font-mono text-slate-300">Subtotal: {fmt(stageSum)}</span>
                  </div>

                  <div className="divide-y divide-white/5 rounded-xl bg-slate-900/60 border border-white/10 overflow-hidden">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-100 truncate">{item.title}</div>
                            <div className="text-[11px] text-slate-400 truncate">{item.detail}</div>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-emerald-300 shrink-0">
                          {item.amountUsd === 0 ? "Free" : fmt(item.amountUsd)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-emerald-500/15 border border-emerald-400/35 px-3.5 py-2.5 text-sm font-bold text-white">
            <span>Grand Total Expense (Start → End)</span>
            <span className="font-mono text-emerald-300 text-base">{fmt(budget.totalUsd)}</span>
          </div>
        </div>
      )}

      {/* Money-Saving Tips */}
      <div className="glass-subcard rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
          <Lightbulb className="h-3.5 w-3.5" />
          <span>Smart Budget Optimization Tips</span>
        </div>
        <ul className="space-y-1.5">
          {budget.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
              <TrendingDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
