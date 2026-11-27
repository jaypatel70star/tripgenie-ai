"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  MapPin,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import TiltCard3D from "@/components/TiltCard3D";
import { formatPrice } from "@/lib/currency";
import type { ChatHistoryEntry, CurrencyCode } from "@/types/travel";

interface HistoryPanelProps {
  sessions: ChatHistoryEntry[];
  activeSessionId: string;
  currency: CurrencyCode;
  exchangeRates: Record<string, number>;
  isLoading: boolean;
  onRefresh: () => void;
  onLoadSession: (entry: ChatHistoryEntry) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAll: () => void;
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Displays persistent past conversations and trip snapshots with search,
 * inline transcript preview, one-click resume into Chat & Globe, and deletion.
 */
export default function HistoryPanel({
  sessions,
  activeSessionId,
  currency,
  exchangeRates,
  isLoading,
  onRefresh,
  onLoadSession,
  onDeleteSession,
  onClearAll,
}: HistoryPanelProps) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((entry) => {
      const trip = entry.tripSnapshot;
      const haystack = [
        entry.title,
        entry.lastMessage,
        trip?.destination ?? "",
        trip?.originCity ?? "",
        trip?.country ?? "",
        ...entry.messages.map((m) => m.content),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sessions, query]);

  return (
    <div className="space-y-4 pb-6">
      <div className="glass-subcard rounded-2xl p-4 card-enter-3d">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Saved Conversation &amp; Trip History
              </h2>
              <p className="text-xs text-slate-400">
                {sessions.length}{" "}
                {sessions.length === 1 ? "saved session" : "saved sessions"} stored locally
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-amber-400/50 hover:text-amber-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            {sessions.length > 0 &&
              (confirmClearAll ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmClearAll(false);
                      onClearAll();
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-500/60 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/30"
                  >
                    Confirm Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="rounded-xl border border-slate-700 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-400/50 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </button>
              ))}
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search past chats, destinations, trips..."
            className="w-full rounded-xl border border-slate-700/70 bg-slate-950/70 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none"
          />
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="glass-subcard rounded-2xl p-8 text-center card-enter-3d">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-200">
            {sessions.length === 0
              ? "No saved conversation history yet"
              : "No matching conversations found"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {sessions.length === 0
              ? "Ask TripGenie to plan a route or answer any travel question—your sessions and trip snapshots will stay saved here automatically."
              : "Try a different city, country, or keyword."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((entry) => {
            const isActive = entry.sessionId === activeSessionId;
            const isExpanded = expandedId === entry.sessionId;
            const trip = entry.tripSnapshot;

            return (
              <TiltCard3D key={entry.sessionId} intensity={4} className="card-enter-3d">
                <div
                  className={`glass-subcard rounded-2xl p-4 transition ${
                    isActive
                      ? "border-amber-400/60 ring-1 ring-amber-400/30"
                      : "hover:border-slate-600/80"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-white">
                          {entry.title}
                        </h3>
                        {isActive && (
                          <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {formatUpdatedAt(entry.updatedAt)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-900/70 px-2 py-0.5 text-slate-300">
                          <MessageSquare className="h-3 w-3 text-cyan-300" />
                          {entry.messageCount}{" "}
                          {entry.messageCount === 1 ? "message" : "messages"}
                        </span>
                        {trip && (
                          <>
                            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">
                              <MapPin className="h-3 w-3" />
                              {trip.originCity} → {trip.destination} ({trip.daysCount}d)
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                              <Wallet className="h-3 w-3" />
                              {formatPrice(trip.budget.totalUsd, currency, exchangeRates)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onLoadSession(entry)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm transition hover:brightness-110"
                      >
                        Open in Chat &amp; Globe
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSession(entry.sessionId)}
                        title="Delete session"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/70 p-1.5 text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {entry.lastMessage && (
                    <p className="mt-2.5 line-clamp-2 rounded-xl border border-slate-800/80 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                      {entry.lastMessage}
                    </p>
                  )}

                  {entry.messages.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : entry.sessionId)
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300/90 transition hover:text-amber-200"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            Hide transcript preview
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            Preview messages ({entry.messages.length})
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
                          {entry.messages.slice(-6).map((msg) => (
                            <div
                              key={msg.id}
                              className={`rounded-lg px-2.5 py-1.5 text-xs ${
                                msg.role === "user"
                                  ? "border border-amber-400/20 bg-amber-400/10 text-amber-100"
                                  : "border border-slate-800 bg-slate-900/80 text-slate-200"
                              }`}
                            >
                              <span className="mr-1.5 font-semibold uppercase tracking-wide text-[10px] opacity-75">
                                {msg.role === "user" ? "You" : "TripGenie"}:
                              </span>
                              <span className="whitespace-pre-wrap">{msg.content}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TiltCard3D>
            );
          })}
        </div>
      )}
    </div>
  );
}
