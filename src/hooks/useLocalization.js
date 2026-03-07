import { useEffect, useState } from "react";
import translations from "../locales/english.json"; // your bilingual book name mapping

const DEFAULT_LANGUAGE = "english";

const useLocalization = () => {
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    const stored = localStorage.getItem("bible-reading-lang");
    if (stored) {
      setCurrentLanguage(stored);
    }
  }, []);

  const switchLanguage = (lang) => {
    setCurrentLanguage(lang);
    localStorage.setItem("bible-reading-lang", lang);
  };

  const translate = (key) => {
    if (translations[key]?.[currentLanguage]) {
      return translations[key][currentLanguage];
    } else if (translations[key]?.english) {
      return translations[key].english;
    }
    return key;
  };

  return {
    translate,
    currentLanguage,
    switchLanguage,
  };
};

export default useLocalization;
