import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const APP_URL = process.env.MINI_APP_URL ||
  "https://prep-tin-opponent-bald.trycloudflare.com  ";

function appPageUrl(page) {
  const url = new URL(APP_URL);
  url.searchParams.set("page", page);
  return url.toString();
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const BOT_NAME = "LinkDrop";
const SUPPORT_TEXT = {
  fr: "Pour obtenir de l'aide, contacte l'équipe LinkDrop depuis l'application.",
  en: "For help, contact the LinkDrop team through the application.",
  es: "Para obtener ayuda, contacta con el equipo de LinkDrop desde la aplicación.",
  de: "Wenn du Hilfe benötigst, kontaktiere das LinkDrop-Team über die Anwendung.",
  pt: "Para obter ajuda, contacta a equipa LinkDrop através da aplicação.",
  ar: "للحصول على المساعدة، تواصل مع فريق LinkDrop من داخل التطبيق.",
};

const LANGUAGES = {
  fr: { label: "🇫🇷 Français", name: "Français" },
  en: { label: "🇬🇧 English", name: "English" },
  es: { label: "🇪🇸 Español", name: "Español" },
  de: { label: "🇩🇪 Deutsch", name: "Deutsch" },
  pt: { label: "🇵🇹 Português", name: "Português" },
  ar: { label: "🇸🇦 العربية", name: "العربية" },
};

const TEXT = {
  fr: {
    welcome: "Bienvenue sur <b>LINKDROP</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\nTon espace de gestion des missions et livraisons.\n\nChoisis une rubrique pour continuer.",
    menuTitle: "◈ <b>CENTRE DE CONTRÔLE</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\nQue souhaites-tu faire ?",
    open: "◈ Ouvrir LinkDrop",
    missions: "▣ Mes missions",
    account: "◉ Mon compte",
    application: "▤ Ma candidature",
    help: "⌘ Centre d'aide",
    support: "◇ Support",
    language: "◎ Langue",
    back: "‹ Menu principal",
    helpText: "<b>CENTRE D'AIDE</b>\n\nJe peux t'aider à comprendre les missions, les candidatures, ton compte et les moyens de transport.\n\nTu peux écrire ta question directement ou choisir une rubrique.",
    missionsText: "<b>MISSIONS LINKDROP</b>\n\nUne mission est d'abord vérifiée par l'équipe. Elle est ensuite proposée à un livreur compatible.",
    applicationText: "<b>TA CANDIDATURE</b>\n\nTu peux consulter ton dossier et suivre son état depuis ton espace LinkDrop.",
    accountText: "<b>TON COMPTE</b>\n\nRetrouve tes informations personnelles dans l'application LinkDrop.",
    languageTitle: "<b>LANGUE / LANGUAGE</b>\n\nChoisis la langue de ton interface LinkDrop.",
    languageSaved: "Langue enregistrée : Français.",
    supportText: SUPPORT_TEXT.fr,
    appText: "Ouvre ton espace LinkDrop avec le bouton ci-dessous.",
    unknown: "Je ne suis pas certain d'avoir compris. Tu peux reformuler ou choisir une rubrique dans le menu.",
    photo: "J'ai bien reçu ton image. Pour le moment, décris-moi ce que tu souhaites que je vérifie.",
    document: "J'ai bien reçu ton document. Décris-moi ce que tu souhaites faire avec celui-ci.",
    generic: "Je peux principalement traiter les messages écrits pour le moment. Explique-moi ce dont tu as besoin.",
    error: "Une erreur est survenue. Réessaie dans quelques instants.",
    commands: "Commandes disponibles :\n/start — démarrer\n/app — ouvrir l'application\n/menu — menu principal\n/help — aide\n/language — choisir la langue\n/contact — support\n/missions — missions\n/candidature — candidature",
    payment: "Pour les questions de paiement ou de rémunération, consulte les informations officielles dans ton espace LinkDrop ou contacte le support. Je préfère ne pas annoncer de montant non vérifié.",
    problem: "Je peux t'aider. Est-ce que le problème concerne ton compte, une mission ou l'application ?",
    transport: "Les moyens de transport, la zone et la capacité font partie des critères utilisés pour vérifier la compatibilité avec une mission.",
    greeting: "Bonjour ! Bienvenue sur LinkDrop. Que puis-je faire pour toi ?",
  },

  en: {
    welcome: "Welcome to <b>LINKDROP</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\nYour space for managing missions and deliveries.\n\nChoose a section to continue.",
    menuTitle: "◈ <b>CONTROL CENTER</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\nWhat would you like to do?",
    open: "◈ Open LinkDrop",
    missions: "▣ My missions",
    account: "◉ My account",
    application: "▤ My application",
    help: "⌘ Help center",
    support: "◇ Support",
    language: "◎ Language",
    back: "‹ Main menu",
    helpText: "<b>HELP CENTER</b>\n\nI can help you with missions, applications, your account and transport options.\n\nType your question or choose a section.",
    missionsText: "<b>LINKDROP MISSIONS</b>\n\nEach mission is reviewed by the team before being offered to a compatible driver.",
    applicationText: "<b>YOUR APPLICATION</b>\n\nYou can view your application and track its status in your LinkDrop space.",
    accountText: "<b>YOUR ACCOUNT</b>\n\nManage your personal information in the LinkDrop application.",
    languageTitle: "<b>LANGUAGE</b>\n\nChoose your LinkDrop interface language.",
    languageSaved: "Language saved: English.",
    supportText: SUPPORT_TEXT.en,
    appText: "Open your LinkDrop space using the button below.",
    unknown: "I'm not sure I understood. Please rephrase or choose a section from the menu.",
    photo: "I received your image. For now, please describe what you would like me to check.",
    document: "I received your document. Please describe what you would like to do with it.",
    generic: "I can mainly process text messages for now. Tell me what you need.",
    error: "Something went wrong. Please try again in a moment.",
    commands: "Available commands:\n/start — start\n/app — open the app\n/menu — main menu\n/help — help\n/language — choose language\n/contact — support\n/missions — missions\n/candidature — application",
    payment: "For payment or compensation questions, check the official information in your LinkDrop space or contact support. I won't provide unverified amounts.",
    problem: "I can help. Is the issue related to your account, a mission or the application?",
    transport: "Transport, service area and capacity are among the criteria used to check mission compatibility.",
    greeting: "Hello! Welcome to LinkDrop. What can I do for you?",
  },

  es: {
    welcome: "Bienvenido a <b>LINKDROP</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\nTu espacio para gestionar misiones y entregas.\n\nElige una sección para continuar.",
    menuTitle: "◈ <b>CENTRO DE CONTROL</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\n¿Qué deseas hacer?",
    open: "◈ Abrir LinkDrop",
    missions: "▣ Mis misiones",
    account: "◉ Mi cuenta",
    application: "▤ Mi candidatura",
    help: "⌘ Centro de ayuda",
    support: "◇ Soporte",
    language: "◎ Idioma",
    back: "‹ Menú principal",
    helpText: "<b>CENTRO DE AYUDA</b>\n\nPuedo ayudarte con las misiones, las candidaturas, tu cuenta y los medios de transporte.\n\nEscribe tu pregunta o elige una sección.",
    missionsText: "<b>MISIONES LINKDROP</b>\n\nEl equipo revisa cada misión antes de ofrecérsela a un repartidor compatible.",
    applicationText: "<b>TU CANDIDATURA</b>\n\nPuedes consultar tu expediente y su estado desde tu espacio LinkDrop.",
    accountText: "<b>TU CUENTA</b>\n\nGestiona tus datos personales desde la aplicación LinkDrop.",
    languageTitle: "<b>IDIOMA</b>\n\nElige el idioma de LinkDrop.",
    languageSaved: "Idioma guardado: Español.",
    supportText: SUPPORT_TEXT.es,
    appText: "Abre tu espacio LinkDrop con el botón de abajo.",
    unknown: "No estoy seguro de haber entendido. Reformula tu pregunta o elige una sección del menú.",
    photo: "He recibido tu imagen. Por ahora, describe qué quieres que compruebe.",
    document: "He recibido tu documento. Describe qué quieres hacer con él.",
    generic: "Por ahora puedo procesar principalmente mensajes de texto. Cuéntame qué necesitas.",
    error: "Ha ocurrido un error. Inténtalo de nuevo en unos instantes.",
    commands: "Comandos disponibles:\n/start — iniciar\n/app — abrir la aplicación\n/menu — menú principal\n/help — ayuda\n/language — elegir idioma\n/contact — soporte\n/missions — misiones\n/candidature — candidatura",
    payment: "Para cuestiones de pagos o remuneración, consulta la información oficial en tu espacio LinkDrop o contacta con soporte. No daré importes sin verificar.",
    problem: "Puedo ayudarte. ¿El problema está relacionado con tu cuenta, una misión o la aplicación?",
    transport: "El transporte, la zona y la capacidad son criterios para comprobar la compatibilidad con una misión.",
    greeting: "¡Hola! Bienvenido a LinkDrop. ¿Qué puedo hacer por ti?",
  },

  de: {
    welcome: "Willkommen bei <b>LINKDROP</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\nDein Bereich zur Verwaltung von Aufträgen und Lieferungen.\n\nWähle einen Bereich aus.",
    menuTitle: "◈ <b>STEUERZENTRALE</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\nWas möchtest du tun?",
    open: "◈ LinkDrop öffnen",
    missions: "▣ Meine Aufträge",
    account: "◉ Mein Konto",
    application: "▤ Meine Bewerbung",
    help: "⌘ Hilfe",
    support: "◇ Support",
    language: "◎ Sprache",
    back: "‹ Hauptmenü",
    helpText: "<b>HILFECENTER</b>\n\nIch helfe dir bei Aufträgen, Bewerbungen, deinem Konto und Transportmöglichkeiten.\n\nSchreibe deine Frage oder wähle einen Bereich.",
    missionsText: "<b>LINKDROP-AUFTRÄGE</b>\n\nJeder Auftrag wird vom Team geprüft, bevor er einem passenden Fahrer angeboten wird.",
    applicationText: "<b>DEINE BEWERBUNG</b>\n\nDu kannst deine Bewerbung und ihren Status in deinem LinkDrop-Bereich ansehen.",
    accountText: "<b>DEIN KONTO</b>\n\nVerwalte deine persönlichen Daten in der LinkDrop-App.",
    languageTitle: "<b>SPRACHE</b>\n\nWähle die Sprache deiner LinkDrop-Oberfläche.",
    languageSaved: "Sprache gespeichert: Deutsch.",
    supportText: SUPPORT_TEXT.de,
    appText: "Öffne deinen LinkDrop-Bereich über die Schaltfläche unten.",
    unknown: "Ich bin mir nicht sicher, ob ich dich richtig verstanden habe. Bitte formuliere deine Frage anders oder wähle einen Menüpunkt.",
    photo: "Ich habe dein Bild erhalten. Bitte beschreibe, was ich überprüfen soll.",
    document: "Ich habe dein Dokument erhalten. Bitte beschreibe, was du damit machen möchtest.",
    generic: "Zurzeit kann ich hauptsächlich Textnachrichten verarbeiten. Erkläre mir, wobei du Hilfe brauchst.",
    error: "Ein Fehler ist aufgetreten. Bitte versuche es gleich noch einmal.",
    commands: "Verfügbare Befehle:\n/start — starten\n/app — App öffnen\n/menu — Hauptmenü\n/help — Hilfe\n/language — Sprache wählen\n/contact — Support\n/missions — Aufträge\n/candidature — Bewerbung",
    payment: "Informationen zu Zahlungen findest du in deinem LinkDrop-Bereich oder beim Support. Ich nenne keine unbestätigten Beträge.",
    problem: "Ich helfe dir gern. Betrifft das Problem dein Konto, einen Auftrag oder die Anwendung?",
    transport: "Transportmittel, Einsatzgebiet und Kapazität helfen dabei, die Eignung für einen Auftrag zu prüfen.",
    greeting: "Hallo! Willkommen bei LinkDrop. Wie kann ich dir helfen?",
  },

  pt: {
    welcome: "Bem-vindo à <b>LINKDROP</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\nO teu espaço para gerir missões e entregas.\n\nEscolhe uma secção para continuar.",
    menuTitle: "◈ <b>CENTRO DE CONTROLO</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\nO que pretendes fazer?",
    open: "◈ Abrir LinkDrop",
    missions: "▣ As minhas missões",
    account: "◉ A minha conta",
    application: "▤ A minha candidatura",
    help: "⌘ Centro de ajuda",
    support: "◇ Suporte",
    language: "◎ Idioma",
    back: "‹ Menu principal",
    helpText: "<b>CENTRO DE AJUDA</b>\n\nPosso ajudar com missões, candidaturas, a tua conta e meios de transporte.\n\nEscreve a tua pergunta ou escolhe uma secção.",
    missionsText: "<b>MISSÕES LINKDROP</b>\n\nA equipa verifica cada missão antes de a propor a um estafeta compatível.",
    applicationText: "<b>A TUA CANDIDATURA</b>\n\nPodes consultar o teu processo e o respetivo estado na tua área LinkDrop.",
    accountText: "<b>A TUA CONTA</b>\n\nGere os teus dados pessoais na aplicação LinkDrop.",
    languageTitle: "<b>IDIOMA</b>\n\nEscolhe o idioma da interface LinkDrop.",
    languageSaved: "Idioma guardado: Português.",
    supportText: SUPPORT_TEXT.pt,
    appText: "Abre a tua área LinkDrop através do botão abaixo.",
    unknown: "Não tenho a certeza de ter percebido. Reformula a pergunta ou escolhe uma secção do menu.",
    photo: "Recebi a tua imagem. Por agora, descreve o que pretendes que eu verifique.",
    document: "Recebi o teu documento. Descreve o que pretendes fazer com ele.",
    generic: "Por enquanto, consigo tratar principalmente mensagens de texto. Diz-me do que precisas.",
    error: "Ocorreu um erro. Tenta novamente dentro de alguns instantes.",
    commands: "Comandos disponíveis:\n/start — iniciar\n/app — abrir aplicação\n/menu — menu principal\n/help — ajuda\n/language — escolher idioma\n/contact — suporte\n/missions — missões\n/candidature — candidatura",
    payment: "Para informações sobre pagamentos, consulta a tua área LinkDrop ou contacta o suporte. Não vou indicar valores não confirmados.",
    problem: "Posso ajudar. O problema está relacionado com a tua conta, uma missão ou a aplicação?",
    transport: "O meio de transporte, a zona e a capacidade são critérios usados para verificar a compatibilidade com uma missão.",
    greeting: "Olá! Bem-vindo à LinkDrop. Como posso ajudar?",
  },

  ar: {
    welcome: "مرحباً بك في <b>LINKDROP</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\nمساحتك لإدارة المهام والتوصيلات.\n\nاختر قسماً للمتابعة.",
    menuTitle: "◈ <b>مركز التحكم</b>\n<code>━━━━━━━━━━━━━━━━━━</code>\nماذا تريد أن تفعل؟",
    open: "◈ فتح LinkDrop",
    missions: "▣ مهامي",
    account: "◉ حسابي",
    application: "▤ طلبي",
    help: "⌘ مركز المساعدة",
    support: "◇ الدعم",
    language: "◎ اللغة",
    back: "‹ القائمة الرئيسية",
    helpText: "<b>مركز المساعدة</b>\n\nيمكنني مساعدتك بشأن المهام والطلبات والحساب ووسائل النقل.\n\nاكتب سؤالك أو اختر قسماً.",
    missionsText: "<b>مهام LINKDROP</b>\n\nيقوم الفريق بمراجعة كل مهمة قبل عرضها على مندوب مناسب.",
    applicationText: "<b>طلبك</b>\n\nيمكنك متابعة ملفك وحالته من حسابك في LinkDrop.",
    accountText: "<b>حسابك</b>\n\nيمكنك إدارة معلوماتك الشخصية من تطبيق LinkDrop.",
    languageTitle: "<b>اللغة</b>\n\nاختر لغة واجهة LinkDrop.",
    languageSaved: "تم حفظ اللغة: العربية.",
    supportText: SUPPORT_TEXT.ar,
    appText: "افتح مساحة LinkDrop باستخدام الزر أدناه.",
    unknown: "لست متأكداً أنني فهمت طلبك. يرجى إعادة صياغته أو اختيار قسم من القائمة.",
    photo: "وصلتني صورتك. يرجى وصف ما تريد مني التحقق منه.",
    document: "وصلني مستندك. يرجى توضيح ما تريد فعله.",
    generic: "يمكنني حالياً التعامل بشكل أساسي مع الرسائل النصية. أخبرني بما تحتاج إليه.",
    error: "حدث خطأ. يرجى المحاولة مرة أخرى بعد قليل.",
    commands: "الأوامر المتاحة:\n/start — بدء\n/app — فتح التطبيق\n/menu — القائمة الرئيسية\n/help — المساعدة\n/language — اختيار اللغة\n/contact — الدعم\n/missions — المهام\n/candidature — الطلب",
    payment: "للاستفسار عن المدفوعات، راجع المعلومات الرسمية في حسابك على LinkDrop أو تواصل مع الدعم. لن أذكر مبالغ غير مؤكدة.",
    problem: "يمكنني مساعدتك. هل المشكلة تتعلق بحسابك أم بمهمة أم بالتطبيق؟",
    transport: "تُستخدم وسيلة النقل والمنطقة والسعة للتحقق من توافقك مع المهمة.",
    greeting: "مرحباً! أهلاً بك في LinkDrop. كيف يمكنني مساعدتك؟",
  },
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const LANGUAGE_FILE = path.join(DATA_DIR, "telegram-languages.json");
const languageByUser = new Map();

async function loadLanguages() {
  try {
    const saved = JSON.parse(await fs.readFile(LANGUAGE_FILE, "utf8"));
    for (const [userId, lang] of Object.entries(saved)) {
      if (LANGUAGES[lang]) languageByUser.set(String(userId), lang);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Lecture des langues impossible :", error.message);
    }
  }
}

let saveQueue = Promise.resolve();

function saveLanguages() {
  saveQueue = saveQueue
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const data = Object.fromEntries(languageByUser);
      await fs.writeFile(LANGUAGE_FILE, JSON.stringify(data, null, 2), "utf8");
    })
    .catch((error) => {
      console.error("Sauvegarde des langues impossible :", error.message);
    });

  return saveQueue;
}

function getLanguage(user) {
  const saved = languageByUser.get(String(user?.id));
  if (saved) return saved;

  const telegramLanguage = String(user?.language_code || "en")
    .toLowerCase()
    .split("-")[0];

  return LANGUAGES[telegramLanguage] ? telegramLanguage : "en";
}

function setLanguage(userId, lang) {
  if (!LANGUAGES[lang]) return false;

  languageByUser.set(String(userId), lang);
  void saveLanguages();

  return true;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function telegram(method, body = {}) {
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Erreur Telegram : ${method}`);
  }

  return result.result;
}

async function reply(chatId, text, keyboard = null, options = {}) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(keyboard ? { reply_markup: keyboard } : {}),
    disable_web_page_preview: true,
    ...options,
  });
}

async function editReply(chatId, messageId, text, keyboard = null) {
  return telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...(keyboard ? { reply_markup: keyboard } : {}),
    disable_web_page_preview: true,
  });
}

async function answerCallback(callbackId, text = "") {
  return telegram("answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
    show_alert: false,
  });
}

async function typing(chatId) {
  try {
    await telegram("sendChatAction", {
      chat_id: chatId,
      action: "typing",
    });
  } catch {
    // Le statut de saisie ne doit pas bloquer le bot.
  }
}

function mainMenu(lang) {
  const t = TEXT[lang];

  return {
    inline_keyboard: [
      [{ text: t.open, web_app: { url: APP_URL } }],
      [
        { text: t.missions, callback_data: "menu_missions" },
        { text: t.account, callback_data: "menu_account" },
      ],
      [
        { text: t.application, callback_data: "menu_application" },
        { text: t.help, callback_data: "menu_help" },
      ],
      [
        { text: t.language, callback_data: "menu_language" },
        { text: t.support, callback_data: "menu_support" },
      ],
    ],
  };
}

function backMenu(lang) {
  return {
    inline_keyboard: [
      [{ text: TEXT[lang].back, callback_data: "menu_home" }],
    ],
  };
}

function helpMenu(lang) {
  const t = TEXT[lang];

  return {
    inline_keyboard: [
      [
        { text: t.missions, callback_data: "menu_missions" },
        { text: t.application, callback_data: "menu_application" },
      ],
      [
        { text: t.account, callback_data: "menu_account" },
        { text: t.support, callback_data: "menu_support" },
      ],
      [{ text: t.back, callback_data: "menu_home" }],
    ],
  };
}

function languageMenu() {
  return {
    inline_keyboard: [
      [
        { text: LANGUAGES.fr.label, callback_data: "lang_fr" },
        { text: LANGUAGES.en.label, callback_data: "lang_en" },
      ],
      [
        { text: LANGUAGES.es.label, callback_data: "lang_es" },
        { text: LANGUAGES.de.label, callback_data: "lang_de" },
      ],
      [
        { text: LANGUAGES.pt.label, callback_data: "lang_pt" },
        { text: LANGUAGES.ar.label, callback_data: "lang_ar" },
      ],
      [{ text: "‹", callback_data: "menu_home" }],
    ],
  };
}

const KNOWLEDGE = [
  {
    id: "missions",
    keywords: ["mission", "missions", "livraison", "livrer", "commande", "colis", "course", "proposition"],
    response: "missionsText",
    keyboard: (lang) => ({
      inline_keyboard: [
        [{ text: TEXT[lang].open, web_app: { url: APP_URL } }],
        [{ text: TEXT[lang].back, callback_data: "menu_home" }],
      ],
    }),
  },
  {
    id: "application",
    keywords: ["candidature", "postuler", "inscription", "inscrire", "devenir livreur", "rejoindre", "recrutement"],
    response: "applicationText",
    keyboard: (lang) => ({
      inline_keyboard: [
        [{ text: TEXT[lang].open, web_app: { url: APP_URL } }],
        [{ text: TEXT[lang].back, callback_data: "menu_home" }],
      ],
    }),
  },
  {
    id: "payment",
    keywords: ["paiement", "payer", "argent", "remuneration", "remunere", "gagner", "tarif", "prix", "salaire"],
    response: "payment",
  },
  {
    id: "account",
    keywords: ["compte", "profil", "identifiant", "connexion", "connecter", "deconnexion", "mot de passe"],
    response: "accountText",
    keyboard: (lang) => ({
      inline_keyboard: [
        [{ text: TEXT[lang].open, web_app: { url: APP_URL } }],
        [{ text: TEXT[lang].back, callback_data: "menu_home" }],
      ],
    }),
  },
  {
    id: "problem",
    keywords: ["bug", "probleme", "erreur", "marche pas", "fonctionne pas", "bloque", "impossible", "plante"],
    response: "problem",
    keyboard: (lang) => helpMenu(lang),
  },
  {
    id: "transport",
    keywords: ["velo", "voiture", "scooter", "transport", "vehicule", "capacite", "distance", "zone"],
    response: "transport",
  },
  {
    id: "contact",
    keywords: ["support", "contact", "contacter", "aide humaine", "administrateur", "admin", "responsable"],
    response: "supportText",
  },
  {
    id: "greeting",
    keywords: ["bonjour", "salut", "slt", "hello", "bonsoir", "yo", "coucou", "wesh"],
    response: "greeting",
    keyboard: (lang) => mainMenu(lang),
  },
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntent(message) {
  // Les commandes Telegram sont traitées avant la normalisation (qui retire les "/").
  const command = String(message || "")
    .trim()
    .split(/\s+/)[0]
    .split("@")[0]
    .toLowerCase();

  const commandMap = {
    "/start": "start",
    "/app": "app",
    "/help": "help",
    "/menu": "menu",
    "/language": "language",
    "/lang": "language",
    "/contact": "contact",
    "/missions": "missions",
    "/candidature": "application",
  };

  if (commandMap[command]) return commandMap[command];

  const text = normalize(message);
  if (!text) return "unknown";

  for (const item of KNOWLEDGE) {
    if (item.keywords.some((keyword) => text.includes(normalize(keyword)))) {
      return item.id;
    }
  }

  return "unknown";
}

async function showHome(chatId, lang, messageId = null) {
  const text = `${TEXT[lang].welcome}\n\n${TEXT[lang].menuTitle}`;

  if (messageId) {
    return editReply(chatId, messageId, text, mainMenu(lang));
  }

  return reply(chatId, text, mainMenu(lang));
}

async function handleText(message) {
  const chatId = message.chat.id;
  const user = message.from || { id: chatId };
  const lang = getLanguage(user);
  const t = TEXT[lang];
  const originalText = String(message.text || "").trim();

  if (!originalText) return;

  const intent = detectIntent(originalText);

  await typing(chatId);

  if (intent === "start") {
    await showHome(chatId, lang);
    return;
  }

  if (intent === "app") {
    await reply(chatId, t.appText, {
      inline_keyboard: [
        [{ text: t.open, web_app: { url: APP_URL } }],
        [{ text: t.back, callback_data: "menu_home" }],
      ],
    });
    return;
  }

  if (intent === "menu") {
    await reply(chatId, t.menuTitle, mainMenu(lang));
    return;
  }

  if (intent === "language") {
    await reply(chatId, t.languageTitle, languageMenu());
    return;
  }

  if (intent === "help") {
    await reply(chatId, t.helpText, helpMenu(lang));
    return;
  }

  const item = KNOWLEDGE.find((entry) => entry.id === intent);

  if (!item) {
    await reply(chatId, t.unknown, helpMenu(lang));
    return;
  }

  const keyboard = item.keyboard ? item.keyboard(lang) : backMenu(lang);

  await reply(chatId, t[item.response], keyboard);
}

async function handleCallback(callback) {
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;
  const user = callback.from || { id: chatId };
  const data = callback.data;

  if (!chatId || !data) {
    await answerCallback(callback.id);
    return;
  }

  if (data.startsWith("lang_")) {
    const selected = data.slice(5);

    if (LANGUAGES[selected]) {
      setLanguage(user.id, selected);

      const t = TEXT[selected];

      await answerCallback(callback.id, t.languageSaved);

      await editReply(
        chatId,
        messageId,
        `${t.languageSaved}\n\n${t.menuTitle}`,
        mainMenu(selected)
      );

      return;
    }
  }

  const lang = getLanguage(user);
  const t = TEXT[lang];

  await answerCallback(callback.id);

  switch (data) {
    case "menu_home":
      await editReply(chatId, messageId, t.menuTitle, mainMenu(lang));
      break;

    case "menu_help":
      await editReply(chatId, messageId, t.helpText, helpMenu(lang));
      break;

    case "menu_language":
      await editReply(chatId, messageId, t.languageTitle, languageMenu());
      break;

    case "menu_missions":
      await editReply(chatId, messageId, t.missionsText, {
        inline_keyboard: [
          [{ text: "🚀 Ouvrir mes missions", web_app: { url: appPageUrl("missions") } }],
          [{ text: t.back, callback_data: "menu_home" }],
        ],
      });
      break;

    case "menu_application":
      await editReply(chatId, messageId, t.applicationText, {
        inline_keyboard: [
          [{ text: t.open, web_app: { url: appPageUrl("application") } }],
          [{ text: t.back, callback_data: "menu_home" }],
        ],
      });
      break;

    case "menu_account":
      await editReply(chatId, messageId, t.accountText, {
        inline_keyboard: [
          [{ text: "Ouvrir mon compte", web_app: { url: appPageUrl("account") } }],
          [{ text: t.back, callback_data: "menu_home" }],
        ],
      });
      break;

    case "menu_support":
      await editReply(chatId, messageId, t.supportText, backMenu(lang));
      break;

    default:
      await editReply(chatId, messageId, t.unknown, mainMenu(lang));
  }
}

async function handleUpdate(update) {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }

  const message = update.message;

  if (!message?.chat?.id || message.chat.type !== "private") return;

  const lang = getLanguage(message.from || { id: message.chat.id });

  if (message.text) {
    await handleText(message);
    return;
  }

  if (message.photo) {
    await reply(message.chat.id, TEXT[lang].photo, backMenu(lang));
    return;
  }

  if (message.document) {
    await reply(message.chat.id, TEXT[lang].document, backMenu(lang));
    return;
  }

  await reply(message.chat.id, TEXT[lang].generic, mainMenu(lang));
}

async function registerCommands() {
  // Telegram n'affiche qu'une langue de description par appel setMyCommands.
  await telegram("setMyCommands", {
    commands: [
      { command: "start", description: "Start LinkDrop" },
      { command: "app", description: "Open LinkDrop" },
      { command: "menu", description: "Main menu" },
      { command: "help", description: "Help center" },
      { command: "language", description: "Choose your language" },
      { command: "contact", description: "Contact support" },
      { command: "missions", description: "My missions" },
      { command: "candidature", description: "My application" },
    ],
  });
}

export async function startTelegramBot() {
  if (!BOT_TOKEN) {
    console.error("Telegram : TELEGRAM_BOT_TOKEN absent du .env");
    return;
  }

  if (!APP_URL) {
    console.error("Telegram : MINI_APP_URL absent du .env");
    return;
  }

  await loadLanguages();

  try {
    await registerCommands();
  } catch (error) {
    console.error(
      "Impossible d'enregistrer les commandes Telegram :",
      error.message
    );
  }

  let offset = 0;

  console.log("LinkDrop Telegram bot started.");

  while (true) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message", "callback_query"],
      });

      for (const update of updates) {
        offset = update.update_id + 1;

        try {
          await handleUpdate(update);
        } catch (error) {
          console.error("Erreur de traitement Telegram :", error.message);

          const chatId =
            update.message?.chat?.id ||
            update.callback_query?.message?.chat?.id;

          if (chatId) {
            try {
              const user =
                update.message?.from ||
                update.callback_query?.from ||
                { id: chatId };

              await reply(chatId, TEXT[getLanguage(user)].error);
            } catch {
              // Ne pas interrompre le polling.
            }
          }
        }
      }
    } catch (error) {
      console.error("Erreur Telegram :", error.message);
      await sleep(3000);
    }
  }
}