import type { SupportedLanguage } from "@/types/travel";

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
  dir: "ltr" | "rtl";
  aiName: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", dir: "ltr", aiName: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", dir: "ltr", aiName: "Hindi (हिन्दी)" },
  { code: "es", label: "Spanish", nativeLabel: "Español", dir: "ltr", aiName: "Spanish (Español)" },
  { code: "fr", label: "French", nativeLabel: "Français", dir: "ltr", aiName: "French (Français)" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", dir: "ltr", aiName: "Japanese (日本語)" },
  { code: "de", label: "German", nativeLabel: "Deutsch", dir: "ltr", aiName: "German (Deutsch)" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", dir: "rtl", aiName: "Arabic (العربية)" },
];

export interface UIStrings {
  tagline: string;
  askPlaceholder: string;
  send: string;
  tabItinerary: string;
  tabMap: string;
  tabBudget: string;
  tabWeather: string;
  tabStays: string;
  tabHistory: string;
  savedTrips: string;
  saveFavorite: string;
  saved: string;
  adjustCheaper: string;
  adjustRainy: string;
  adjustRelaxed: string;
  adjustAddDay: string;
  pause3D: string;
  play3D: string;
  settings: string;
  newTrip: string;
  days: string;
  budget: string;
  travelers: string;
  interests: string;
  quickPrompts: { label: string; prompt: string }[];
}

export const UI_COPY: Record<SupportedLanguage, UIStrings> = {
  en: {
    tagline: "3D AI Travel Architect",
    askPlaceholder: "Plan a 5-day trip to Tokyo under ₹1,50,000, or say 'make Day 2 relaxing'...",
    send: "Send",
    tabItinerary: "Itinerary",
    tabMap: "Live Map",
    tabBudget: "Budget",
    tabWeather: "Weather & Intel",
    tabStays: "Stays & Dining",
    tabHistory: "History",
    savedTrips: "Saved Trips",
    saveFavorite: "Save Trip",
    saved: "Saved",
    adjustCheaper: "Cut Cost 20%",
    adjustRainy: "Rainy Day Backup",
    adjustRelaxed: "More Relaxed",
    adjustAddDay: "+1 Extra Day",
    pause3D: "Pause 3D",
    play3D: "Play 3D",
    settings: "AI & Settings",
    newTrip: "New Chat",
    days: "Days",
    budget: "Budget",
    travelers: "Travelers",
    interests: "Interests",
    quickPrompts: [
      { label: "5-Day Japan Neon & Temples", prompt: "Plan a 5-day trip to Tokyo & Kyoto for 2 people under ₹1,80,000 focusing on food, culture, and hidden gems." },
      { label: "Suggest Budget Beach Escapes", prompt: "Suggest 4 amazing tropical destinations under ₹75,000 for 4 days with beaches and adventure." },
      { label: "Manali Mountain Escape", prompt: "Create a 4-day moderate budget itinerary for Manali & Solang Valley with cafes, snow views, and local food." },
      { label: "Paris Romantic Weekend", prompt: "Plan a 3-day luxury romantic trip to Paris with Michelin-style dining, boutique stay, and Seine views." },
    ],
  },
  hi: {
    tagline: "3D एआई ट्रैवल आर्किटेक्ट",
    askPlaceholder: "5 दिन की टोक्यो यात्रा की योजना बनाएं या लिखें 'दिन 2 को आरामदायक बनाएं'...",
    send: "भेजें",
    tabItinerary: "यात्रा कार्यक्रम",
    tabMap: "लाइव मैप",
    tabBudget: "बजट",
    tabWeather: "मौसम और जानकारी",
    tabStays: "होटल और भोजन",
    tabHistory: "इतिहास",
    savedTrips: "सहेजी गई यात्राएं",
    saveFavorite: "यात्रा सहेजें",
    saved: "सहेजा गया",
    adjustCheaper: "20% सस्ता करें",
    adjustRainy: "बारिश बैकअप",
    adjustRelaxed: "आरामदायक बनाएं",
    adjustAddDay: "+1 दिन जोड़ें",
    pause3D: "3D रोकें",
    play3D: "3D चलाएं",
    settings: "सेटिंग्स",
    newTrip: "नई चैट",
    days: "दिन",
    budget: "बजट",
    travelers: "यात्री",
    interests: "रुचियां",
    quickPrompts: [
      { label: "4-दिन मनाली पहाड़ी यात्रा", prompt: "मनाली की 4 दिन की बजट यात्रा योजना बनाएं जिसमें कैफे, बर्फीली पहाड़ियां और स्थानीय भोजन शामिल हो।" },
      { label: "5-दिन जापान यात्रा", prompt: "टोक्यो के लिए 5 दिन की सांस्कृतिक और फूड यात्रा योजना बनाएं।" },
      { label: "सस्ते बीच डेस्टिनेशन", prompt: "कम बजट में 4 शानदार बीच डेस्टिनेशन सुझाएं।" },
      { label: "पेरिस रोमांटिक ट्रिप", prompt: "पेरिस के लिए 3 दिन का लग्जरी रोमांटिक प्लान बनाएं।" },
    ],
  },
  es: {
    tagline: "Arquitecto de Viajes IA 3D",
    askPlaceholder: "Planea un viaje de 5 días a Tokio o di 'haz el día 2 más relajado'...",
    send: "Enviar",
    tabItinerary: "Itinerario",
    tabMap: "Mapa en Vivo",
    tabBudget: "Presupuesto",
    tabWeather: "Clima y Datos",
    tabStays: "Hoteles y Comida",
    tabHistory: "Historial",
    savedTrips: "Viajes Guardados",
    saveFavorite: "Guardar Viaje",
    saved: "Guardado",
    adjustCheaper: "Reducir 20%",
    adjustRainy: "Plan Lluvia",
    adjustRelaxed: "Más Relajado",
    adjustAddDay: "+1 Día Extra",
    pause3D: "Pausar 3D",
    play3D: "Reanudar 3D",
    settings: "Ajustes IA",
    newTrip: "Nuevo Chat",
    days: "Días",
    budget: "Presupuesto",
    travelers: "Viajeros",
    interests: "Intereses",
    quickPrompts: [
      { label: "5 días en Tokio", prompt: "Planea un viaje de 5 días a Tokio para 2 personas con comida local y cultura." },
      { label: "Destinos de playa económicos", prompt: "Sugiere 4 destinos tropicales económicos para 4 días." },
      { label: "Barcelona Arte y Tapas", prompt: "Crea un itinerario de 4 días en Barcelona con arquitectura, playas y tapas." },
      { label: "Escapada a París", prompt: "Planea 3 días románticos en París con hoteles boutique y gastronomía." },
    ],
  },
  fr: {
    tagline: "Architecte de Voyage IA 3D",
    askPlaceholder: "Planifiez 5 jours à Tokyo ou demandez 'rendre le jour 2 plus détendu'...",
    send: "Envoyer",
    tabItinerary: "Itinéraire",
    tabMap: "Carte Live",
    tabBudget: "Budget",
    tabWeather: "Météo & Infos",
    tabStays: "Hôtels & Restos",
    tabHistory: "Historique",
    savedTrips: "Voyages Sauvés",
    saveFavorite: "Sauvegarder",
    saved: "Sauvé",
    adjustCheaper: "-20% Budget",
    adjustRainy: "Option Pluie",
    adjustRelaxed: "Plus Détendu",
    adjustAddDay: "+1 Jour",
    pause3D: "Pause 3D",
    play3D: "Lire 3D",
    settings: "Paramètres IA",
    newTrip: "Nouveau Chat",
    days: "Jours",
    budget: "Budget",
    travelers: "Voyageurs",
    interests: "Intérêts",
    quickPrompts: [
      { label: "5 jours à Tokyo", prompt: "Planifie un voyage de 5 jours à Tokyo axé sur la gastronomie et la culture." },
      { label: "Plages petit budget", prompt: "Suggère 4 destinations de plage abordables pour 4 jours." },
      { label: "Week-end à Rome", prompt: "Crée un itinéraire de 3 jours à Rome avec histoire et trattorias." },
      { label: "Alpes Suisses", prompt: "Planifie 4 jours dans les Alpes suisses en train panoramique." },
    ],
  },
  ja: {
    tagline: "3D AI トラベルアーキテクト",
    askPlaceholder: "東京5日間の旅行プランや「2日目をリラックスした予定に変更」と入力...",
    send: "送信",
    tabItinerary: "旅程表",
    tabMap: "ライブマップ",
    tabBudget: "予算分析",
    tabWeather: "天気・現地情報",
    tabStays: "宿泊・グルメ",
    tabHistory: "履歴",
    savedTrips: "保存済み",
    saveFavorite: "保存する",
    saved: "保存済み",
    adjustCheaper: "20%節約",
    adjustRainy: "雨天プラン",
    adjustRelaxed: "ゆったり変更",
    adjustAddDay: "+1日追加",
    pause3D: "3D停止",
    play3D: "3D再生",
    settings: "AI設定",
    newTrip: "新規チャット",
    days: "日間",
    budget: "予算",
    travelers: "人数",
    interests: "興味",
    quickPrompts: [
      { label: "パリ3日間ロマンチック旅", prompt: "パリ3日間のグルメと美術館を巡る旅行プランを作成してください。" },
      { label: "予算別ビーチリゾート提案", prompt: "4日間で楽しめるコスパの良いビーチリゾートを4つ提案してください。" },
      { label: "京都・東京5日間", prompt: "東京と京都の文化とグルメを楽しむ5日間のプランを作ってください。" },
      { label: "スイスアルプス4日間", prompt: "スイスアルプスの絶景列車と湖を巡る4日間の旅程を提案してください。" },
    ],
  },
  de: {
    tagline: "3D KI-Reise-Architekt",
    askPlaceholder: "Plane 5 Tage Tokio oder schreibe 'Mach Tag 2 entspannter'...",
    send: "Senden",
    tabItinerary: "Reiseplan",
    tabMap: "Live-Karte",
    tabBudget: "Budget",
    tabWeather: "Wetter & Infos",
    tabStays: "Hotels & Essen",
    tabHistory: "Verlauf",
    savedTrips: "Gespeichert",
    saveFavorite: "Speichern",
    saved: "Gespeichert",
    adjustCheaper: "20% günstiger",
    adjustRainy: "Regen-Plan",
    adjustRelaxed: "Entspannter",
    adjustAddDay: "+1 Tag",
    pause3D: "3D Pause",
    play3D: "3D Start",
    settings: "KI & Setup",
    newTrip: "Neuer Chat",
    days: "Tage",
    budget: "Budget",
    travelers: "Reisende",
    interests: "Interessen",
    quickPrompts: [
      { label: "5 Tage Tokio & Kultur", prompt: "Plane eine 5-tägige Reise nach Tokio mit Fokus auf Essen und Kultur." },
      { label: "Günstige Strandziele", prompt: "Schlage 4 günstige tropische Reiseziele für 4 Tage vor." },
      { label: "Rom Städtetrip", prompt: "Erstelle einen 3-Tage-Plan für Rom mit Geschichte und gutem Essen." },
      { label: "Schweizer Alpen", prompt: "Plane 4 Tage in den Schweizer Alpen mit Panoramazügen." },
    ],
  },
  ar: {
    tagline: "مهندس السفر الذكي ثلاثي الأبعاد",
    askPlaceholder: "خطط لرحلة 5 أيام إلى طوكيو أو اطلب 'اجعل اليوم الثاني أكثر هدوءاً'...",
    send: "إرسال",
    tabItinerary: "برنامج الرحلة",
    tabMap: "الخريطة الحية",
    tabBudget: "الميزانية",
    tabWeather: "الطقس والمعلومات",
    tabStays: "الفنادق والمطاعم",
    tabHistory: "السجل",
    savedTrips: "الرحلات المحفوظة",
    saveFavorite: "حفظ الرحلة",
    saved: "تم الحفظ",
    adjustCheaper: "توفير 20%",
    adjustRainy: "خطة المطر",
    adjustRelaxed: "أكثر راحة",
    adjustAddDay: "+1 يوم إضافي",
    pause3D: "إيقاف 3D",
    play3D: "تشغيل 3D",
    settings: "الإعدادات",
    newTrip: "محادثة جديدة",
    days: "أيام",
    budget: "الميزانية",
    travelers: "المسافرون",
    interests: "الاهتمامات",
    quickPrompts: [
      { label: "5 أيام في طوكيو", prompt: "خطط لرحلة 5 أيام إلى طوكيو لشخصين مع التركيز على الثقافة والطعام." },
      { label: "وجهات شاطئية اقتصادية", prompt: "اقترح 4 وجهات شاطئية جميلة بميزانية مناسبة لمدة 4 أيام." },
      { label: "دبي في 4 أيام", prompt: "أنشئ برنامج رحلة 4 أيام في دبي يشمل المعالم الحديثة والصحراء." },
      { label: "عطلة في باريس", prompt: "خطط لرحلة رومانسية 3 أيام في باريس." },
    ],
  },
};

export function getLanguageMeta(code: SupportedLanguage): LanguageOption {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
