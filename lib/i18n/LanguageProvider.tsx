"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { en, type Dictionary } from "./dictionaries/en";
import { nl } from "./dictionaries/nl";

export type Language = "en" | "nl";

const DICTIONARIES: Record<Language, Dictionary> = { en, nl };
const STORAGE_KEY = "sf_lang";

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children, forcedLanguage }: { children: React.ReactNode; forcedLanguage?: Language }) {
  // Default to Dutch; localStorage read happens client-side in useEffect.
  // Inside Shopify the admin's language decides (forcedLanguage).
  const [language, setLanguageState] = useState<Language>(forcedLanguage ?? "nl");

  useEffect(() => {
    if (forcedLanguage) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "nl") {
      const timer = window.setTimeout(() => setLanguageState(stored), 0);
      return () => window.clearTimeout(timer);
    }
  }, [forcedLanguage]);

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t: DICTIONARIES[language] }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used inside LanguageProvider");
  return ctx;
}
