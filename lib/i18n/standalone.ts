"use client";

import { useEffect, useState } from "react";

import { en, type Dictionary } from "./dictionaries/en";
import { nl } from "./dictionaries/nl";

export type StandaloneLanguage = "en" | "nl";

const STORAGE_KEY = "sf_lang";
const DICTIONARIES: Record<StandaloneLanguage, Dictionary> = { en, nl };

export function useStandaloneDictionary() {
  const [language, setLanguage] = useState<StandaloneLanguage>("nl");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "nl") {
      const timer = window.setTimeout(() => setLanguage(stored), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  return {
    language,
    t: DICTIONARIES[language],
  };
}
