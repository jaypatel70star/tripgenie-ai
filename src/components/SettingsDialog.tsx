"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Settings2, Sparkles, X } from "lucide-react";
import type { CurrencyCode, TravelPreferences } from "@/types/travel";

interface SettingsDialogProps {
  isOpen: boolean;
  preferences: TravelPreferences;
  geminiKey: string;
  onClose: () => void;
  onSave: (prefs: TravelPreferences, apiKey: string) => void;
}

const INTEREST_OPTIONS = [
  "food",
  "culture",
  "beaches",
  "mountains",
  "adventure",
  "nightlife",
  "shopping",
  "relax",
  "history",
  "tech",
];

export default function SettingsDialog({
  isOpen,
  preferences,
  geminiKey,
  onClose,
  onSave,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [localPrefs, setLocalPrefs] = useState<TravelPreferences>(preferences);
  const [localKey, setLocalKey] = useState(geminiKey);

  useEffect(() => {
    setLocalPrefs(preferences);
    setLocalKey(geminiKey);
  }, [preferences, geminiKey, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const toggleInterest = (tag: string) => {
    setLocalPrefs((prev) => {
      const exists = prev.interests.includes(tag);
      return {
        ...prev,
        interests: exists
          ? prev.interests.filter((i) => i !== tag)
          : [...prev.interests, tag],
      };
    });
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="settings-title"
      onClose={onClose}
      className="studio-dialog w-[min(92dvw,560px)]"
    >
      <div className="glass-panel rounded-2xl overflow-hidden flex flex-col max-h-[85dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-cyan-400" />
            <h1 id="settings-title" className="text-base font-bold text-white font-display">
              TripGenie AI Preferences & Engine
            </h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(localPrefs, localKey);
            onClose();
          }}
          className="scroll-region p-5 space-y-4 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5 block">
              <span className="text-slate-300 font-semibold">Departure / Origin City</span>
              <input
                type="text"
                value={localPrefs.originCity}
                onChange={(e) => setLocalPrefs({ ...localPrefs, originCity: e.target.value })}
                placeholder="e.g. Mumbai, New Delhi, London"
                className="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-white focus:border-cyan-400/60 focus:outline-none"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-slate-300 font-semibold">Display Currency</span>
              <select
                value={localPrefs.currency}
                onChange={(e) =>
                  setLocalPrefs({ ...localPrefs, currency: e.target.value as CurrencyCode })
                }
                className="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2 text-white focus:border-cyan-400/60 focus:outline-none"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-slate-300 font-semibold block">Travel Interests</span>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_OPTIONS.map((tag) => {
                const active = localPrefs.interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    className={`rounded-full px-3 py-1 capitalize font-medium border transition-colors cursor-pointer ${
                      active
                        ? "bg-cyan-400/20 text-cyan-200 border-cyan-400/50"
                        : "bg-slate-900/70 text-slate-400 border-white/10 hover:text-slate-200"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-indigo-950/35 border border-indigo-400/25 p-3.5 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-indigo-200">
              <KeyRound className="h-4 w-4 text-amber-300" />
              <span>Optional Google Gemini API Key (Gemini 4 Hydrogen)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              TripGenie AI works right out of the box in <strong>Smart Demo Mode</strong>. To unlock
              unlimited live generative reasoning with <code className="text-cyan-300">gemini-4-hydrogen</code>,
              paste your Gemini API key below or set <code className="text-cyan-300">GEMINI_API_KEY</code> in <code className="text-cyan-300">.env.local</code>.
            </p>
            <input
              type="password"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              placeholder="AIza... (optional)"
              className="w-full rounded-xl bg-slate-950/85 border border-white/15 px-3 py-2 font-mono text-white focus:border-cyan-400/60 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900/80 px-4 py-2 text-slate-300 border border-white/10 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-2 font-bold text-slate-950 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
