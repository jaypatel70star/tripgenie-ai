"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CloudSun,
  History,
  Map as MapIcon,
  PieChart,
  Sparkles,
} from "lucide-react";
import BudgetVisualizer from "@/components/BudgetVisualizer";
import ChatPanel from "@/components/ChatPanel";
import Globe3D from "@/components/Globe3D";
import HistoryPanel from "@/components/HistoryPanel";
import HotelsTransportPanel from "@/components/HotelsTransportPanel";
import InteractiveMap2D from "@/components/InteractiveMap2D";
import ItineraryPanel from "@/components/ItineraryPanel";
import SavedTripsDialog from "@/components/SavedTripsDialog";
import SettingsDialog from "@/components/SettingsDialog";
import TravelCursor from "@/components/TravelCursor";
import TravelSceneBackdrop3D from "@/components/TravelSceneBackdrop3D";
import WeatherAndInfoPanel from "@/components/WeatherAndInfoPanel";
import { calculateItemizedBudget } from "@/lib/budget-calculator";
import { getLanguageMeta, UI_COPY } from "@/lib/i18n";
import type {
  BudgetTier,
  ChatHistoryEntry,
  ChatMessage,
  ChatResponsePayload,
  CountryTravelInfo,
  CurrencyCode,
  DestinationSuggestion,
  TravelPreferences,
  TravelTransportMode,
  TripPlan,
  WeatherData,
} from "@/types/travel";

type StudioTab = "itinerary" | "map" | "budget" | "weather" | "stays" | "history";

const DEFAULT_PREFS: TravelPreferences = {
  originCity: "Mumbai",
  budgetAmount: 125000,
  budgetTier: "moderate",
  currency: "INR",
  days: 4,
  travelers: 2,
  interests: ["food", "culture", "sightseeing"],
  language: "en",
};

const WELCOME_MSG: ChatMessage = {
  id: "msg-welcome",
  role: "assistant",
  createdAt: new Date().toISOString(),
  content:
    "Welcome to **TripGenie AI**! 🌍 Tell me your dream destination, budget, days, or interests — or try a quick prompt below. I'll animate your route on the **3D Globe**, pull **live weather**, map **day-by-day stops**, and estimate your **budget**.",
};

export default function TripGenieStudio() {
  const [sessionId, setSessionId] = useState("session-main");
  const [preferences, setPreferences] = useState<TravelPreferences>(DEFAULT_PREFS);
  const [geminiKey, setGeminiKey] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [activeTrip, setActiveTrip] = useState<TripPlan | null>(null);
  const [savedTrips, setSavedTrips] = useState<TripPlan[]>([]);
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [countryInfo, setCountryInfo] = useState<CountryTravelInfo | null>(null);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    USD: 1,
    EUR: 0.92,
    INR: 84.5,
    GBP: 0.79,
    JPY: 154,
    AED: 3.67,
  });

  const [activeTab, setActiveTab] = useState<StudioTab>("itinerary");
  const [selectedDay, setSelectedDay] = useState<number | "all">("all");
  const [focusedCoords, setFocusedCoords] = useState<{
    lat: number;
    lng: number;
    label?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState<ChatHistoryEntry[]>([]);
  const [is3DPaused, setIs3DPaused] = useState(false);
  const [engineMode, setEngineMode] = useState<"gemini" | "smart-demo">("smart-demo");
  const [hasServerKey, setHasServerKey] = useState(false);
  const [geminiError, setGeminiError] = useState<string | undefined>(undefined);
  const [showSavedDialog, setShowSavedDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const copy = useMemo(() => UI_COPY[preferences.language] ?? UI_COPY.en, [preferences.language]);
  const langMeta = useMemo(() => getLanguageMeta(preferences.language), [preferences.language]);

  const loadHistorySessions = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch("/api/chats?mode=history");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.sessions)) {
        setHistorySessions(data.sessions);
      }
    } catch {
      // silent fallback
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const fetchLiveIntelForTrip = useCallback(async (trip: TripPlan) => {
    try {
      const res = await fetch(
        `/api/weather?city=${encodeURIComponent(trip.destination)}&lat=${trip.lat}&lng=${trip.lng}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.weather) setWeather(data.weather);
      if (data.countryInfo) setCountryInfo(data.countryInfo);
      if (data.exchangeRates) setExchangeRates(data.exchangeRates);
    } catch {
      // silent fallback
    }
  }, []);

  // Load initial saved trips & stored preferences
  useEffect(() => {
    const storedKey = window.localStorage.getItem("tripgenie_gemini_key") || "";
    if (storedKey) setGeminiKey(storedKey);

    const storedPrefs = window.localStorage.getItem("tripgenie_prefs_v2");
    if (storedPrefs) {
      try {
        setPreferences((prev) => ({ ...prev, ...JSON.parse(storedPrefs) }));
      } catch {
        // ignore invalid JSON
      }
    }

    (async () => {
      try {
        const [tripsRes, chatRes, keyRes, historyRes] = await Promise.all([
          fetch("/api/trips"),
          fetch(`/api/chats?sessionId=${encodeURIComponent("session-main")}`),
          fetch("/api/verify-key"),
          fetch("/api/chats?mode=history"),
        ]);
        if (keyRes.ok) {
          const keyData = await keyRes.json();
          setHasServerKey(Boolean(keyData.hasServerKey));
        }
        if (tripsRes.ok) {
          const data = await tripsRes.json();
          const list: TripPlan[] = data.trips ?? [];
          setSavedTrips(list);
          if (list.length > 0) {
            setActiveTrip(list[0]);
            fetchLiveIntelForTrip(list[0]);
          }
        }
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          if (Array.isArray(chatData.messages) && chatData.messages.length > 0) {
            setMessages([WELCOME_MSG, ...chatData.messages]);
          }
        }
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          if (Array.isArray(historyData.sessions)) {
            setHistorySessions(historyData.sessions);
          }
        }
      } catch {
        // ignore startup fetch error
      }
    })();
  }, [fetchLiveIntelForTrip]);

  const updatePreferences = (patch: Partial<TravelPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      window.localStorage.setItem("tripgenie_prefs_v2", JSON.stringify(next));
      return next;
    });
  };

  const sendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (geminiKey.trim()) {
        headers["x-gemini-api-key"] = geminiKey.trim();
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionId,
          message: text,
          preferences,
          currentTrip: activeTrip,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");
      const data: ChatResponsePayload = await res.json();

      setMessages((prev) => [...prev, data.assistantMessage]);
      setEngineMode(data.engine);
      setGeminiError(data.geminiError);

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      } else {
        setSuggestions([]);
      }

      if (data.tripPlan) {
        setActiveTrip(data.tripPlan);
        setSelectedDay("all");
        setFocusedCoords({
          lat: data.tripPlan.lat,
          lng: data.tripPlan.lng,
          label: data.tripPlan.destination,
        });
      }

      if (data.weather) setWeather(data.weather);
      if (data.countryInfo) setCountryInfo(data.countryInfo);
      if (data.exchangeRates) setExchangeRates(data.exchangeRates);
      void loadHistorySessions();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "I encountered a momentary hiccup contacting the travel service. Please try again!",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSuggestion = (dest: DestinationSuggestion) => {
    setFocusedCoords({ lat: dest.lat, lng: dest.lng, label: dest.name });
    sendMessage(
      `Plan a ${preferences.days}-day ${preferences.budgetTier} trip to ${dest.name}, ${dest.country} for ${preferences.travelers} people.`
    );
  };

  const handleSaveTrip = async () => {
    if (!activeTrip) return;
    setIsSaving(true);
    try {
      if (activeTrip.isFavorite) {
        await fetch(`/api/trips/${encodeURIComponent(activeTrip.id)}`, {
          method: "DELETE",
        });
        setActiveTrip({ ...activeTrip, isFavorite: false });
        setSavedTrips((prev) => prev.filter((t) => t.id !== activeTrip.id));
      } else {
        const res = await fetch("/api/trips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trip: { ...activeTrip, isFavorite: true } }),
        });
        if (res.ok) {
          const data = await res.json();
          const saved: TripPlan = data.trip;
          setActiveTrip(saved);
          setSavedTrips((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedTrip = async (id: string) => {
    await fetch(`/api/trips/${encodeURIComponent(id)}`, { method: "DELETE" });
    setSavedTrips((prev) => prev.filter((t) => t.id !== id));
    if (activeTrip?.id === id) {
      setActiveTrip((prev) => (prev ? { ...prev, isFavorite: false } : null));
    }
  };

  const handleLoadSavedTrip = (trip: TripPlan) => {
    setActiveTrip(trip);
    setSelectedDay("all");
    setFocusedCoords({ lat: trip.lat, lng: trip.lng, label: trip.destination });
    setActiveTab("itinerary");
    fetchLiveIntelForTrip(trip);
  };

  const handleRemoveActivity = async (dayNumber: number, activityId: string) => {
    if (!activeTrip) return;
    const updatedDays = activeTrip.days.map((d) =>
      d.dayNumber === dayNumber
        ? { ...d, activities: d.activities.filter((a) => a.id !== activityId) }
        : d
    );
    const updatedTrip: TripPlan = { ...activeTrip, days: updatedDays };
    updatedTrip.budget = calculateItemizedBudget(updatedTrip, activeTrip.budget.tips);
    setActiveTrip(updatedTrip);
    if (updatedTrip.isFavorite) {
      await fetch(`/api/trips/${encodeURIComponent(updatedTrip.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip: updatedTrip }),
      });
    }
  };

  const handleUpdateBudgetControls = async (
    nextTier: BudgetTier,
    nextMode: TravelTransportMode
  ) => {
    if (!activeTrip) return;
    const updatedTrip: TripPlan = {
      ...activeTrip,
      budgetTier: nextTier,
    };
    updatedTrip.budget = calculateItemizedBudget(updatedTrip, undefined, {
      targetBudgetUsd: activeTrip.budget.targetBudgetUsd,
      transportMode: nextMode,
    });
    setActiveTrip(updatedTrip);
    if (updatedTrip.isFavorite) {
      await fetch(`/api/trips/${encodeURIComponent(updatedTrip.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip: updatedTrip }),
      });
    }
  };

  const handleFocusLocation = (lat: number, lng: number, label: string) => {
    setFocusedCoords({ lat, lng, label });
    setActiveTab("map");
  };

  const handleNewChat = () => {
    setSessionId(`session-${Date.now()}`);
    setMessages([WELCOME_MSG]);
    setSuggestions([]);
    void loadHistorySessions();
  };

  const handleLoadHistorySession = (entry: ChatHistoryEntry) => {
    setSessionId(entry.sessionId);
    setMessages(
      entry.messages.length > 0 ? [WELCOME_MSG, ...entry.messages] : [WELCOME_MSG]
    );
    setSuggestions([]);
    if (entry.tripSnapshot) {
      setActiveTrip(entry.tripSnapshot);
      setSelectedDay("all");
      setFocusedCoords({
        lat: entry.tripSnapshot.lat,
        lng: entry.tripSnapshot.lng,
        label: entry.tripSnapshot.destination,
      });
      void fetchLiveIntelForTrip(entry.tripSnapshot);
      setActiveTab("itinerary");
    }
  };

  const handleDeleteHistorySession = async (targetSessionId: string) => {
    await fetch(`/api/chats?sessionId=${encodeURIComponent(targetSessionId)}`, {
      method: "DELETE",
    });
    setHistorySessions((prev) => prev.filter((s) => s.sessionId !== targetSessionId));
    if (targetSessionId === sessionId) {
      setSessionId(`session-${Date.now()}`);
      setMessages([WELCOME_MSG]);
      setSuggestions([]);
    }
  };

  const handleClearAllHistory = async () => {
    await fetch("/api/chats?all=1", { method: "DELETE" });
    setHistorySessions([]);
    setSessionId(`session-${Date.now()}`);
    setMessages([WELCOME_MSG]);
    setSuggestions([]);
  };

  const tabs: { id: StudioTab; label: string; icon: React.ReactNode }[] = [
    { id: "itinerary", label: copy.tabItinerary, icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { id: "map", label: copy.tabMap, icon: <MapIcon className="h-3.5 w-3.5" /> },
    { id: "budget", label: copy.tabBudget, icon: <PieChart className="h-3.5 w-3.5" /> },
    { id: "weather", label: copy.tabWeather, icon: <CloudSun className="h-3.5 w-3.5" /> },
    { id: "stays", label: copy.tabStays, icon: <Building2 className="h-3.5 w-3.5" /> },
    { id: "history", label: copy.tabHistory, icon: <History className="h-3.5 w-3.5" /> },
  ];

  return (
    <>
      <TravelCursor />
      <TravelSceneBackdrop3D isPaused={is3DPaused} />
      <div
        dir={langMeta.dir}
        className="relative z-10 mx-auto max-w-[1600px] p-3 sm:p-4 lg:p-5 min-h-[100dvh] lg:h-[100dvh] flex flex-col gap-3"
      >
      {/* Main Split Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-0">
        {/* Left Column: AI Travel Chatbot */}
        <div className="lg:col-span-5 xl:col-span-4 lg:min-h-0 lg:h-full no-print">
          <ChatPanel
            messages={messages}
            preferences={preferences}
            exchangeRates={exchangeRates}
            isLoading={isLoading}
            is3DPaused={is3DPaused}
            engineMode={engineMode}
            hasGeminiKey={Boolean(geminiKey.trim()) || hasServerKey}
            geminiError={geminiError}
            savedCount={savedTrips.length}
            copy={copy}
            onSendMessage={sendMessage}
            onUpdatePreferences={updatePreferences}
            onSelectSuggestion={handleSelectSuggestion}
            onOpenSavedTrips={() => setShowSavedDialog(true)}
            onOpenSettings={() => setShowSettingsDialog(true)}
            onNewChat={handleNewChat}
          />
        </div>

        {/* Right Column: 3D Globe Stage + Multi-Tab Travel Command Center */}
        <main className="lg:col-span-7 xl:col-span-8 flex flex-col gap-3.5 min-h-0 lg:h-full">
          {/* Interactive 3D WebGL Globe */}
          <div className="h-[260px] sm:h-[300px] lg:h-[38%] shrink-0 no-print">
            <Globe3D
              activeTrip={activeTrip}
              suggestions={suggestions}
              focusedCoords={focusedCoords}
              isPaused={is3DPaused}
              onTogglePause={() => setIs3DPaused((p) => !p)}
              onSelectSuggestion={handleSelectSuggestion}
              pauseLabel={copy.pause3D}
              playLabel={copy.play3D}
            />
          </div>

          {/* Workspace Intelligence Tabs + Content */}
          <section className="glass-panel rounded-2xl flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            {/* Tablist */}
            <div
              role="tablist"
              aria-label="Trip planning workspace views"
              className="flex items-center gap-1 px-3 pt-2 border-b border-white/10 overflow-x-auto bg-slate-950/40 shrink-0 no-print"
            >
              {tabs.map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={selected}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === "history") void loadHistorySessions();
                    }}
                    className={`studio-tab shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                      selected
                        ? "text-cyan-200"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.id === "history" && historySessions.length > 0 && (
                      <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                        {historySessions.length}
                      </span>
                    )}
                  </button>
                );
              })}

              {weather && (
                <div className="ml-auto hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/75 border border-white/10 text-[11px] text-slate-300 mb-1">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  <span>
                    {weather.locationName}: <strong className="text-white">{weather.currentTempC}°C</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Active Tab Panel */}
            <div
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              tabIndex={0}
              className="lg:overflow-y-auto lg:overscroll-contain lg:flex-1 p-4 lg:min-h-0"
            >
              {activeTab === "itinerary" && activeTrip && (
                <ItineraryPanel
                  trip={activeTrip}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  currency={preferences.currency}
                  exchangeRates={exchangeRates}
                  copy={copy}
                  isSaving={isSaving}
                  onSaveTrip={handleSaveTrip}
                  onQuickAdjust={sendMessage}
                  onRemoveActivity={handleRemoveActivity}
                  onFocusLocation={handleFocusLocation}
                />
              )}

              {activeTab === "itinerary" && !activeTrip && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 text-sm">
                  Ask TripGenie AI on the left to generate your personalized day-by-day itinerary!
                </div>
              )}

              {activeTab === "map" && (
                <InteractiveMap2D
                  trip={activeTrip}
                  focusedCoords={focusedCoords}
                  selectedDay={selectedDay}
                  currency={preferences.currency}
                  exchangeRates={exchangeRates}
                />
              )}

              {activeTab === "budget" && activeTrip && (
                <BudgetVisualizer
                  budget={activeTrip.budget}
                  budgetTier={activeTrip.budgetTier}
                  currency={preferences.currency}
                  exchangeRates={exchangeRates}
                  daysCount={activeTrip.daysCount}
                  travelers={activeTrip.travelers}
                  onChangeCurrency={(c: CurrencyCode) => updatePreferences({ currency: c })}
                  onChangeBudgetTier={(tier) =>
                    handleUpdateBudgetControls(
                      tier,
                      activeTrip.budget.transportMode ?? "auto"
                    )
                  }
                  onChangeTransportMode={(mode) =>
                    handleUpdateBudgetControls(activeTrip.budgetTier, mode)
                  }
                />
              )}

              {activeTab === "weather" && (
                <WeatherAndInfoPanel
                  weather={weather}
                  countryInfo={countryInfo}
                  exchangeRates={exchangeRates}
                />
              )}

              {activeTab === "stays" && activeTrip && (
                <HotelsTransportPanel
                  hotels={activeTrip.hotels}
                  restaurants={activeTrip.restaurants}
                  transport={activeTrip.transport}
                  currency={preferences.currency}
                  exchangeRates={exchangeRates}
                  onFocusLocation={handleFocusLocation}
                />
              )}

              {activeTab === "history" && (
                <HistoryPanel
                  sessions={historySessions}
                  activeSessionId={sessionId}
                  currency={preferences.currency}
                  exchangeRates={exchangeRates}
                  isLoading={isHistoryLoading}
                  onRefresh={() => void loadHistorySessions()}
                  onLoadSession={handleLoadHistorySession}
                  onDeleteSession={(id) => void handleDeleteHistorySession(id)}
                  onClearAll={() => void handleClearAllHistory()}
                />
              )}
            </div>
          </section>
        </main>
      </div>

      {/* Native <dialog> Modals */}
      <SavedTripsDialog
        isOpen={showSavedDialog}
        trips={savedTrips}
        activeTripId={activeTrip?.id}
        currency={preferences.currency}
        exchangeRates={exchangeRates}
        onClose={() => setShowSavedDialog(false)}
        onLoadTrip={handleLoadSavedTrip}
        onDeleteTrip={handleDeleteSavedTrip}
      />

      <SettingsDialog
        isOpen={showSettingsDialog}
        preferences={preferences}
        geminiKey={geminiKey}
        hasServerKey={hasServerKey}
        onClose={() => setShowSettingsDialog(false)}
        onSave={(prefs, key) => {
          updatePreferences(prefs);
          setGeminiKey(key);
          setGeminiError(undefined);
          if (key.trim()) {
            window.localStorage.setItem("tripgenie_gemini_key", key.trim());
          } else {
            window.localStorage.removeItem("tripgenie_gemini_key");
          }
        }}
      />
      </div>
    </>
  );
}
