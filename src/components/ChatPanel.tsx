"use client";

import { useEffect, useRef, useState } from "react";
import {
  Compass,
  FolderHeart,
  Globe,
  Mic,
  MicOff,
  PlusCircle,
  Send,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import GenieOrb3D from "@/components/GenieOrb3D";
import TiltCard3D from "@/components/TiltCard3D";
import { formatPrice } from "@/lib/currency";
import { LANGUAGES, type UIStrings } from "@/lib/i18n";
import type {
  BudgetTier,
  ChatMessage,
  DestinationSuggestion,
  SupportedLanguage,
  TravelPreferences,
} from "@/types/travel";

interface ChatPanelProps {
  messages: ChatMessage[];
  preferences: TravelPreferences;
  exchangeRates: Record<string, number>;
  isLoading: boolean;
  is3DPaused: boolean;
  engineMode: "gemini" | "smart-demo";
  hasGeminiKey: boolean;
  geminiError?: string;
  savedCount: number;
  copy: UIStrings;
  onSendMessage: (text: string) => void;
  onUpdatePreferences: (patch: Partial<TravelPreferences>) => void;
  onSelectSuggestion: (dest: DestinationSuggestion) => void;
  onOpenSavedTrips: () => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
}

function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-cyan-200">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export default function ChatPanel({
  messages,
  preferences,
  exchangeRates,
  isLoading,
  is3DPaused,
  engineMode,
  hasGeminiKey,
  geminiError,
  savedCount,
  copy,
  onSendMessage,
  onUpdatePreferences,
  onSelectSuggestion,
  onOpenSavedTrips,
  onOpenSettings,
  onNewChat,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<unknown>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    setSpeechSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    const feed = feedRef.current;
    if (feed) {
      feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const submitDraft = () => {
    const text = (inputRef.current?.value ?? draft).trim();
    if (!text || isLoading) return;
    onSendMessage(text);
    setDraft("");
    inputRef.current?.blur();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitDraft();
  };

  const toggleVoiceInput = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onend: () => void;
        onerror: () => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onend: () => void;
        onerror: () => void;
        start: () => void;
        stop: () => void;
      };
    };

    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;

    if (isListening && recognitionRef.current) {
      (recognitionRef.current as { stop: () => void }).stop();
      setIsListening(false);
      return;
    }

    const rec = new Ctor();
    rec.lang = preferences.language === "hi" ? "hi-IN" : preferences.language === "ja" ? "ja-JP" : "en-US";
    rec.interimResults = false;
    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  return (
    <aside className="glass-panel flex flex-col rounded-2xl overflow-hidden h-[64dvh] min-h-[380px] max-h-[580px] lg:h-full lg:min-h-[540px] lg:max-h-none">
      {/* Header with 3D AI Genie Orb */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 bg-slate-950/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <GenieOrb3D isThinking={isLoading} isPaused={is3DPaused} size={48} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white font-display truncate">
                TripGenie AI
              </h1>
              <span
                title={geminiError || undefined}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                  engineMode === "gemini" || (hasGeminiKey && !geminiError)
                    ? "bg-cyan-500/15 text-cyan-300 border-cyan-400/35"
                    : "bg-amber-500/15 text-amber-200 border-amber-400/35"
                }`}
              >
                {engineMode === "gemini" || (hasGeminiKey && !geminiError)
                  ? "Gemini Live"
                  : geminiError
                    ? "Smart Demo (Key Error)"
                    : "Smart Demo"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">{copy.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSavedTrips}
            title={copy.savedTrips}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 border border-white/10 transition-colors cursor-pointer"
          >
            <FolderHeart className="h-3.5 w-3.5 text-rose-400" />
            <span className="hidden sm:inline">{savedCount}</span>
          </button>

          <button
            type="button"
            onClick={onNewChat}
            title={copy.newTrip}
            className="rounded-xl bg-slate-900/80 hover:bg-slate-800 p-1.5 text-slate-300 hover:text-cyan-300 border border-white/10 transition-colors cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title={copy.settings}
            className="rounded-xl bg-slate-900/80 hover:bg-slate-800 p-1.5 text-slate-300 hover:text-cyan-300 border border-white/10 transition-colors cursor-pointer"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick Parameter Tuner (Days, Budget Tier, Travelers, Language) */}
      <div className="px-3 py-2 border-b border-white/10 bg-slate-900/35 flex flex-wrap items-center gap-2 text-[11px]">
        <label className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950/70 px-2 py-1 border border-white/10">
          <span className="text-slate-400">{copy.days}:</span>
          <select
            aria-label={copy.days}
            value={preferences.days}
            onChange={(e) => onUpdatePreferences({ days: Number(e.target.value) })}
            className="bg-transparent text-cyan-200 font-semibold focus:outline-none cursor-pointer"
          >
            {[2, 3, 4, 5, 6, 7, 10].map((d) => (
              <option key={d} value={d} className="bg-slate-900 text-white">
                {d}D
              </option>
            ))}
          </select>
        </label>

        <label className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950/70 px-2 py-1 border border-white/10">
          <span className="text-slate-400">{copy.budget}:</span>
          <select
            aria-label={copy.budget}
            value={preferences.budgetTier}
            onChange={(e) => onUpdatePreferences({ budgetTier: e.target.value as BudgetTier })}
            className="bg-transparent text-emerald-300 font-semibold focus:outline-none capitalize cursor-pointer"
          >
            <option value="budget" className="bg-slate-900 text-white">Budget</option>
            <option value="moderate" className="bg-slate-900 text-white">Moderate</option>
            <option value="luxury" className="bg-slate-900 text-white">Luxury</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-1 rounded-lg bg-slate-950/70 px-2 py-1 border border-white/10">
          <Users className="h-3 w-3 text-slate-400" />
          <select
            aria-label={copy.travelers}
            value={preferences.travelers}
            onChange={(e) => onUpdatePreferences({ travelers: Number(e.target.value) })}
            className="bg-transparent text-amber-200 font-semibold focus:outline-none cursor-pointer"
          >
            {[1, 2, 3, 4, 6].map((n) => (
              <option key={n} value={n} className="bg-slate-900 text-white">
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="ml-auto inline-flex items-center gap-1 rounded-lg bg-slate-950/70 px-2 py-1 border border-white/10">
          <Globe className="h-3 w-3 text-cyan-400" />
          <select
            aria-label="Language"
            value={preferences.language}
            onChange={(e) =>
              onUpdatePreferences({ language: e.target.value as SupportedLanguage })
            }
            className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                {l.nativeLabel}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Chat Message Feed */}
      {geminiError && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="mx-3 mt-2 rounded-xl bg-rose-500/15 border border-rose-400/35 px-3 py-1.5 text-left text-[11px] text-rose-200 hover:bg-rose-500/20 transition-colors cursor-pointer"
        >
          <strong>Gemini Key Notice:</strong> {geminiError} (Using Smart Demo fallback — tap to check key)
        </button>
      )}
      <div ref={feedRef} className="scroll-region flex-1 px-3.5 py-3 space-y-3 min-h-0">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1.5`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-gradient-to-br from-cyan-500/25 to-indigo-500/25 border border-cyan-400/35 text-white rounded-br-sm"
                    : "glass-subcard text-slate-200 rounded-bl-sm"
                }`}
              >
                {msg.adjustmentSummary && (
                  <div className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-400/35 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                    <Sparkles className="h-3 w-3" /> {msg.adjustmentSummary}
                  </div>
                )}
                <div>{renderFormattedText(msg.content)}</div>
              </div>

              {/* Inline Destination Suggestion Cards */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-[96%] mt-1">
                  {msg.suggestions.map((dest) => (
                    <TiltCard3D key={dest.name} intensity={7} className="rounded-xl">
                      <button
                        type="button"
                        onClick={() => onSelectSuggestion(dest)}
                        className="w-full h-full text-left rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-rose-400/30 hover:border-amber-400/55 p-2.5 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white group-hover:text-amber-200 flex items-center gap-1">
                            <Compass className="h-3 w-3 text-rose-400" />
                            {dest.name}, {dest.country}
                          </span>
                          <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono text-rose-200">
                            {dest.matchScore}% match
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{dest.tagline}</p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-emerald-300 font-mono">
                          <span>~{formatPrice(dest.estimatedDailyUsd, preferences.currency, exchangeRates)}/day</span>
                          <span className="text-amber-300">Plan trip →</span>
                        </div>
                      </button>
                    </TiltCard3D>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-cyan-300 px-2 py-1">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <span>TripGenie AI is mapping routes, weather & budget...</span>
          </div>
        )}
      </div>

      {/* Quick Prompt Chips */}
      <div className="px-3 py-2 border-t border-white/10 bg-slate-950/30 flex items-center gap-1.5 overflow-x-auto">
        {copy.quickPrompts.map((qp) => (
          <button
            key={qp.label}
            type="button"
            disabled={isLoading}
            onClick={() => onSendMessage(qp.prompt)}
            className="shrink-0 rounded-full bg-slate-900/80 hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-400/40 px-2.5 py-1 text-[11px] text-slate-300 hover:text-cyan-200 transition-colors cursor-pointer"
          >
            ✦ {qp.label}
          </button>
        ))}
      </div>

      {/* Input Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-white/10 bg-slate-950/60 flex items-center gap-2"
      >
        {speechSupported && (
          <button
            type="button"
            onClick={toggleVoiceInput}
            title={isListening ? "Stop Listening" : "Voice Input"}
            className={`shrink-0 rounded-xl p-2.5 border transition-colors cursor-pointer ${
              isListening
                ? "bg-rose-500/25 border-rose-400 text-rose-200 animate-pulse"
                : "bg-slate-900/80 border-white/10 text-slate-300 hover:text-cyan-300"
            }`}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}

        <input
          ref={inputRef}
          type="text"
          enterKeyHint="send"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitDraft();
            }
          }}
          placeholder={copy.askPlaceholder}
          className="min-w-0 flex-1 rounded-xl bg-slate-900/90 border border-white/15 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
        />

        <button
          type="submit"
          disabled={!draft.trim() || isLoading}
          onPointerDown={(e) => {
            // Prevent virtual keyboard collapse before tap completes on mobile
            if (draft.trim() && !isLoading) {
              e.preventDefault();
            }
          }}
          className="shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-400 via-emerald-300 to-amber-300 hover:from-teal-300 hover:to-amber-200 active:scale-95 disabled:opacity-40 px-3.5 sm:px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-all cursor-pointer touch-manipulation"
        >
          <Send className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          <span>{copy.send}</span>
        </button>
      </form>
    </aside>
  );
}
