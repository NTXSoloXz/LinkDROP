import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import multer from "multer";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { startTelegramBot } from "./bot.js";
import { fileURLToPath } from "node:url";
import { rateLimit } from "express-rate-limit";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === "production";
const dataDir = path.join(__dirname, "data");
const uploadsDir = path.join(__dirname, "uploads");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

app.disable("x-powered-by");

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  credentials: true
}));

app.use(express.json({ limit: "150kb" }));

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de tentatives. Réessaie dans 15 minutes."
  }
});

const sessionSecret = process.env.SESSION_SECRET;

if (
  isProduction &&
  (
    !sessionSecret ||
    sessionSecret.length < 32 ||
    sessionSecret === "remplace-par-une-longue-chaine-aleatoire"
  )
) {
  throw new Error(
    "SESSION_SECRET doit Ãªtre une chaÃ®ne alÃ©atoire d'au moins 32 caractÃ¨res en production."
  );
}

app.use(session({
  name: "linkdrop_session",
  secret: sessionSecret || "local-only-session-secret-change-before-deployment-123456789",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 2 * 60 * 60 * 1000
  }
}));

const db = new Database(path.join(dataDir, "linkdrop.sqlite"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS private_access_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    revoked_at TEXT
  );

   CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    instructions TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mission_submission_sessions (
    session_id TEXT PRIMARY KEY,
    mission_id INTEGER NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    FOREIGN KEY (mission_id) REFERENCES missions(id)
  );


  CREATE INDEX IF NOT EXISTS idx_missions_status
    ON missions(status);

  CREATE INDEX IF NOT EXISTS idx_missions_scheduled_at
    ON missions(scheduled_at);

  CREATE INDEX IF NOT EXISTS idx_private_access_tokens_expiry
    ON private_access_tokens(expires_at);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    birth_date TEXT NOT NULL,
    city TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    phone TEXT NOT NULL,
    telegram_user_id TEXT,
    transports TEXT NOT NULL,
    main_transport TEXT NOT NULL,
    vehicle_access TEXT NOT NULL DEFAULT '',
    vehicle_capacity TEXT NOT NULL DEFAULT '',
    vehicle_photo TEXT,
    availability TEXT NOT NULL,
    delivery_types TEXT NOT NULL,
    zone TEXT NOT NULL DEFAULT '',
    max_distance INTEGER NOT NULL DEFAULT 10,
    max_orders INTEGER NOT NULL DEFAULT 1,
    anonymity TEXT NOT NULL,
    pickup_methods TEXT NOT NULL,
    handoff_methods TEXT NOT NULL,
    address_mode TEXT NOT NULL,
    payment_preferences TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT ''
  );
`);

function ensureColumn(table, column, declaration) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();

  if (!columns.some(item => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
  }
}

// Migrations non destructives : les anciennes donnÃ©es sont conservÃ©es.
ensureColumn("applications", "last_name", "TEXT NOT NULL DEFAULT ''");
ensureColumn("applications", "linkdrop_id", "TEXT");
ensureColumn("applications", "draft_json", "TEXT NOT NULL DEFAULT '{}'");
ensureColumn("applications", "updated_at", "TEXT");
ensureColumn("applications", "internal_notes", "TEXT NOT NULL DEFAULT ''");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    linkdrop_id TEXT NOT NULL UNIQUE,
    telegram_user_id TEXT UNIQUE,
    telegram_username TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_applications_status
    ON applications(status);

  CREATE INDEX IF NOT EXISTS idx_applications_city
    ON applications(city);

  CREATE INDEX IF NOT EXISTS idx_applications_linkdrop_id
    ON applications(linkdrop_id);

  CREATE INDEX IF NOT EXISTS idx_applications_telegram_id
    ON applications(telegram_user_id);

  CREATE TABLE IF NOT EXISTS application_drafts (
    telegram_user_id TEXT PRIMARY KEY,
    linkdrop_id TEXT NOT NULL,
    draft_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS mission_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id INTEGER NOT NULL UNIQUE,
    application_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'assigned',
    assigned_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (mission_id) REFERENCES missions(id),
    FOREIGN KEY (application_id) REFERENCES applications(id)
  );

  CREATE INDEX IF NOT EXISTS idx_mission_assignments_application
    ON mission_assignments(application_id);

  CREATE INDEX IF NOT EXISTS idx_mission_assignments_status
    ON mission_assignments(status);
`);
function makeLinkDropId() {
  let id;

  do {
    id = `LD-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  } while (
    db.prepare("SELECT 1 FROM users WHERE linkdrop_id = ?").get(id)
  );

  return id;
}

// Migration non destructive des candidatures historiques.
const legacyRows = db.prepare(`
  SELECT DISTINCT telegram_user_id
  FROM applications
  WHERE telegram_user_id IS NOT NULL
    AND telegram_user_id <> ''
`).all();

const migrateLegacy = db.transaction(() => {
  for (const row of legacyRows) {
    let account = db.prepare(`
      SELECT linkdrop_id
      FROM users
      WHERE telegram_user_id = ?
    `).get(row.telegram_user_id);

    if (!account) {
      const now = new Date().toISOString();
      const linkdropId = makeLinkDropId();

      db.prepare(`
        INSERT INTO users (
          linkdrop_id,
          telegram_user_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?)
      `).run(
        linkdropId,
        row.telegram_user_id,
        now,
        now
      );

      account = { linkdrop_id: linkdropId };
    }

    db.prepare(`
      UPDATE applications
      SET linkdrop_id = ?
      WHERE telegram_user_id = ?
        AND (linkdrop_id IS NULL OR linkdrop_id = '')
    `).run(
      account.linkdrop_id,
      row.telegram_user_id
    );
  }
});

migrateLegacy();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    cb(null, `${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 4 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(
        new Error("La photo doit Ãªtre au format JPG, PNG ou WEBP.")
      );
    }

    cb(null, true);
  }
});

function isAdmin(req, res, next) {
  if (req.session?.isAdmin === true) {
    return next();
  }

  return res.status(401).json({
    error: "Connexion administrateur requise."
  });
}

function isCandidate(req, res, next) {
  if (req.session?.userId) {
    return next();
  }

  return res.status(401).json({
    error: "Ouvre la Mini App depuis Telegram pour continuer."
  });
}

function isMissionSubmitter(req, res, next) {
  if (req.session?.missionSubmissionAuthorized === true) {
    return next();
  }

  return res.status(403).json({
    error: "Accès privé requis. Utilise ton lien d'invitation."
  });
}

function parseTelegramInitData(initData, botToken) {
  if (!initData || !botToken) {
    return null;
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");

    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
      return null;
    }

    params.delete("hash");

    const checkString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const calculated = crypto
      .createHmac("sha256", secret)
      .update(checkString)
      .digest("hex");

    const supplied = Buffer.from(hash, "hex");
    const actual = Buffer.from(calculated, "hex");

    if (
      supplied.length !== actual.length ||
      !crypto.timingSafeEqual(supplied, actual)
    ) { console.error("[Telegram Auth] Signature invalide");
      return null;
    }

    const authDate = Number(params.get("auth_date") || 0);
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;

    if (!authDate || ageSeconds < -60 || ageSeconds > 3600) { console.error("[Telegram Auth] Date invalide", { authDatePresent: Boolean(authDate), ageSeconds });
      return null;
    }

    const user = JSON.parse(params.get("user") || "null");

    if (!user || !user.id) { console.error("[Telegram Auth] Utilisateur absent ou invalide");
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/*
 * Ne renvoie pas les colonnes historiques de nom/prÃ©nom ni l'identifiant
 * Telegram dans les objets de candidature.
 *
 * Les colonnes restent en base pour prÃ©server la compatibilitÃ© avec
 * les donnÃ©es historiques, mais elles ne sont pas exposÃ©es par cette API.
 */
function serializeApplication(row) {
  const {
    first_name: _firstName,
    last_name: _lastName,
    telegram_user_id: _telegramUserId,
    ...safeRow
  } = row;

  return {
    ...safeRow,
    transports: parseJson(row.transports, []),
    availability: parseJson(row.availability, {}),
    delivery_types: parseJson(row.delivery_types, []),
    pickup_methods: parseJson(row.pickup_methods, []),
    handoff_methods: parseJson(row.handoff_methods, []),
    payment_preferences: parseJson(row.payment_preferences, []),
    draft: parseJson(row.draft_json, {})
  };
}

function validateApplication(b) {
  const required = [
    "birthDate",
    "city",
    "postalCode",
    "phone",
    "transports",
    "mainTransport",
    "availability",
    "deliveryTypes",
    "anonymity",
    "pickupMethods",
    "handoffMethods",
    "addressMode"
  ];

  for (const key of required) {
    const value = b[key];

    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return `Champ obligatoire manquant : ${key}`;
    }
  }

  if (
    !Array.isArray(b.transports) ||
    !b.transports.includes(b.mainTransport)
  ) {
    return "Le transport principal doit Ãªtre dans la liste sÃ©lectionnÃ©e.";
  }

  if (
    !Array.isArray(b.deliveryTypes) ||
    !Array.isArray(b.pickupMethods) ||
    !Array.isArray(b.handoffMethods)
  ) {
    return "Certains champs de sÃ©lection sont invalides.";
  }

  if (
    !b.availability ||
    typeof b.availability !== "object" ||
    Array.isArray(b.availability)
  ) {
    return "Les disponibilitÃ©s sont invalides.";
  }

  return null;
}

function applicationValues(b, telegramUserId) {
  return {
    createdAt: new Date().toISOString(),

    birthDate: String(b.birthDate).slice(0, 10),

    city: String(b.city)
      .trim()
      .slice(0, 100),

    postalCode: String(b.postalCode)
      .trim()
      .slice(0, 12),

    phone: String(b.phone)
      .trim()
      .slice(0, 30),

    telegramUserId: telegramUserId || null,

    transports: JSON.stringify(b.transports),

    mainTransport: String(b.mainTransport).slice(0, 80),

    vehicleAccess: String(b.vehicleAccess || "").slice(0, 100),

    vehicleCapacity: String(b.vehicleCapacity || "").slice(0, 250),

    vehiclePhoto: String(b.vehiclePhoto || "").slice(0, 300),

    availability: JSON.stringify(b.availability),

    deliveryTypes: JSON.stringify(b.deliveryTypes),

    zone: String(b.zone || "").slice(0, 250),

    maxDistance: Math.min(
      500,
      Math.max(1, Number(b.maxDistance) || 10)
    ),

    maxOrders: Math.min(
      100,
      Math.max(1, Number(b.maxOrders) || 1)
    ),

    anonymity: String(b.anonymity).slice(0, 40),

    pickupMethods: JSON.stringify(b.pickupMethods),

    handoffMethods: JSON.stringify(b.handoffMethods),

    addressMode: String(b.addressMode).slice(0, 50),

    paymentPreferences: JSON.stringify(
      Array.isArray(b.paymentPreferences)
        ? b.paymentPreferences
        : []
    ),

    notes: String(b.notes || "").slice(0, 1000)
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "LinkDrop V1"
  });
});

app.post("/api/auth/telegram", (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return res.status(503).json({
      error: "TELEGRAM_BOT_TOKEN n'est pas configurÃ© sur le serveur."
    });
  }

  const user = parseTelegramInitData(
    String(req.body?.initData || ""),
    botToken
  );

 if (!user) {
  console.error("[Telegram Auth] initData refusÃ©", {
    initDataPresent: Boolean(req.body?.initData),
    botTokenPresent: Boolean(botToken),
    reason: "signature, date ou donnÃ©es utilisateur invalides",
  });

  return res.status(401).json({
    error: "Authentification Telegram invalide ou expirÃ©e. Rouvre la Mini App."
  });
}

  const telegramId = String(user.id);
  const now = new Date().toISOString();

  let account = db.prepare(`
    SELECT *
    FROM users
    WHERE telegram_user_id = ?
  `).get(telegramId);

  if (!account) {
    const result = db.prepare(`
      INSERT INTO users (
        linkdrop_id,
        telegram_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?)
    `).run(
      makeLinkDropId(),
      telegramId,
      now,
      now
    );

    account = db.prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `).get(result.lastInsertRowid);
  } else {
    db.prepare(`
      UPDATE users
      SET updated_at = ?
      WHERE id = ?
    `).run(now, account.id);
  }

  req.session.regenerate(err => {
    if (err) {
      return res.status(500).json({
        error: "Impossible d'ouvrir la session."
      });
    }

    req.session.userId = account.id;
    req.session.linkdropId = account.linkdrop_id;

    req.session.save(saveErr => {
      if (saveErr) {
        return res.status(500).json({
          error: "Impossible d'enregistrer la session."
        });
      }

      const application = db.prepare(`
        SELECT id, status, updated_at, linkdrop_id
        FROM applications
        WHERE telegram_user_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(telegramId);

      res.json({
        ok: true,
        account: {
          linkdropId: account.linkdrop_id
        },
        application: application || null
      });
    });
  });
});

app.get("/api/me", isCandidate, (req, res) => {
  const account = db.prepare(`
    SELECT id, linkdrop_id, created_at
    FROM users
    WHERE id = ?
  `).get(req.session.userId);

  if (!account) {
    return res.status(401).json({
      error: "Compte introuvable. Rouvre la Mini App."
    });
  }

  const telegramId = db.prepare(`
    SELECT telegram_user_id
    FROM users
    WHERE id = ?
  `).get(req.session.userId)?.telegram_user_id;

  const application = db.prepare(`
    SELECT *
    FROM applications
    WHERE telegram_user_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(telegramId);

  const savedDraft = db.prepare(`
    SELECT draft_json, updated_at
    FROM application_drafts
    WHERE telegram_user_id = ?
  `).get(telegramId);

  res.json({
    account: {
      linkdropId: account.linkdrop_id,
      createdAt: account.created_at
    },

    application: application
      ? serializeApplication(application)
      : null,

    draft: savedDraft
      ? parseJson(savedDraft.draft_json, {})
      : (
          application
            ? parseJson(application.draft_json, {})
            : {}
        ),

    draftUpdatedAt:
      savedDraft?.updated_at ||
      application?.updated_at ||
      null
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({
        error: "Impossible de fermer la session."
      });
    }

    res.clearCookie("linkdrop_session");
    res.json({ ok: true });
  });
});

app.post(
  "/api/upload-vehicle-photo",
  (req, res, next) => {
    if (
      req.session?.userId ||
      req.session?.isAdmin ||
      (process.env.ALLOW_LOCAL_TEST === "true" && !isProduction)
    ) {
      return next();
    }

    return res.status(401).json({
      error: "Authentifie-toi depuis Telegram avant d'envoyer une photo."
    });
  },
  upload.single("photo"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: "Aucune photo reÃ§ue."
      });
    }

    res.json({
      photoPath: `/uploads/${req.file.filename}`
    });
  }
);

app.get("/uploads/:filename", (req, res) => {
  if (
    !(
      req.session?.userId ||
      req.session?.isAdmin ||
      (process.env.ALLOW_LOCAL_TEST === "true" && !isProduction)
    )
  ) {
    return res.status(401).send("Authentification requise.");
  }

  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(filePath);
});

app.post("/api/applications", (req, res) => {
  let telegramUserId = null;
  let linkdropId = null;

  if (req.session?.userId) {
    const account = db.prepare(`
      SELECT telegram_user_id, linkdrop_id
      FROM users
      WHERE id = ?
    `).get(req.session.userId);

    if (!account) {
      return res.status(401).json({
        error: "Compte candidat introuvable."
      });
    }

    telegramUserId = account.telegram_user_id;
    linkdropId = account.linkdrop_id;
  } else if (
    !(process.env.ALLOW_LOCAL_TEST === "true" && !isProduction)
  ) {
    return res.status(401).json({
      error: "Authentifie-toi depuis Telegram avant d'envoyer ta candidature."
    });
  }

  const b = req.body || {};
  const error = validateApplication(b);

  if (error) {
    return res.status(400).json({ error });
  }

  const values = applicationValues(b, telegramUserId);

  const existing = telegramUserId
    ? db.prepare(`
        SELECT id, status
        FROM applications
        WHERE telegram_user_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(telegramUserId)
    : null;

  if (existing) {
    db.prepare(`
      UPDATE applications
      SET updated_at = @createdAt,
          birth_date = @birthDate,
          city = @city,
          postal_code = @postalCode,
          phone = @phone,
          transports = @transports,
          main_transport = @mainTransport,
          vehicle_access = @vehicleAccess,
          vehicle_capacity = @vehicleCapacity,
          vehicle_photo = @vehiclePhoto,
          availability = @availability,
          delivery_types = @deliveryTypes,
          zone = @zone,
          max_distance = @maxDistance,
          max_orders = @maxOrders,
          anonymity = @anonymity,
          pickup_methods = @pickupMethods,
          handoff_methods = @handoffMethods,
          address_mode = @addressMode,
          payment_preferences = @paymentPreferences,
          notes = @notes,
          linkdrop_id = @linkdropId
      WHERE id = @id
    `).run({
      ...values,
      linkdropId,
      id: existing.id
    });

    if (telegramUserId) {
      db.prepare(`
        DELETE FROM application_drafts
        WHERE telegram_user_id = ?
      `).run(telegramUserId);
    }

    return res.status(200).json({
      ok: true,
      id: existing.id,
      linkdropId,
      status: existing.status,
      updated: true
    });
  }

  const result = db.prepare(`
    INSERT INTO applications (
      created_at,
      updated_at,
      linkdrop_id,
      birth_date,
      city,
      postal_code,
      phone,
      telegram_user_id,
      transports,
      main_transport,
      vehicle_access,
      vehicle_capacity,
      vehicle_photo,
      availability,
      delivery_types,
      zone,
      max_distance,
      max_orders,
      anonymity,
      pickup_methods,
      handoff_methods,
      address_mode,
      payment_preferences,
      notes
    ) VALUES (
      @createdAt,
      @createdAt,
      @linkdropId,
      @birthDate,
      @city,
      @postalCode,
      @phone,
      @telegramUserId,
      @transports,
      @mainTransport,
      @vehicleAccess,
      @vehicleCapacity,
      @vehiclePhoto,
      @availability,
      @deliveryTypes,
      @zone,
      @maxDistance,
      @maxOrders,
      @anonymity,
      @pickupMethods,
      @handoffMethods,
      @addressMode,
      @paymentPreferences,
      @notes
    )
  `).run({
    ...values,
    linkdropId
  });

  if (telegramUserId) {
    db.prepare(`
      DELETE FROM application_drafts
      WHERE telegram_user_id = ?
    `).run(telegramUserId);
  }

  res.status(201).json({
    ok: true,
    id: result.lastInsertRowid,
    linkdropId,
    status: "pending"
  });
});

app.put("/api/application/draft", isCandidate, (req, res) => {
  const account = db.prepare(`
    SELECT telegram_user_id, linkdrop_id
    FROM users
    WHERE id = ?
  `).get(req.session.userId);

  if (!account || !account.telegram_user_id) {
    return res.status(401).json({
      error: "Compte candidat introuvable."
    });
  }

  const draft = req.body?.draft;

  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return res.status(400).json({
      error: "Brouillon invalide."
    });
  }

  let json;

  try {
    json = JSON.stringify(draft);
  } catch {
    return res.status(400).json({
      error: "Impossible de lire le brouillon."
    });
  }

  if (Buffer.byteLength(json, "utf8") > 100_000) {
    return res.status(413).json({
      error: "Brouillon trop volumineux."
    });
  }

  const now = new Date().toISOString();

  const saveDraft = db.transaction(() => {
    db.prepare(`
      INSERT INTO application_drafts (
        telegram_user_id,
        linkdrop_id,
        draft_json,
        updated_at
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(telegram_user_id) DO UPDATE SET
        linkdrop_id = excluded.linkdrop_id,
        draft_json = excluded.draft_json,
        updated_at = excluded.updated_at
    `).run(
      account.telegram_user_id,
      account.linkdrop_id,
      json,
      now
    );

    const existing = db.prepare(`
      SELECT id
      FROM applications
      WHERE telegram_user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(account.telegram_user_id);

    if (existing) {
      db.prepare(`
        UPDATE applications
        SET draft_json = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        json,
        now,
        existing.id
      );
    }
  });

  saveDraft();

  res.json({
    ok: true,
    saved: true,
    updatedAt: now
  });
});

app.post("/api/admin/login", adminLoginLimiter, (req, res) => {
  const configured = process.env.ADMIN_PASSWORD;

  if (
    !configured ||
    configured === "change-moi-avec-un-mot-de-passe-long" ||
    configured.length < 12
  ) {
    return res.status(503).json({
      error: "Configure un ADMIN_PASSWORD robuste (12 caractÃ¨res minimum) dans .env."
    });
  }

  const supplied = String(req.body?.password || "");
  const a = Buffer.from(supplied);
  const b = Buffer.from(configured);

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    return res.status(401).json({
      error: "Mot de passe incorrect."
    });
  }

  req.session.regenerate(err => {
    if (err) {
      return res.status(500).json({
        error: "Impossible d'ouvrir la session administrateur."
      });
    }

    req.session.isAdmin = true;

    req.session.save(saveErr => {
      if (saveErr) {
        return res.status(500).json({
          error: "Impossible d'enregistrer la session."
        });
      }

      res.json({ ok: true });
    });
  });
});

// Générer un lien privé de transmission de mission
app.post("/api/admin/private-links", isAdmin, (req, res) => {
  const baseUrl = process.env.MINI_APP_URL;

  if (!baseUrl) {
    return res.status(500).json({
      error: "MINI_APP_URL n'est pas configurée dans le .env."
    });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  db.prepare(`
    UPDATE private_access_tokens
    SET revoked_at = ?
    WHERE purpose = 'mission_submission'
      AND used_at IS NULL
      AND revoked_at IS NULL
  `).run(now.toISOString());

  db.prepare(`
    INSERT INTO private_access_tokens
      (token_hash, purpose, created_at, expires_at)
    VALUES (?, 'mission_submission', ?, ?)
  `).run(tokenHash, now.toISOString(), expiresAt.toISOString());

  res.json({
    ok: true,
    link: `${baseUrl.replace(/\/$/, "")}/?mission_token=${token}`,
    expiresAt: expiresAt.toISOString()
  });
});


// Consommer le lien privé
app.post("/api/private-links/consume", (req, res) => {
  const token = String(req.body?.token || "");

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({
      error: "Lien invalide ou expiré."
    });
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const now = new Date().toISOString();

  const result = db.prepare(`
    UPDATE private_access_tokens
    SET used_at = ?
    WHERE token_hash = ?
      AND purpose = 'mission_submission'
      AND used_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > ?
  `).run(now, tokenHash, now);

  if (result.changes !== 1) {
    return res.status(403).json({
      error: "Lien invalide, expiré ou déjà utilisé."
    });
  }

  req.session.missionSubmissionAuthorized = true;

  req.session.save(err => {
    if (err) {
      return res.status(500).json({
        error: "Impossible d'ouvrir l'accès privé."
      });
    }

    res.json({ ok: true });
  });
});


// Envoyer une mission
app.post("/api/missions", isMissionSubmitter, (req, res) => {
  const city = String(req.body?.city || "").trim();
  const address = String(req.body?.address || "").trim();
  const scheduledAt = String(req.body?.scheduledAt || "").trim();
  const quantity = Number(req.body?.quantity);
  const instructions = String(req.body?.instructions || "").trim();

  if (
    !city ||
    !address ||
    !scheduledAt ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 100 ||
    city.length > 100 ||
    address.length > 300 ||
    instructions.length > 2000
  ) {
    return res.status(400).json({
      error: "Informations de mission invalides."
    });
  }

  if (!req.sessionID) {
    return res.status(500).json({
      error: "Session introuvable."
    });
  }

  const date = new Date(scheduledAt);

  if (Number.isNaN(date.getTime())) {
    return res.status(400).json({
      error: "Date de mission invalide."
    });
  }

  const now = new Date().toISOString();

  try {
    const createMission = db.transaction(() => {
      const existing = db.prepare(`
        SELECT session_id
        FROM mission_submission_sessions
        WHERE session_id = ?
      `).get(req.sessionID);

      if (existing) {
        return null;
      }

      const result = db.prepare(`
        INSERT INTO missions (
          city,
          address,
          scheduled_at,
          quantity,
          instructions,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(
        city,
        address,
        date.toISOString(),
        quantity,
        instructions,
        now,
        now
      );

      db.prepare(`
        INSERT INTO mission_submission_sessions (
          session_id,
          mission_id,
          created_at
        )
        VALUES (?, ?, ?)
      `).run(
        req.sessionID,
        result.lastInsertRowid,
        now
      );

      return result.lastInsertRowid;
    });

    const missionId = createMission();

    if (!missionId) {
      return res.status(409).json({
        error: "Une mission a déjà été envoyée avec ce lien."
      });
    }

    res.status(201).json({
      ok: true,
      missionId
    });
  } catch (error) {
    console.error("Erreur création mission :", error);

    res.status(500).json({
      error: "Impossible d'enregistrer la mission."
    });
  }
});

// ============================================
// ATTRIBUTION DES MISSIONS PAR L'ADMIN
// ============================================

app.post(
  "/api/admin/missions/:id/assign",
  isAdmin,
  (req, res) => {
    const missionId = Number(req.params.id);
    const applicationId = Number(req.body?.applicationId);

    if (
      !Number.isSafeInteger(missionId) ||
      missionId < 1 ||
      !Number.isSafeInteger(applicationId) ||
      applicationId < 1
    ) {
      return res.status(400).json({
        error: "Identifiants invalides."
      });
    }

    const mission = db.prepare(`
      SELECT id, status
      FROM missions
      WHERE id = ?
    `).get(missionId);

    if (!mission) {
      return res.status(404).json({
        error: "Mission introuvable."
      });
    }

    if (mission.status !== "approved") {
      return res.status(400).json({
        error: "La mission doit être approuvée avant son attribution."
      });
    }

    const application = db.prepare(`
      SELECT id, status, telegram_user_id
      FROM applications
      WHERE id = ?
    `).get(applicationId);

    if (!application) {
      return res.status(404).json({
        error: "Candidat introuvable."
      });
    }

    if (application.status !== "approved") {
      return res.status(400).json({
        error: "Tu ne peux attribuer une mission qu'à un candidat accepté."
      });
    }

    if (!application.telegram_user_id) {
      return res.status(400).json({
        error: "Ce candidat n'a pas de compte Telegram associé."
      });
    }

    const now = new Date().toISOString();

    try {
      db.prepare(`
        INSERT INTO mission_assignments (
          mission_id,
          application_id,
          status,
          assigned_at,
          updated_at
        )
        VALUES (?, ?, 'assigned', ?, ?)
        ON CONFLICT(mission_id) DO UPDATE SET
          application_id = excluded.application_id,
          status = 'assigned',
          assigned_at = excluded.assigned_at,
          updated_at = excluded.updated_at
      `).run(
        missionId,
        applicationId,
        now,
        now
      );

      return res.json({
        ok: true,
        missionId,
        applicationId,
        status: "assigned"
      });
    } catch (error) {
      console.error("Erreur attribution mission :", error);

      return res.status(500).json({
        error: "Impossible d'attribuer cette mission."
      });
    }
  }
);


// ============================================
// MISSIONS DU LIVREUR CONNECTÉ
// ============================================

app.get("/api/my/missions", isCandidate, (req, res) => {
  const account = db.prepare(`
    SELECT telegram_user_id
    FROM users
    WHERE id = ?
  `).get(req.session.userId);

  if (!account?.telegram_user_id) {
    return res.status(401).json({
      error: "Compte candidat introuvable."
    });
  }

  const application = db.prepare(`
    SELECT id, status
    FROM applications
    WHERE telegram_user_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(account.telegram_user_id);

  if (!application) {
    return res.json({
      applicationStatus: "none",
      missions: []
    });
  }

  if (application.status !== "approved") {
    return res.json({
      applicationStatus: application.status,
      missions: []
    });
  }

  const missions = db.prepare(`
    SELECT
      m.id,
      m.city,
      m.scheduled_at,
      m.quantity,
      m.instructions,
      m.status AS mission_status,
      ma.status AS assignment_status,
      ma.assigned_at,
      ma.updated_at AS assignment_updated_at
    FROM mission_assignments ma
    INNER JOIN missions m ON m.id = ma.mission_id
    WHERE ma.application_id = ?
    ORDER BY m.scheduled_at ASC
  `).all(application.id);

  res.json({
    applicationStatus: application.status,
    missions
  });
});


const ROUTING_PROFILES = {
  walking: "foot-walking",
  bicycle: "cycling-regular",
  electric_bicycle: "cycling-electric",
  car: "driving-car",
  utility: "driving-hgv"
};

app.post("/api/my/missions/:id/route", isCandidate, async (req, res) => {
  try {
    const missionId = Number(req.params.id);
    const { latitude, longitude, transport } = req.body || {};

    const isPublicTransport = transport === "public_transport";
    const orsKey = process.env.ORS_API_KEY;
    const idfmToken = process.env.IDFM_API_TOKEN;

    if (
      !Number.isSafeInteger(missionId) ||
      missionId < 1 ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      (!isPublicTransport &&
        !Object.hasOwn(ROUTING_PROFILES, transport))
    ) {
      return res.status(400).json({
        error: "Coordonnées ou transport invalides."
      });
    }

    if (isPublicTransport && !idfmToken) {
      return res.status(503).json({
        error: "Le calcul des transports en commun n'est pas configuré."
      });
    }

    if (!orsKey) {
      return res.status(503).json({
        error: "Le service de géolocalisation n'est pas configuré."
      });
    }

    const account = db.prepare(`
      SELECT telegram_user_id
      FROM users
      WHERE id = ?
    `).get(req.session.userId);

    const application = account?.telegram_user_id
      ? db.prepare(`
          SELECT id, status
          FROM applications
          WHERE telegram_user_id = ?
          ORDER BY id DESC
          LIMIT 1
        `).get(account.telegram_user_id)
      : null;

    if (!application || application.status !== "approved") {
      return res.status(403).json({
        error: "Candidature non approuvée."
      });
    }

    const mission = db.prepare(`
      SELECT m.address, m.city
      FROM missions m
      INNER JOIN mission_assignments ma
        ON ma.mission_id = m.id
      WHERE m.id = ?
        AND ma.application_id = ?
        AND ma.status IN ('assigned', 'accepted', 'in_progress')
    `).get(missionId, application.id);

    if (!mission) {
      return res.status(404).json({
        error: "Mission introuvable ou non accessible."
      });
    }

    // Géolocalisation de l'adresse : l'adresse reste côté serveur.
    const geocodeUrl = new URL(
      "https://api.heigit.org/pelias/v1/search"
    );

    geocodeUrl.searchParams.set(
      "text",
      `${mission.address}, ${mission.city}`
    );
    geocodeUrl.searchParams.set("size", "1");

    const geocodeResponse = await fetch(geocodeUrl, {
      headers: { Authorization: orsKey },
      signal: AbortSignal.timeout(12000)
    });

    if (!geocodeResponse.ok) {
      throw new Error("Échec de géolocalisation de la mission.");
    }

    const geocodeData = await geocodeResponse.json();
    const destination =
      geocodeData.features?.[0]?.geometry?.coordinates;

    if (
      !Array.isArray(destination) ||
      destination.length < 2 ||
      !destination.every(Number.isFinite)
    ) {
      return res.status(422).json({
        error: "Adresse de mission introuvable."
      });
    }

    // TRANSPORTS EN COMMUN : calcul via PRIM / Navitia.
    if (isPublicTransport) {
      const journeysUrl = new URL(
        "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/journeys"
      );

      journeysUrl.searchParams.set(
        "from",
        `${longitude};${latitude}`
      );
      journeysUrl.searchParams.set(
        "to",
        `${destination[0]};${destination[1]}`
      );
      journeysUrl.searchParams.set("count", "3");
      journeysUrl.searchParams.set("data_freshness", "realtime");

      const journeysResponse = await fetch(journeysUrl, {
        headers: { apiKey: idfmToken },
        signal: AbortSignal.timeout(20000)
      });

      if (!journeysResponse.ok) {
        console.error(
          "Erreur PRIM :",
          journeysResponse.status
        );

        return res.status(502).json({
          error: "PRIM n'a pas pu calculer le trajet."
        });
      }

      const journeysData = await journeysResponse.json();

      const journeys = (journeysData.journeys || [])
        .filter((journey) =>
          Number.isFinite(Number(journey.duration)) &&
          Number(journey.duration) > 0
        )
        .sort((a, b) => Number(a.duration) - Number(b.duration));

      const journey = journeys[0];

      if (!journey) {
        return res.status(422).json({
          error: "Aucun trajet en transports en commun trouvé."
        });
      }

      const distanceMeters = (journey.sections || [])
        .reduce((total, section) => {
          const distance = Number(section.geojson?.distance);
          return total + (
            Number.isFinite(distance) ? distance : 0
          );
        }, 0);

      return res.json({
        durationMinutes: Math.max(
          1,
          Math.ceil(Number(journey.duration) / 60)
        ),
        distanceKm: distanceMeters > 0
          ? Math.round(distanceMeters / 100) / 10
          : null,
        transport: "public_transport"
      });
    }

    // AUTRES TRANSPORTS : OpenRouteService.
    const profile = ROUTING_PROFILES[transport];

    const routeResponse = await fetch(
      `https://api.heigit.org/openrouteservice/v2/directions/${profile}`,
      {
        method: "POST",
        headers: {
          Authorization: orsKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          coordinates: [
            [longitude, latitude],
            destination
          ],
          instructions: false
        }),
        signal: AbortSignal.timeout(20000)
      }
    );

    if (!routeResponse.ok) {
      throw new Error("Calcul d'itinéraire indisponible.");
    }

    const routeData = await routeResponse.json();
    const summary = routeData.routes?.[0]?.summary;

    if (!summary || !Number.isFinite(summary.duration)) {
      throw new Error("Durée du trajet indisponible.");
    }

    return res.json({
      durationMinutes: Math.max(
        1,
        Math.ceil(summary.duration / 60)
      ),
      distanceKm: Number.isFinite(summary.distance)
        ? Math.round(summary.distance / 100) / 10
        : null,
      transport
    });
  } catch (error) {
    console.error("Erreur itinéraire :", error.message);

    return res.status(502).json({
      error: "Impossible de calculer le trajet pour le moment."
    });
  }
});

// ============================================
// LE LIVREUR MET À JOUR SA MISSION
// ============================================

app.patch(
  "/api/my/missions/:id/status",
  isCandidate,
  (req, res) => {
    const missionId = Number(req.params.id);
    const newStatus = String(req.body?.status || "");

    if (!Number.isSafeInteger(missionId) || missionId < 1) {
      return res.status(400).json({
        error: "Identifiant de mission invalide."
      });
    }

    const allowedStatuses = [
      "accepted",
      "refused",
      "in_progress",
      "completed"
    ];

    if (!allowedStatuses.includes(newStatus)) {
      return res.status(400).json({
        error: "Statut de mission invalide."
      });
    }

    const account = db.prepare(`
      SELECT telegram_user_id
      FROM users
      WHERE id = ?
    `).get(req.session.userId);

    if (!account?.telegram_user_id) {
      return res.status(401).json({
        error: "Compte candidat introuvable."
      });
    }

    const application = db.prepare(`
      SELECT id, status
      FROM applications
      WHERE telegram_user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(account.telegram_user_id);

    if (!application || application.status !== "approved") {
      return res.status(403).json({
        error: "Ta candidature ne permet pas d'accéder aux missions."
      });
    }

    const assignment = db.prepare(`
      SELECT id, status
      FROM mission_assignments
      WHERE mission_id = ?
        AND application_id = ?
    `).get(missionId, application.id);

    if (!assignment) {
      return res.status(404).json({
        error: "Cette mission ne t'est pas attribuée."
      });
    }

    const transitions = {
      assigned: ["accepted", "refused"],
      accepted: ["in_progress"],
      in_progress: ["completed"],
      refused: [],
      completed: []
    };

    if (!transitions[assignment.status]?.includes(newStatus)) {
      return res.status(400).json({
        error: "Cette modification de statut n'est pas autorisée."
      });
    }

    db.prepare(`
      UPDATE mission_assignments
      SET status = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      newStatus,
      new Date().toISOString(),
      assignment.id
    );

    res.json({
      ok: true,
      missionId,
      status: newStatus
    });
  }
);
app.post("/api/admin/logout", isAdmin, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({
        error: "Impossible de fermer la session administrateur."
      });
    }

    res.clearCookie("linkdrop_session");
    res.json({ ok: true });
  });
});

app.get("/api/admin/session", (req, res) => {
  res.json({
    authenticated: Boolean(req.session?.isAdmin)
  });
});

app.get("/api/admin/applications", isAdmin, (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  const status = String(req.query.status || "").trim();
  const city = String(req.query.city || "").trim().slice(0, 100);

  const clauses = [];
  const params = [];

  if (["pending", "approved", "rejected"].includes(status)) {
    clauses.push("status = ?");
    params.push(status);
  }

  if (city) {
    clauses.push("city LIKE ?");
    params.push(`%${city}%`);
  }

  if (q) {
    clauses.push(`
      (
        city LIKE ?
        OR linkdrop_id LIKE ?
        OR CAST(id AS TEXT) = ?
      )
    `);

    params.push(
      `%${q}%`,
      `%${q}%`,
      q
    );
  }

  const where = clauses.length
    ? `WHERE ${clauses.join(" AND ")}`
    : "";

  const rows = db.prepare(`
    SELECT *
    FROM applications
    ${where}
    ORDER BY id DESC
    LIMIT 1000
  `).all(...params);

  res.json(rows.map(serializeApplication));
});
// Récupérer les missions
app.get("/api/admin/missions", isAdmin, (req, res) => {
  const status = String(req.query.status || "").trim();

  const allowedStatuses = ["pending", "approved", "rejected"];

  let rows;

  if (allowedStatuses.includes(status)) {
    rows = db.prepare(`
      SELECT *
      FROM missions
      WHERE status = ?
      ORDER BY id DESC
      LIMIT 1000
    `).all(status);
  } else {
    rows = db.prepare(`
      SELECT *
      FROM missions
      ORDER BY id DESC
      LIMIT 1000
    `).all();
  }

  res.json(rows);
});


// Modifier le statut d'une mission
app.patch("/api/admin/missions/:id/status", isAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || "");

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      error: "Identifiant de mission invalide."
    });
  }

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({
      error: "Statut invalide."
    });
  }

  const now = new Date().toISOString();

  const result = db.prepare(`
    UPDATE missions
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(status, now, id);

  if (result.changes !== 1) {
    return res.status(404).json({
      error: "Mission introuvable."
    });
  }

  res.json({
    ok: true,
    missionId: id,
    status
  });
});

app.get("/api/admin/stats", isAdmin, (_req, res) => {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
    FROM applications
  `).get();

  const cities = db.prepare(`
    SELECT city, COUNT(*) AS total
    FROM applications
    GROUP BY city
    ORDER BY total DESC
    LIMIT 20
  `).all();

  res.json({
    ...totals,
    cities
  });
});

app.get("/api/admin/applications.csv", isAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT
      id,
      linkdrop_id,
      created_at,
      updated_at,
      status,
      birth_date,
      city,
      postal_code,
      phone,
      transports,
      main_transport
    FROM applications
    ORDER BY id DESC
  `).all();

  const quote = value => {
    let text = String(value ?? "");

    // EmpÃªche l'exÃ©cution de formules lors de l'ouverture du CSV.
    if (/^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
  };

  const csv = [
    [
      "id",
      "linkdrop_id",
      "created_at",
      "updated_at",
      "status",
      "birth_date",
      "city",
      "postal_code",
      "phone",
      "transports",
      "main_transport"
    ].join(","),

    ...rows.map(row => [
      row.id,
      row.linkdrop_id,
      row.created_at,
      row.updated_at,
      row.status,
      row.birth_date,
      row.city,
      row.postal_code,
      parseJson(row.transports, []).join("; "),
      row.main_transport
    ].map(quote).join(","))
  ].join("\r\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="linkdrop-candidatures.csv"'
  );

  res.send("\uFEFF" + csv);
});

app.patch("/api/admin/applications/:id", isAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      error: "Identifiant invalide."
    });
  }

  const status = String(req.body?.status || "");

  if (!["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({
      error: "Statut invalide."
    });
  }

  const result = db.prepare(`
    UPDATE applications
    SET status = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    status,
    new Date().toISOString(),
    id
  );

  if (!result.changes) {
    return res.status(404).json({
      error: "Candidature introuvable."
    });
  }

  res.json({ ok: true });
});

app.patch("/api/admin/applications/:id/notes", isAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      error: "Identifiant invalide."
    });
  }

  const notes = String(req.body?.notes || "").slice(0, 3000);

  const result = db.prepare(`
    UPDATE applications
    SET internal_notes = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    notes,
    new Date().toISOString(),
    id
  );

  if (!result.changes) {
    return res.status(404).json({
      error: "Candidature introuvable."
    });
  }

  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "..", "dist")));

app.get("*", (req, res, next) => {
  if (
    req.path.startsWith("/api/") ||
    req.path.startsWith("/uploads/")
  ) {
    return next();
  }

  const indexFile = path.join(__dirname, "..", "dist", "index.html");

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  res.status(404).send(
    "Frontend non compilÃ©. En dÃ©veloppement, ouvre http://localhost:5173."
  );
});

app.use((err, _req, res, _next) => {
  console.error("LinkDrop error:", err.message);

  res.status(
    err instanceof multer.MulterError ? 400 : 500
  ).json({
    error: err.message || "Erreur serveur."
  });
});
startTelegramBot();
app.listen(PORT, () => {
  console.log(`LinkDrop API disponible sur http://localhost:${PORT}`);
});
