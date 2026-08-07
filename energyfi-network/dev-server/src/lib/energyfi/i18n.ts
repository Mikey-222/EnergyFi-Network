// Lightweight i18n: per-wallet language from the profile store, flat string
// dictionary with English fallback. RTL for Urdu/Arabic.
import { useProfile } from "@/lib/energyfi/profile";

export const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "ur", label: "اردو" },
  { code: "es", label: "Español" },
  { code: "ko", label: "한국어" },
  { code: "ar", label: "العربية" },
] as const;

export type LangCode = (typeof LANG_OPTIONS)[number]["code"];

export function isRtl(lang: string): boolean {
  return lang === "ur" || lang === "ar";
}

export function langLabelToCode(label: string): string {
  return LANG_OPTIONS.find((o) => o.label === label)?.code ?? "en";
}

type Entry = Partial<Record<LangCode, string>>;

const dict: Record<string, Entry> = {
  // Tab bar
  "tab.home": { en: "Home", hi: "होम", ur: "ہوم", es: "Inicio", ko: "홈", ar: "الرئيسية" },
  "tab.wallet": {
    en: "Wallet",
    hi: "वॉलेट",
    ur: "والٹ",
    es: "Billetera",
    ko: "지갑",
    ar: "المحفظة",
  },
  "tab.savings": { en: "Savings", hi: "बचत", ur: "بچت", es: "Ahorros", ko: "저축", ar: "المدخرات" },
  "tab.market": {
    en: "Market",
    hi: "बाज़ार",
    ur: "مارکیٹ",
    es: "Mercado",
    ko: "시장",
    ar: "السوق",
  },
  "tab.profile": {
    en: "Profile",
    hi: "प्रोफ़ाइल",
    ur: "پروفائل",
    es: "Perfil",
    ko: "프로필",
    ar: "الملف الشخصي",
  },

  // Home
  "home.goodMorning": {
    en: "Good morning",
    hi: "सुप्रभात",
    ur: "صبح بخیر",
    es: "Buenos días",
    ko: "좋은 아침이에요",
    ar: "صباح الخير",
  },
  "home.subtitle": {
    en: "Save, borrow and grow together",
    hi: "साथ मिलकर बचाएँ, उधार लें और बढ़ें",
    ur: "مل کر بچائیں، قرض لیں اور بڑھیں",
    es: "Ahorra, pide prestado y crece juntos",
    ko: "함께 저축하고, 빌리고, 성장하세요",
    ar: "ادّخر، اقترض وانمُ معًا",
  },
  "home.connectWallet": {
    en: "Connect your wallet",
    hi: "अपना वॉलेट कनेक्ट करें",
    ur: "اپنا والٹ منسلک کریں",
    es: "Conecta tu billetera",
    ko: "지갑을 연결하세요",
    ar: "اربط محفظتك",
  },
  "home.walletConnected": {
    en: "Stellar wallet connected",
    hi: "स्टेलर वॉलेट कनेक्टेड",
    ur: "سٹیلر والٹ منسلک ہے",
    es: "Billetera Stellar conectada",
    ko: "Stellar 지갑 연결됨",
    ar: "محفظة Stellar متصلة",
  },
  "home.linkWallet": {
    en: "Link Freighter or another Stellar wallet",
    hi: "Freighter या कोई अन्य स्टेलर वॉलेट जोड़ें",
    ur: "Freighter یا کوئی اور سٹیلر والٹ جوڑیں",
    es: "Vincula Freighter u otra billetera Stellar",
    ko: "Freighter 또는 다른 Stellar 지갑을 연결하세요",
    ar: "اربط Freighter أو أي محفظة Stellar أخرى",
  },
  "home.connected": {
    en: "Connected",
    hi: "कनेक्टेड",
    ur: "منسلک",
    es: "Conectado",
    ko: "연결됨",
    ar: "متصل",
  },
  "home.connect": {
    en: "Connect",
    hi: "कनेक्ट करें",
    ur: "منسلک کریں",
    es: "Conectar",
    ko: "연결",
    ar: "اتصال",
  },
  "home.topUp": { en: "Top Up", hi: "टॉप अप", ur: "ٹاپ اپ", es: "Recargar", ko: "충전", ar: "شحن" },
  "home.savings": {
    en: "Savings",
    hi: "बचत",
    ur: "بچت",
    es: "Ahorros",
    ko: "저축",
    ar: "المدخرات",
  },
  "home.interestReady": {
    en: "interest ready",
    hi: "ब्याज तैयार",
    ur: "سود تیار ہے",
    es: "interés disponible",
    ko: "이자 지급 가능",
    ar: "الفائدة جاهزة",
  },
  "home.poolTokens": {
    en: "pool tokens",
    hi: "पूल टोकन",
    ur: "پول ٹوکن",
    es: "tokens del fondo",
    ko: "풀 토큰",
    ar: "رموز الصندوق",
  },
  "home.claimInterest": {
    en: "Claim interest",
    hi: "ब्याज प्राप्त करें",
    ur: "سود وصول کریں",
    es: "Reclamar interés",
    ko: "이자 받기",
    ar: "استلام الفائدة",
  },
  "home.deposit": {
    en: "Deposit",
    hi: "जमा करें",
    ur: "جمع کریں",
    es: "Depositar",
    ko: "입금",
    ar: "إيداع",
  },
  "home.viewSavings": {
    en: "View savings",
    hi: "बचत देखें",
    ur: "بچت دیکھیں",
    es: "Ver ahorros",
    ko: "저축 보기",
    ar: "عرض المدخرات",
  },
  "home.neighbourhoodLoans": {
    en: "Neighbourhood loans",
    hi: "पड़ोस ऋण",
    ur: "محلے کے قرضے",
    es: "Préstamos vecinales",
    ko: "이웃 대출",
    ar: "قروض الجوار",
  },
  "home.borrowFrom": {
    en: "Borrow from",
    hi: "उधार लें",
    ur: "قرض لیں",
    es: "Pide prestado",
    ko: "대출",
    ar: "اقترض",
  },
  "home.loansFrom": {
    en: "Loans from 50 USDC · 12 monthly installments · no deposit",
    hi: "50 USDC से ऋण · 12 मासिक किस्तें · कोई जमा नहीं",
    ur: "50 USDC سے قرضے · 12 ماہانہ اقساط · کوئی جمع رقم نہیں",
    es: "Préstamos desde 50 USDC · 12 cuotas mensuales · sin depósito",
    ko: "50 USDC부터 대출 · 12개월 할부 · 보증금 없음",
    ar: "قروض من 50 USDC · 12 قسطًا شهريًا · بدون دفعة أولى",
  },
  "home.borrowNow": {
    en: "Borrow now",
    hi: "अभी उधार लें",
    ur: "ابھی قرض لیں",
    es: "Pide prestado ahora",
    ko: "지금 대출",
    ar: "اقترض الآن",
  },
  "home.save": { en: "Save", hi: "बचत", ur: "بچت", es: "Ahorrar", ko: "저축", ar: "ادّخر" },
  "home.invite": {
    en: "Invite",
    hi: "आमंत्रित करें",
    ur: "مدعو کریں",
    es: "Invitar",
    ko: "초대",
    ar: "دعوة",
  },
  "home.help": { en: "Help", hi: "सहायता", ur: "مدد", es: "Ayuda", ko: "도움말", ar: "مساعدة" },
  "home.promo": {
    en: "Refer a neighbour, earn {reward} USDC each",
    hi: "पड़ोसी को रेफ़र करें, दोनों को {reward} USDC",
    ur: "پڑوسی کو ریفر کریں، دونوں کو {reward} USDC",
    es: "Refiere a un vecino y ganen {reward} USDC cada uno",
    ko: "이웃을 추천하고 양쪽 모두 {reward} USDC 받기",
    ar: "أحِل جارًا واربحا {reward} USDC لكل منكما",
  },
  "home.recentActivity": {
    en: "Recent activity",
    hi: "हाल की गतिविधि",
    ur: "حالیہ سرگرمی",
    es: "Actividad reciente",
    ko: "최근 활동",
    ar: "النشاط الأخير",
  },
  "home.seeAll": {
    en: "See all",
    hi: "सभी देखें",
    ur: "سب دیکھیں",
    es: "Ver todo",
    ko: "모두 보기",
    ar: "عرض الكل",
  },
  "home.connectToSee": {
    en: "Connect a wallet to see your activity.",
    hi: "अपनी गतिविधि देखने के लिए वॉलेट कनेक्ट करें।",
    ur: "اپنی سرگرمی دیکھنے کے لیے والٹ منسلک کریں۔",
    es: "Conecta una billetera para ver tu actividad.",
    ko: "활동을 보려면 지갑을 연결하세요.",
    ar: "اربط محفظة لعرض نشاطك.",
  },
  "home.noTransfers": {
    en: "No transfers yet.",
    hi: "अभी कोई लेन-देन नहीं।",
    ur: "ابھی کوئی منتقلی نہیں۔",
    es: "Aún no hay transferencias.",
    ko: "아직 거래가 없습니다.",
    ar: "لا توجد تحويلات بعد.",
  },
  "home.received": {
    en: "Received",
    hi: "प्राप्त",
    ur: "موصول",
    es: "Recibido",
    ko: "받음",
    ar: "مستلم",
  },
  "home.sent": { en: "Sent", hi: "भेजा", ur: "بھیجا", es: "Enviado", ko: "보냄", ar: "مرسل" },
  "home.exploreMarket": {
    en: "Explore the credit marketplace",
    hi: "क्रेडिट मार्केटप्लेस देखें",
    ur: "کریڈٹ مارکیٹ پلیس دیکھیں",
    es: "Explora el mercado de crédito",
    ko: "크레딧 마켓플레이스 둘러보기",
    ar: "استكشف سوق الائتمان",
  },

  // Wallet
  "wallet.title": {
    en: "Wallet",
    hi: "वॉलेट",
    ur: "والٹ",
    es: "Billetera",
    ko: "지갑",
    ar: "المحفظة",
  },
  "wallet.connectedWallet": {
    en: "Connected wallet",
    hi: "कनेक्टेड वॉलेट",
    ur: "منسلک والٹ",
    es: "Billetera conectada",
    ko: "연결된 지갑",
    ar: "المحفظة المتصلة",
  },
  "wallet.getTestnet": {
    en: "Get testnet {asset}",
    hi: "टेस्टनेट {asset} प्राप्त करें",
    ur: "ٹیسٹ نیٹ {asset} حاصل کریں",
    es: "Obtén {asset} de testnet",
    ko: "테스트넷 {asset} 받기",
    ar: "احصل على {asset} تجريبي",
  },
  "wallet.send": { en: "Send", hi: "भेजें", ur: "بھیجیں", es: "Enviar", ko: "보내기", ar: "إرسال" },
  "wallet.receive": {
    en: "Receive",
    hi: "प्राप्त करें",
    ur: "وصول کریں",
    es: "Recibir",
    ko: "받기",
    ar: "استلام",
  },
  "wallet.topup": {
    en: "Top up",
    hi: "टॉप अप",
    ur: "ٹاپ اپ",
    es: "Recargar",
    ko: "충전",
    ar: "شحن",
  },
  "wallet.save": { en: "Save", hi: "बचत", ur: "بچت", es: "Ahorrar", ko: "저축", ar: "ادّخر" },
  "wallet.recentActivity": {
    en: "Recent activity",
    hi: "हाल की गतिविधि",
    ur: "حالیہ سرگرمی",
    es: "Actividad reciente",
    ko: "최근 활동",
    ar: "النشاط الأخير",
  },
  "wallet.noActivity": {
    en: "No activity yet — top up USDC or start saving to see your transactions.",
    hi: "अभी कोई गतिविधि नहीं — लेन-देन देखने के लिए USDC टॉप अप करें या बचत शुरू करें।",
    ur: "ابھی کوئی سرگرمی نہیں — لین دین دیکھنے کے لیے USDC ٹاپ اپ کریں یا بچت شروع کریں۔",
    es: "Aún sin actividad — recarga USDC o empieza a ahorrar para ver tus transacciones.",
    ko: "아직 활동이 없습니다 — 거래를 보려면 USDC를 충전하거나 저축을 시작하세요.",
    ar: "لا نشاط بعد — اشحن USDC أو ابدأ الادخار لعرض معاملاتك.",
  },
  "wallet.addTrustline": {
    en: "Add a trustline to receive {assets}",
    hi: "{assets} प्राप्त करने के लिए ट्रस्टलाइन जोड़ें",
    ur: "{assets} وصول کرنے کے لیے ٹرسٹ لائن شامل کریں",
    es: "Añade una línea de confianza para recibir {assets}",
    ko: "{assets}를 받으려면 신뢰선을 추가하세요",
    ar: "أضف خط ثقة لاستلام {assets}",
  },
  "wallet.addTrustlineBtn": {
    en: "Add {code} trustline",
    hi: "{code} ट्रस्टलाइन जोड़ें",
    ur: "{code} ٹرسٹ لائن شامل کریں",
    es: "Añadir línea de {code}",
    ko: "{code} 신뢰선 추가",
    ar: "أضف خط ثقة {code}",
  },
  "wallet.xlm": {
    en: "XLM · Spendable",
    hi: "XLM · खर्च योग्य",
    ur: "XLM · قابل خرچ",
    es: "XLM · Gastable",
    ko: "XLM · 사용 가능",
    ar: "XLM · قابل للصرف",
  },

  // Profile
  "profile.title": {
    en: "Profile",
    hi: "प्रोफ़ाइल",
    ur: "پروفائل",
    es: "Perfil",
    ko: "프로필",
    ar: "الملف الشخصي",
  },
  "profile.edit": {
    en: "Edit profile",
    hi: "प्रोफ़ाइल संपादित करें",
    ur: "پروفائل میں ترمیم کریں",
    es: "Editar perfil",
    ko: "프로필 수정",
    ar: "تعديل الملف",
  },
  "profile.notifications": {
    en: "Notifications",
    hi: "सूचनाएँ",
    ur: "اطلاعات",
    es: "Notificaciones",
    ko: "알림",
    ar: "الإشعارات",
  },
  "profile.language": {
    en: "Language & currency",
    hi: "भाषा और मुद्रा",
    ur: "زبان اور کرنسی",
    es: "Idioma y moneda",
    ko: "언어 및 통화",
    ar: "اللغة والعملة",
  },
  "profile.paymentMethods": {
    en: "Payment methods",
    hi: "भुगतान के तरीके",
    ur: "ادائیگی کے طریقے",
    es: "Métodos de pago",
    ko: "결제 수단",
    ar: "طرق الدفع",
  },
  "profile.refer": {
    en: "Refer & earn",
    hi: "रेफ़र करें और कमाएँ",
    ur: "ریفر کریں اور کمائیں",
    es: "Refiere y gana",
    ko: "추천하고 적립",
    ar: "أحِل واربح",
  },
  "profile.help": {
    en: "Help & support",
    hi: "सहायता और समर्थन",
    ur: "مدد اور معاونت",
    es: "Ayuda y soporte",
    ko: "도움말 및 지원",
    ar: "المساعدة والدعم",
  },
  "profile.legal": {
    en: "Legal",
    hi: "कानूनी",
    ur: "قانونی",
    es: "Legal",
    ko: "법적 고지",
    ar: "قانوني",
  },
  "profile.logout": {
    en: "Log out",
    hi: "लॉग आउट",
    ur: "لاگ آؤٹ",
    es: "Cerrar sesión",
    ko: "로그아웃",
    ar: "تسجيل الخروج",
  },
  "profile.admin": {
    en: "Admin console",
    hi: "एडमिन कंसोल",
    ur: "ایڈمن کنسول",
    es: "Consola de administración",
    ko: "관리자 콘솔",
    ar: "لوحة التحكم",
  },
  "profile.stellarWallet": {
    en: "Stellar wallet",
    hi: "स्टेलर वॉलेट",
    ur: "سٹیلر والٹ",
    es: "Billetera Stellar",
    ko: "Stellar 지갑",
    ar: "محفظة Stellar",
  },
  "profile.notConnected": {
    en: "Not connected",
    hi: "कनेक्टेड नहीं",
    ur: "منسلک نہیں",
    es: "No conectada",
    ko: "연결 안 됨",
    ar: "غير متصل",
  },

  // Market
  "market.title": {
    en: "Credit marketplace",
    hi: "क्रेडिट मार्केटप्लेस",
    ur: "کریڈٹ مارکیٹ پلیس",
    es: "Mercado de crédito",
    ko: "크레딧 마켓플레이스",
    ar: "سوق الائتمان",
  },
  "market.borrow": { en: "Borrow", hi: "उधार", ur: "قرض", es: "Prestar", ko: "대출", ar: "اقتراض" },
  "market.lend": {
    en: "Lend",
    hi: "उधार दें",
    ur: "قرض دیں",
    es: "Prestar",
    ko: "대출해주기",
    ar: "إقراض",
  },
  "market.borrowBlurb": {
    en: "Neighbourhood loans. The principal is paid straight to your wallet, you repay in monthly installments. Borrowers and lenders share the same Stellar pool.",
    hi: "पड़ोस ऋण। राशि सीधे आपके वॉलेट में आती है, आप मासिक किस्तों में चुकाते हैं। उधारकर्ता और उधारदाता एक ही स्टेलर पूल साझा करते हैं।",
    ur: "محلے کے قرضے۔ رقم براہ راست آپ کے والٹ میں آتی ہے، آپ ماہانہ اقساط میں ادا کرتے ہیں۔ قرض لینے والے اور دینے والے ایک ہی سٹیلر پول شئیر کرتے ہیں۔",
    es: "Préstamos vecinales. El capital llega directo a tu billetera y pagas en cuotas mensuales. Prestatarios y prestamistas comparten el mismo fondo Stellar.",
    ko: "이웃 대출입니다. 원금은 지갑으로 바로 지급되며 월 할부로 상환합니다. 대출자와 투자자가 같은 Stellar 풀을 공유합니다.",
    ar: "قروض الجوار. يُدفع المبلغ مباشرة إلى محفظتك وتُسدد بأقساط شهرية. يقاسم المقترضون والمقرضون نفس صندوق Stellar.",
  },
  "market.loading": {
    en: "Loading loans from Stellar…",
    hi: "स्टेलर से ऋण लोड हो रहे हैं…",
    ur: "سٹیلر سے قرضے لوڈ ہو رہے ہیں…",
    es: "Cargando préstamos desde Stellar…",
    ko: "Stellar에서 대출 불러오는 중…",
    ar: "جارٍ تحميل القروض من Stellar…",
  },
  "market.noLoans": {
    en: "No loans available. Connect your wallet and try again.",
    hi: "कोई ऋण उपलब्ध नहीं। वॉलेट कनेक्ट करें और फिर कोशिश करें।",
    ur: "کوئی قرض دستیاب نہیں۔ والٹ منسلک کریں اور دوبارہ کوشش کریں۔",
    es: "No hay préstamos disponibles. Conecta tu billetera e inténtalo de nuevo.",
    ko: "사용 가능한 대출이 없습니다. 지갑을 연결하고 다시 시도하세요.",
    ar: "لا توجد قروض متاحة. اربط محفظتك وحاول مجددًا.",
  },
};

export function t(lang: string, key: string, vars?: Record<string, string>): string {
  const entry = dict[key];
  let out = entry?.[lang as LangCode] ?? entry?.en ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, v);
    }
  }
  return out;
}

export function useT(address?: string | null) {
  const profile = useProfile(address);
  const lang = LANG_OPTIONS.some((o) => o.code === profile.language) ? profile.language : "en";
  const translate = (key: string, vars?: Record<string, string>) => t(lang, key, vars);
  return { lang, translate, isRtl: isRtl(lang) };
}
