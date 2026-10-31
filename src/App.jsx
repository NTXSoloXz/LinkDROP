import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";

const API = "/api";

const STEPS = [
  { id: "home", number: "00", label: "Accueil" },
  { id: "identity", number: "01", label: "Inscription" },
  { id: "activity", number: "02", label: "Activité" },
  { id: "preferences", number: "03", label: "Préférences" },
];

const TRANSPORTS = [
  "À pied",
  "Vélo",
  "Vélo électrique",
  "Trottinette électrique",
  "Moto",
  "Scooter",
  "Voiture",
  "Utilitaire / camionnette",
];

const PRODUCTS = [
  "Colis classiques",
  "Produits fragiles",
  "Produits de valeur",
  "Autres produits autorisés",
];

const DAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

const PICKUP_METHODS = [
  "Adresse convenue",
  "Point de rendez-vous",
  "Selon la commande",
  "Autre procédé",
];

const HANDOFF_METHODS = [
  "Remise en main propre",
  "Dépôt à une adresse",
  "Point de retrait autorisé",
  "Selon la commande",
];

const PAYMENT_METHODS = [
  "Espèces",
  "Virement",
  "Carte bancaire",
  "Crypto",
  "Cartes cadeaux",
  "Autre",
];

const EMPTY_FORM = {
  birthDate: "",
  city: "",
  postalCode: "",
  phone: "",
  transports: [],
  mainTransport: "",
  vehicleAccess: "",
  vehicleCapacity: "",
  vehiclePhoto: "",
  availability: {
    days: [],
    start: "09:00",
    end: "18:00",
    mode: ["Immédiates", "Programmées"],
    notes: "",
  },
  deliveryTypes: [],
  zone: "",
  maxDistance: 10,
  maxOrders: 1,
  anonymity: "yes",
  pickupMethods: ["Adresse convenue", "Point de rendez-vous"],
  handoffMethods: ["Remise en main propre", "Dépôt à une adresse"],
  addressMode: "validation",
  paymentPreferences: [],
  notes: "",
};

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data?.error
        ? data.error
        : "Une erreur est survenue. Réessaie."
    );
  }

  return data;
}

function normalizeForm(source) {
  if (!source || typeof source !== "object") return { ...EMPTY_FORM };

  const availability = source.availability || {};

  return {
    ...EMPTY_FORM,
    ...source,
    transports: Array.isArray(source.transports) ? source.transports : [],
    deliveryTypes: Array.isArray(source.deliveryTypes)
      ? source.deliveryTypes
      : [],
    pickupMethods: Array.isArray(source.pickupMethods)
      ? source.pickupMethods
      : [...EMPTY_FORM.pickupMethods],
    handoffMethods: Array.isArray(source.handoffMethods)
      ? source.handoffMethods
      : [...EMPTY_FORM.handoffMethods],
    paymentPreferences: Array.isArray(source.paymentPreferences)
      ? source.paymentPreferences
      : [],
    availability: {
      ...EMPTY_FORM.availability,
      ...availability,
      days: Array.isArray(availability.days) ? availability.days : [],
      mode: Array.isArray(availability.mode)
        ? availability.mode
        : [...EMPTY_FORM.availability.mode],
    },
  };
}

function fromApplication(application) {
  if (!application) return null;

  return normalizeForm({
    birthDate: application.birth_date,
    city: application.city,
    postalCode: application.postal_code,
    phone: application.phone,
    transports: application.transports,
    mainTransport: application.main_transport,
    vehicleAccess: application.vehicle_access,
    vehicleCapacity: application.vehicle_capacity,
    vehiclePhoto: application.vehicle_photo,
    availability: application.availability,
    deliveryTypes: application.delivery_types,
    zone: application.zone,
    maxDistance: application.max_distance,
    maxOrders: application.max_orders,
    anonymity: application.anonymity,
    pickupMethods: application.pickup_methods,
    handoffMethods: application.handoff_methods,
    addressMode: application.address_mode,
    paymentPreferences: application.payment_preferences,
    notes: application.notes,
  });
}

function Icon({ name, size = 20 }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-7h6v7" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    activity: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 15h2l2-5 3 7 2-4h1" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" /></>,
    arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    package: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 8v9l9 5 9-5V8" /><path d="M12 13v9" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.package}
    </svg>
  );
}

function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

function ChoiceGrid({ items, values = [], onToggle }) {
  return (
    <div className="choice-grid">
      {items.map((item) => {
        const selected = values.includes(item);

        return (
          <button
            type="button"
            key={item}
            className={`choice ${selected ? "is-selected" : ""}`}
            onClick={() => onToggle(item)}
            aria-pressed={selected}
          >
            <span className="choice-check">
              {selected && <Icon name="check" size={14} />}
            </span>
            <span>{item}</span>
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }) {
  const labels = {
    pending: "En attente",
    approved: "Acceptée",
    rejected: "Refusée",
  };

  return (
    <span className={`status-badge status-${status || "pending"}`}>
      <span />
      {labels[status] || "En attente"}
    </span>
  );
}

function Notice({ notice, onClose }) {
  if (!notice) return null;

  return (
    <div className={`notice notice-${notice.type || "info"}`} role="status">
      <span className="notice-mark">
        {notice.type === "success" ? <Icon name="check" /> : "!"}
      </span>
      <p>{notice.text}</p>
      <button type="button" onClick={onClose} aria-label="Fermer">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
export default function App() {
  const telegram = useMemo(() => window.Telegram?.WebApp, []);

  const [page, setPage] = useState(() => {
    const requestedPage = new URLSearchParams(window.location.search).get("page");

    const allowedPages = ["home", "missions", "application", "account"];

    return allowedPages.includes(requestedPage) ? requestedPage : "home";
  });

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [account, setAccount] = useState(null);
  const [application, setApplication] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [missionToken, setMissionToken] = useState(
    new URLSearchParams(window.location.search).get("mission_token") || ""
  );
  const [missionAccess, setMissionAccess] = useState(false);
  const [missionBusy, setMissionBusy] = useState(false);
  const [missionForm, setMissionForm] = useState({
    city: "",
    address: "",
    scheduledAt: "",
    quantity: 1,
    instructions: "",
  });

  // MES MISSIONS
  const [missions, setMissions] = useState([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [missionTransports, setMissionTransports] = useState({});
  const [missionRoutes, setMissionRoutes] = useState({});
  const [missionRouteLoading, setMissionRouteLoading] = useState({});

  const [adminMode, setAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [adminSearch, setAdminSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [internalNotes, setInternalNotes] = useState({});

  const restoredRef = useRef(false);
  const saveTimer = useRef(null);
  const formRef = useRef(form);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const notify = useCallback((text, type = "info") => {
    setNotice({ text, type });
  }, []);

const [userPosition, setUserPosition] = useState(null);
const [locationLoading, setLocationLoading] = useState(false);

const loadMissions = useCallback(async () => {
  setMissionsLoading(true);

  try {
    const data = await api("/my/missions");
    setMissions(data.missions || []);
  } catch (error) {
    notify(error.message || "Impossible de charger tes missions.", "error");
  } finally {
    setMissionsLoading(false);
  }
}, [notify]);

const updateMissionStatus = async (missionId, status) => {
  try {
    await api(`/my/missions/${missionId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });

    await loadMissions();
    notify("Statut de la mission mis à jour.", "success");
  } catch (error) {
    notify(error.message || "Impossible de modifier la mission.", "error");
  }
};

const requestUserPosition = () => {
  if (!navigator.geolocation) {
    notify("La géolocalisation n'est pas disponible.", "error");
    return;
  }

  setLocationLoading(true);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      setUserPosition({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationLoading(false);
    },
    () => {
      setLocationLoading(false);
      notify("Autorise la géolocalisation pour calculer tes trajets.", "error");
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
};

const calculateMissionRoute = async (missionId) => {
  if (!userPosition) {
    requestUserPosition();
    return;
  }

  const transport = missionTransports[missionId] || "walking";

  setMissionRouteLoading((current) => ({
    ...current,
    [missionId]: true,
  }));

  try {
    const route = await api(`/my/missions/${missionId}/route`, {
      method: "POST",
      body: JSON.stringify({
        ...userPosition,
        transport,
      }),
    });

    setMissionRoutes((current) => ({
      ...current,
      [missionId]: route,
    }));
  } catch (error) {
    notify(error.message || "Impossible de calculer le trajet.", "error");
  } finally {
    setMissionRouteLoading((current) => ({
      ...current,
      [missionId]: false,
    }));
  }
};

  const openMissionAccess = async () => {
  if (!missionToken || missionBusy) return;

  setMissionBusy(true);

  try {
    await api("/private-links/consume", {
      method: "POST",
      body: JSON.stringify({ token: missionToken }),
    });

    setMissionAccess(true);
    setMissionToken("");
    window.history.replaceState({}, "", window.location.pathname);
    notify("Accès privé autorisé.", "success");
  } catch (error) {
    notify(error.message || "Ce lien n'est plus valide.", "error");
  } finally {
    setMissionBusy(false);
  }
};
  const updateField = useCallback((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const toggleArray = useCallback((key, value) => {
    setForm((current) => {
      const values = Array.isArray(current[key]) ? current[key] : [];

      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  }, []);

  const updateAvailability = useCallback((key, value) => {
    setForm((current) => ({
      ...current,
      availability: {
        ...current.availability,
        [key]: value,
      },
    }));
  }, []);

  const toggleAvailability = useCallback((key, value) => {
    setForm((current) => {
      const values = current.availability[key] || [];

      return {
        ...current,
        availability: {
          ...current.availability,
          [key]: values.includes(value)
            ? values.filter((item) => item !== value)
            : [...values, value],
        },
      };
    });
  }, []);

const go = useCallback((nextPage) => {
  setPage(nextPage);

  const url = new URL(window.location.href);
  url.searchParams.set("page", nextPage);
  window.history.replaceState({}, "", url);

  setMenuOpen(false);
  setNotice(null);
  window.scrollTo({ top: 0, behavior: "smooth" });
}, []);

  useEffect(() => {
    telegram?.ready?.();
    telegram?.expand?.();

    if (telegram?.themeParams) {
      const theme = telegram.themeParams;
      if (theme.bg_color) {
        document.documentElement.style.setProperty("--tg-bg", theme.bg_color);
      }
      if (theme.text_color) {
        document.documentElement.style.setProperty("--tg-text", theme.text_color);
      }
    }

    let cancelled = false;

    async function bootstrap() {
      try {
        const initData = telegram?.initData || "";

        if (!initData) {
          setAuthLoading(false);
          return;
        }

        await api("/auth/telegram", {
          method: "POST",
          body: JSON.stringify({ initData }),
        });

        const me = await api("/me");

        if (cancelled) return;

        setAccount(me.account || null);
        setApplication(me.application || null);

        const restoredApplication = fromApplication(me.application);
        const restoredDraft = normalizeForm(me.draft || {});

        setForm(restoredApplication || restoredDraft);
        setDraftSavedAt(me.draftUpdatedAt || null);
        setAuthenticated(true);
        restoredRef.current = true;
      } catch (error) {
        if (!cancelled) {
          notify(error.message || "Connexion Telegram impossible.", "error");
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [telegram, notify]);

  useEffect(() => {
    if (!authenticated || !restoredRef.current || draftLoading) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      try {
        await api("/application/draft", {
          method: "PUT",
          body: JSON.stringify({ draft: formRef.current }),
        });

        setDraftSavedAt(new Date().toISOString());
      } catch (error) {
        if (error.message && !error.message.includes("Ouvre la Mini App")) {
          console.warn("Brouillon non sauvegardé :", error.message);
        }
      }
    }, 900);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, authenticated, draftLoading]);
      useEffect(() => {
   if (authenticated && page === "missions") {
      sloadMissions();
  }
}, [authenticated, page, loadMissions]);
  const progress = useMemo(() => {
    let completed = 0;

    if (form.birthDate && form.city && form.postalCode && form.phone) {
      completed += 1;
    }

    if (
      form.transports.length &&
      form.mainTransport &&
      form.availability.days.length &&
      form.deliveryTypes.length
    ) {
      completed += 1;
    }

    if (
      form.anonymity &&
      form.pickupMethods.length &&
      form.handoffMethods.length &&
      form.addressMode
    ) {
      completed += 1;
    }

    return completed;
  }, [form]);

  const currentStep = STEPS.findIndex((step) => step.id === page);
  const displayStep = Math.max(0, currentStep - 1);
  const percent = Math.round((progress / 3) * 100);

  async function uploadPhoto(file) {
    if (!file) return;

    if (!authenticated) {
      notify("Ouvre LinkDrop depuis Telegram avant d'ajouter une photo.", "error");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      notify("Choisis une image JPG, PNG ou WEBP.", "error");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      notify("La photo ne doit pas dépasser 4 Mo.", "error");
      return;
    }

    setUploading(true);

    try {
      const data = new FormData();
      data.append("photo", file);

      const result = await api("/upload-vehicle-photo", {
        method: "POST",
        body: data,
      });

      updateField("vehiclePhoto", result.photoPath);
      notify("Photo ajoutée au profil.", "success");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setUploading(false);
    }
  }

  function validateBeforeSubmit() {
    if (
      !form.birthDate ||
      !form.city.trim() ||
      !form.postalCode.trim() ||
      !form.phone.trim()
    ) {
      go("identity");
      notify("Complète les informations obligatoires.", "error");
      return false;
    }

    if (!form.transports.length || !form.mainTransport) {
      go("activity");
      notify("Choisis tes moyens de transport et ton transport principal.", "error");
      return false;
    }

    if (!form.availability.days.length) {
      go("activity");
      notify("Sélectionne au moins un jour de disponibilité.", "error");
      return false;
    }

    if (!form.deliveryTypes.length) {
      go("activity");
      notify("Choisis au moins un type de colis accepté.", "error");
      return false;
    }

    if (!form.pickupMethods.length || !form.handoffMethods.length) {
      go("preferences");
      notify("Choisis au moins une modalité de remise.", "error");
      return false;
    }

    if (form.availability.start >= form.availability.end) {
      go("activity");
      notify("L'heure de fin doit être après l'heure de début.", "error");
      return false;
    }

    return true;
  }

  async function submitApplication() {
    if (!authenticated) {
      notify("Ouvre la Mini App depuis Telegram pour envoyer ta candidature.", "error");
      return;
    }

    if (!validateBeforeSubmit()) return;

    setBusy(true);
    setNotice(null);

    try {
      const result = await api("/applications", {
        method: "POST",
        body: JSON.stringify(form),
      });

      const refreshed = await api("/me");

      setAccount(refreshed.account || account);
      setApplication(refreshed.application || {
        id: result.id,
        status: result.status || "pending",
        linkdrop_id: result.linkdropId || account?.linkdropId,
      });

      setForm(fromApplication(refreshed.application) || form);
      setDraftSavedAt(refreshed.draftUpdatedAt || new Date().toISOString());
      go("home");

      notify(
        result.updated
          ? `Ton dossier a été mis à jour. Identifiant : ${result.linkdropId || account?.linkdropId || "LinkDrop"}.`
          : `Candidature envoyée. Identifiant : ${result.linkdropId || account?.linkdropId || "LinkDrop"}.`,
        "success"
      );
    } catch (error) {
      notify(error.message || "L'envoi de la candidature a échoué.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function loadAdminData() {
    setAdminBusy(true);

    try {
      const params = new URLSearchParams();

      if (filter !== "all") params.set("status", filter);
      if (adminSearch.trim()) params.set("q", adminSearch.trim());

      const [rows, summary] = await Promise.all([
        api(`/admin/applications?${params.toString()}`),
        api("/admin/stats"),
      ]);

      setApplications(Array.isArray(rows) ? rows : []);
      setStats(summary);
    } catch (error) {
      notify(error.message || "Impossible de charger les candidatures.", "error");

      if (error.message?.includes("Connexion administrateur")) {
        setAdminAuthed(false);
      }
    } finally {
      setAdminBusy(false);
    }
  }

  async function loginAdmin(event) {
    event.preventDefault();
    setAdminBusy(true);

    try {
      await api("/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: adminPassword }),
      });

      setAdminAuthed(true);
      setAdminPassword("");
      notify("Connexion administrateur réussie.", "success");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setAdminBusy(false);
    }
  }

  useEffect(() => {
    if (adminMode && adminAuthed) loadAdminData();
    // Rechargement lorsque le filtre change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminMode, adminAuthed, filter]);

  async function updateStatus(id, status) {
    try {
      await api(`/admin/applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      notify(
        status === "approved"
          ? "Candidature acceptée."
          : status === "rejected"
            ? "Candidature refusée."
            : "Statut remis en attente.",
        "success"
      );

      await loadAdminData();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function saveInternalNotes(id) {
    try {
      await api(`/admin/applications/${id}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ notes: internalNotes[id] || "" }),
      });

      notify("Note interne enregistrée.", "success");
      await loadAdminData();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function logoutAdmin() {
    try {
      await api("/admin/logout", { method: "POST" });
    } catch {
      // L'interface revient à l'écran de connexion même si la session a expiré.
    }

    setAdminAuthed(false);
    setAdminMode(false);
    setApplications([]);
    setStats(null);
    setNotice(null);
  }

  async function exportCsv() {
    try {
      const response = await fetch(`${API}/admin/applications.csv`, {
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Export impossible.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = "linkdrop-candidatures.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify(error.message, "error");
    }
  }

  const visibleApplications = applications.filter((item) => {
    if (filter !== "all" && item.status !== filter) return false;
    return true;
  });

  function renderAdmin() {
    if (!adminAuthed) {
      return (
        <section className="admin-login panel">
          <div className="admin-login-icon"><Icon name="shield" size={28} /></div>
          <p className="eyebrow">ZONE SÉCURISÉE</p>
          <h1>Administration<span>.</span></h1>
          <p className="muted-text">
            Connecte-toi pour gérer les dossiers LinkDrop.
          </p>

          <form className="stack-form" onSubmit={loginAdmin}>
            <Field label="Mot de passe administrateur">
              <input
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="Ton mot de passe"
                autoComplete="current-password"
                required
              />
            </Field>
            <button className="button button-primary button-full" disabled={adminBusy}>
              {adminBusy ? "Connexion…" : "Accéder à l'administration"}
              <Icon name="arrow" size={17} />
            </button>
          </form>
        </section>
      );
    }

    return (
      <div className="admin-layout">
        <section className="admin-heading">
          <div>
            <p className="eyebrow">ESPACE PRIVÉ</p>
            <h1>Les candidatures<span>.</span></h1>
            <p className="muted-text">Gère les dossiers depuis un seul endroit.</p>
          </div>
          <button className="button button-ghost" onClick={logoutAdmin}>
            <Icon name="logout" size={16} />
            Déconnexion
          </button>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total</span>
            <strong>{stats?.total ?? "—"}</strong>
            <small>Tous les dossiers</small>
          </div>
          <div className="stat-card stat-pending">
            <span>En attente</span>
            <strong>{stats?.pending ?? "—"}</strong>
            <small>À examiner</small>
          </div>
          <div className="stat-card stat-approved">
            <span>Acceptées</span>
            <strong>{stats?.approved ?? "—"}</strong>
            <small>Dossiers validés</small>
          </div>
          <div className="stat-card stat-rejected">
            <span>Refusées</span>
            <strong>{stats?.rejected ?? "—"}</strong>
            <small>Dossiers refusés</small>
          </div>
        </section>

        <section className="admin-panel panel">
          <div className="admin-tools">
            <div className="search-box">
              <Icon name="search" size={18} />
              <input
                value={adminSearch}
                onChange={(event) => setAdminSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadAdminData();
                }}
                placeholder="Rechercher par ville ou ID…"
              />
              <button type="button" onClick={loadAdminData}>Chercher</button>
            </div>

            <div className="admin-actions">
              <button className="button button-ghost" onClick={loadAdminData} disabled={adminBusy}>
                {adminBusy ? "Actualisation…" : "Actualiser"}
              </button>
              <button className="button button-primary" onClick={exportCsv}>
                Export CSV
              </button>
            </div>
          </div>

          <div className="filter-tabs">
            {[
              ["pending", "En attente"],
              ["approved", "Acceptées"],
              ["rejected", "Refusées"],
              ["all", "Toutes"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {visibleApplications.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Icon name="package" size={28} /></span>
              <h3>Aucun dossier ici</h3>
              <p>Les candidatures correspondant à ce filtre apparaîtront ici.</p>
            </div>
          ) : (
            <div className="application-list">
              {visibleApplications.map((item) => (
                <article className="admin-application" key={item.id}>
                  <div className="admin-application-top">
                    <div>
                      <span className="application-number">DOSSIER #{item.id}</span>
                      <h3>{item.linkdrop_id || `LD-${item.id}`}</h3>
                      <p>{item.city} {item.postal_code ? `· ${item.postal_code}` : ""}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>

                  <div className="application-tags">
                    {(item.transports || []).map((transport) => (
                      <span key={transport}>{transport}</span>
                    ))}
                  </div>

                  <div className="application-meta">
                    <div><span>Téléphone</span><strong>{item.phone || "Non renseigné"}</strong></div>
                    <div><span>Disponibilités</span><strong>{(item.availability?.days || []).join(", ") || "Non renseignées"}</strong></div>
                    <div><span>Distance max.</span><strong>{item.max_distance || 10} km</strong></div>
                  </div>

                  <button
                    className="details-toggle"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    {expandedId === item.id ? "Masquer les détails" : "Voir les détails"}
                    <span>{expandedId === item.id ? "−" : "+"}</span>
                  </button>

                  {expandedId === item.id && (
                    <div className="application-details">
                      <div className="detail-grid">
                        <div><span>Transport principal</span><strong>{item.main_transport || "—"}</strong></div>
                        <div><span>Accès au véhicule</span><strong>{item.vehicle_access || "—"}</strong></div>
                        <div><span>Capacité</span><strong>{item.vehicle_capacity || "—"}</strong></div>
                        <div><span>Zone</span><strong>{item.zone || "—"}</strong></div>
                        <div><span>Nombre de commandes</span><strong>{item.max_orders || 1}</strong></div>
                        <div><span>Naissance</span><strong>{item.birth_date || "—"}</strong></div>
                        <div><span>Créée le</span><strong>{item.created_at ? new Date(item.created_at).toLocaleDateString("fr-FR") : "—"}</strong></div>
                        <div><span>Remise</span><strong>{item.handoff_methods?.join(", ") || "—"}</strong></div>
                      </div>

                      {item.vehicle_photo && (
                        <a
                          className="button button-ghost photo-link"
                          href={item.vehicle_photo}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Voir la photo du véhicule
                        </a>
                      )}

                      {item.notes && (
                        <div className="candidate-notes">
                          <span>Précisions du candidat</span>
                          <p>{item.notes}</p>
                        </div>
                      )}

                      <Field label="Note interne (visible uniquement ici)">
                        <textarea
                          rows="3"
                          value={internalNotes[item.id] ?? item.internal_notes ?? ""}
                          onChange={(event) =>
                            setInternalNotes((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder="Ajouter une note sur ce dossier…"
                        />
                      </Field>

                      <button
                        className="button button-ghost"
                        onClick={() => saveInternalNotes(item.id)}
                      >
                        Enregistrer la note
                      </button>
                    </div>
                  )}

                  <div className="application-buttons">
                    <button
                      className="button button-danger"
                      onClick={() => updateStatus(item.id, "rejected")}
                      disabled={item.status === "rejected"}
                    >
                      Refuser
                    </button>
                    <button
                      className="button button-primary"
                      onClick={() => updateStatus(item.id, "approved")}
                      disabled={item.status === "approved"}
                    >
                      Accepter le dossier
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  if (missionToken || missionAccess) {
    return (
      <main className="app-shell">
        <div className="app-container">
          <section className="panel" style={{ maxWidth: 620, margin: "60px auto", padding: 28 }}>
            <p className="eyebrow">LINKDROP · ESPACE PRIVÉ</p>
            <h1>Transmission de mission<span>.</span></h1>

            {!missionAccess ? (
              <>
                <p className="muted-text">
                  Tu as reçu un lien privé pour transmettre une mission.
                </p>
                <button
                  className="button button-primary"
                  onClick={openMissionAccess}
                  disabled={missionBusy}
                >
                  {missionBusy ? "Vérification..." : "Accéder au formulaire"}
                </button>
              </>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setMissionBusy(true);

                  try {
                    await api("/missions", {
                      method: "POST",
                      body: JSON.stringify(missionForm),
                    });

                    setMissionAccess(false);
                    setMissionForm({
                      city: "",
                      address: "",
                      scheduledAt: "",
                      quantity: 1,
                      instructions: "",
                    });
                    notify("Mission transmise avec succès.", "success");
                  } catch (error) {
                    notify(error.message, "error");
                  } finally {
                    setMissionBusy(false);
                  }
                }}
              >
                <Field label="Ville">
                  <input
                    required
                    value={missionForm.city}
                    onChange={(e) => setMissionForm({ ...missionForm, city: e.target.value })}
                    placeholder="Ex : Paris"
                  />
                </Field>

                <Field label="Adresse">
                  <input
                    required
                    value={missionForm.address}
                    onChange={(e) => setMissionForm({ ...missionForm, address: e.target.value })}
                    placeholder="Adresse de la mission"
                  />
                </Field>

                <Field label="Date et heure">
                  <input
                    required
                    type="datetime-local"
                    value={missionForm.scheduledAt}
                    onChange={(e) => setMissionForm({ ...missionForm, scheduledAt: e.target.value })}
                  />
                </Field>

                <Field label="Quantité">
                  <input
                    required
                    type="number"
                    min="1"
                    max="100"
                    value={missionForm.quantity}
                    onChange={(e) => setMissionForm({ ...missionForm, quantity: Number(e.target.value) })}
                  />
                </Field>

                <Field label="Instructions complémentaires">
                  <textarea
                    rows="4"
                    maxLength={2000}
                    value={missionForm.instructions}
                    onChange={(e) => setMissionForm({ ...missionForm, instructions: e.target.value })}
                    placeholder="Détails utiles pour la mission..."
                  />
                </Field>

                <button
                  className="button button-primary"
                  type="submit"
                  disabled={missionBusy}
                >
                  {missionBusy ? "Transmission..." : "Transmettre la mission"}
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="icon-button mobile-menu"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label="Ouvrir le menu"
        >
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>

        <button className="brand" onClick={() => { setAdminMode(false); go("home"); }}>
          <span className="brand-mark">L<span>.</span></span>
          <span className="brand-word">
            <strong>LINKDROP</strong>
            <small>DRIVER NETWORK</small>
          </span>
        </button>

        <div className="topbar-right">
          {authenticated && account?.linkdropId && (
            <span className="account-chip">{account.linkdropId}</span>
          )}
          <button
            className={`admin-trigger ${adminMode ? "active" : ""}`}
            onClick={() => {
              setAdminMode((value) => !value);
              setMenuOpen(false);
              setNotice(null);
            }}
          >
            {adminMode ? "Quitter admin" : "Admin"}
          </button>
        </div>
      </header>

      {menuOpen && !adminMode && (
        <div className="mobile-drawer">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => go(step.id)}
              className={page === step.id ? "active" : ""}
            >
              <span>{step.number}</span>
              {step.label}
              <Icon name="arrow" size={16} />
            </button>
          ))}
        </div>
      )}

      <div className="app-container">
        {adminMode ? (
          renderAdmin()
        ) : (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="pulse-dot" />
                  {authenticated ? "TON ESPACE LIVREUR" : "RÉSEAU DE LIVRAISON"}
                </div>

                <h1>
                  La livraison,<br />
                  <span>autrement.</span>
                </h1>

                <p>
                  Configure ton profil livreur en quelques étapes.
                  Tes informations restent associées à ton identifiant LinkDrop.
                </p>

                <div className="hero-actions">
                  <button
                    className="button button-primary"
                    onClick={() => go(authenticated ? "identity" : "home")}
                  >
                    {authenticated ? "Compléter mon profil" : "Découvrir LinkDrop"}
                    <Icon name="arrow" size={17} />
                  </button>
                  <div className="hero-secure">
                    <Icon name="lock" size={15} />
                    <span>Profil privé</span>
                  </div>
                </div>
              </div>

              <div className="hero-art" aria-hidden="true">
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <div className="art-glow" />
                <div className="art-card art-card-back">
                  <span className="art-line" />
                  <span className="art-line short" />
                  <span className="art-dot" />
                </div>
                <div className="art-card art-card-front">
                  <span className="art-icon"><Icon name="package" size={28} /></span>
                  <strong>LINKDROP</strong>
                  <small>DELIVERY NETWORK</small>
                  <span className="art-status"><i /> PROFIL LIVREUR</span>
                </div>
                <span className="art-spark spark-one">✳</span>
                <span className="art-spark spark-two">+</span>
              </div>
            </section>

            <div className="trust-strip">
              <div><Icon name="shield" size={17} /><span>Profil privé</span></div>
              <span className="trust-divider" />
              <div><Icon name="clock" size={17} /><span>Brouillon automatique</span></div>
              <span className="trust-divider" />
              <div><Icon name="package" size={17} /><span>Inscription V1</span></div>
            </div>

            <Notice notice={notice} onClose={() => setNotice(null)} />

            {authLoading ? (
              <section className="loading-panel panel">
                <span className="loader" />
                <h2>Connexion en cours</h2>
                <p>Préparation de ton espace LinkDrop…</p>
              </section>
            ) : !authenticated ? (
              <section className="connect-panel panel">
                <div className="connect-icon"><Icon name="lock" size={26} /></div>
                <div>
                  <p className="eyebrow">ACCÈS CANDIDAT</p>
                  <h2>Ouvre LinkDrop depuis Telegram</h2>
                  <p className="muted-text">
                    Pour protéger les candidatures et sauvegarder ton profil,
                    la connexion doit être faite depuis la Mini App Telegram.
                  </p>
                </div>
                <div className="connect-foot">
                  <span><Icon name="shield" size={16} /> Authentification Telegram</span>
                  <span>Sans nom public</span>
                </div>
              </section>
            ) : (
              <>
                <section className="dashboard-heading">
                  <div>
                    <p className="eyebrow">TON ESPACE</p>
                    <h2>{page === "home" ? "Tableau de bord" : STEPS.find((item) => item.id === page)?.label}</h2>
                    <p className="muted-text">
                      {page === "home"
                        ? "Suis ta progression et retrouve ton dossier."
                        : "Complète les informations nécessaires à ton profil."}
                    </p>
                  </div>
                  <div className="progress-ring" style={{ "--progress": `${percent}%` }}>
                    <div><strong>{percent}%</strong><span>complété</span></div>
                  </div>
                </section>

                {application && (
                  <section className="application-status panel">
                    <div className="status-icon"><Icon name="package" size={21} /></div>
                    <div className="status-copy">
                      <span className="eyebrow">TON DOSSIER</span>
                      <strong>{application.linkdrop_id || account?.linkdropId || "LinkDrop"}</strong>
                      <p>
                        {application.status === "approved"
                          ? "Ton dossier a été accepté."
                          : application.status === "rejected"
                            ? "Ton dossier a été refusé."
                            : "Ton dossier est en attente de vérification."}
                      </p>
                    </div>
                    <StatusBadge status={application.status} />
                  </section>
                )}

                {page === "home" && (
                  <section className="dashboard-grid">
                    <div className="panel progress-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">VUE D'ENSEMBLE</span>
                          <h3>Ton inscription</h3>
                        </div>
                        <span className="panel-number">{progress}/3</span>
                      </div>

                      <div className="progress-bar"><span style={{ width: `${percent}%` }} /></div>
                      <p className="muted-text">
                        {progress === 3
                          ? "Ton profil est complet. Tu peux envoyer ta candidature."
                          : `Encore ${3 - progress} étape${3 - progress > 1 ? "s" : ""} à compléter pour terminer ton profil.`}
                      </p>

                      <div className="step-list">
                        {[
                          { id: "identity", title: "Informations personnelles", sub: "Ville et coordonnées", done: Boolean(form.birthDate && form.city && form.postalCode && form.phone) },
                          { id: "activity", title: "Activité de livraison", sub: "Transport et disponibilités", done: Boolean(form.transports.length && form.mainTransport && form.availability.days.length && form.deliveryTypes.length) },
                          { id: "preferences", title: "Préférences", sub: "Modalités de remise", done: Boolean(form.pickupMethods.length && form.handoffMethods.length && form.addressMode) },
                        ].map((step, index) => (
                          <button
                            key={step.id}
                            className="step-row"
                            onClick={() => go(step.id)}
                          >
                            <span className={`step-number ${step.done ? "done" : ""}`}>
                              {step.done ? <Icon name="check" size={15} /> : `0${index + 1}`}
                            </span>
                            <span className="step-copy">
                              <strong>{step.title}</strong>
                              <small>{step.sub}</small>
                            </span>
                            <Icon name="arrow" size={17} />
                          </button>
                        ))}
                      </div>

                      <button
                        className="button button-primary button-full"
                        onClick={() => go(progress === 3 ? "preferences" : ["identity", "activity", "preferences"][progress])}
                      >
                        {progress === 3 ? "Vérifier mon profil" : "Continuer mon inscription"}
                        <Icon name="arrow" size={17} />
                      </button>
                    </div>

                    <div className="dashboard-side">
                      <div className="panel identity-card">
                        <div className="identity-top">
                          <div className="avatar-mark">L</div>
                          <div>
                            <span className="eyebrow">IDENTIFIANT LINKDROP</span>
                            <strong>{account?.linkdropId || "—"}</strong>
                          </div>
                        </div>
                        <div className="identity-divider" />
                        <div className="identity-detail">
                          <span>Ville</span>
                          <strong>{form.city || "À renseigner"}</strong>
                        </div>
                        <div className="identity-detail">
                          <span>Transport principal</span>
                          <strong>{form.mainTransport || "À renseigner"}</strong>
                        </div>
                        <div className="identity-detail">
                          <span>Statut</span>
                          <strong>{application ? "Candidature enregistrée" : "Profil en préparation"}</strong>
                        </div>
                        <button className="button button-ghost button-full" onClick={() => go("identity")}>
                          Modifier mon profil <Icon name="arrow" size={16} />
                        </button>
                      </div>

                      <div className="privacy-card">
                        <Icon name="shield" size={21} />
                        <div>
                          <strong>Ton identité reste discrète.</strong>
                          <p>Ton espace utilise un identifiant LinkDrop. Aucun nom public n'est nécessaire.</p>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

{page === "missions" && (
  <section className="missions-page">
    <div className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">ESPACE LIVREUR</span>
          <h3>Mes missions</h3>
        </div>
        <button
          type="button"
          onClick={loadMissions}
          disabled={missionsLoading}
        >
          {missionsLoading ? "Actualisation..." : "Actualiser"}
        </button>
      </div>

      <button
        type="button"
        onClick={requestUserPosition}
        disabled={locationLoading}
      >
        {locationLoading
          ? "Localisation..."
          : userPosition
            ? "Actualiser ma position GPS"
            : "Activer ma position GPS"}
      </button>

      {userPosition && (
        <p className="muted-text">
          Position GPS activée. Elle sert uniquement au calcul des trajets.
        </p>
      )}
    </div>

    {missionsLoading && <p>Chargement des missions...</p>}

    {!missionsLoading && missions.length === 0 && (
      <div className="panel">
        <h3>Aucune mission attribuée</h3>
        <p className="muted-text">
          Tes prochaines missions apparaîtront ici.
        </p>
      </div>
    )}

    {missions.map((mission) => (
      <article className="panel mission-card" key={mission.id}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">MISSION #{mission.id}</span>
            <h3>{mission.city}</h3>
          </div>
          <span className="status-badge">
            {({
              assigned: "À traiter",
              accepted: "Acceptée",
              refused: "Refusée",
              in_progress: "En cours",
              completed: "Terminée",
            })[mission.assignment_status] || mission.assignment_status}
          </span>
        </div>

        <p>
          <strong>Date :</strong>{" "}
          {new Date(mission.scheduled_at).toLocaleString("fr-FR")}
        </p>
        <p><strong>Quantité :</strong> {mission.quantity}</p>

        {mission.instructions && (
          <p><strong>Consignes :</strong> {mission.instructions}</p>
        )}

        {["assigned", "accepted", "in_progress"].includes(
          mission.assignment_status
        ) && (
          <>
            <label>Mon moyen de transport</label>
            <select
              value={missionTransports[mission.id] || "walking"}
              onChange={(event) => {
                const transport = event.target.value;
                setMissionTransports((current) => ({
                  ...current,
                  [mission.id]: transport,
                }));
                setMissionRoutes((current) => {
                  const next = { ...current };
                  delete next[mission.id];
                  return next;
                });
              }}
            >
              <option value="walking">À pied</option>
              <option value="bicycle">Vélo</option>
              <option value="electric_bicycle">Vélo électrique</option>
              <option value="public_transport">Transports en commun</option>
              <option value="car">Voiture</option>
              <option value="utility">Utilitaire</option>
            </select>

            <button
              type="button"
              onClick={() => calculateMissionRoute(mission.id)}
              disabled={missionRouteLoading[mission.id]}
            >
              {missionRouteLoading[mission.id]
                ? "Calcul en cours..."
                : "Calculer mon trajet"}
            </button>

            {missionRoutes[mission.id] && (
              <p>
                Distance : {missionRoutes[mission.id].distanceKm} km ·
                Durée : {missionRoutes[mission.id].durationMinutes} min
              </p>
            )}
          </>
        )}

        <div className="mission-actions">
          {mission.assignment_status === "assigned" && (
            <>
              <button
                type="button"
                onClick={() => updateMissionStatus(mission.id, "accepted")}
              >
                Accepter
              </button>
              <button
                type="button"
                onClick={() => updateMissionStatus(mission.id, "refused")}
              >
                Refuser
              </button>
            </>
          )}

          {mission.assignment_status === "accepted" && (
            <button
              type="button"
              onClick={() => updateMissionStatus(mission.id, "in_progress")}
            >
              Démarrer la mission
            </button>
          )}

          {mission.assignment_status === "in_progress" && (
            <button
              type="button"
              onClick={() => updateMissionStatus(mission.id, "completed")}
            >
              Terminer la mission
            </button>
          )}
        </div>
      </article>
    ))}
  </section>
)}

                {page === "identity" && (
                  <section className="form-layout">
                    <aside className="step-aside panel">
                      <span className="step-aside-number">01</span>
                      <p className="eyebrow">ÉTAPE 1 SUR 3</p>
                      <h3>Les informations essentielles.</h3>
                      <p className="muted-text">Ces coordonnées servent à gérer ton dossier. Elles ne constituent pas un profil public.</p>
                      <div className="aside-note"><Icon name="lock" size={17} /> Données privées</div>
                    </aside>

                    <div className="form-panel panel">
                      <div className="form-title">
                        <span className="eyebrow">INSCRIPTION</span>
                        <h2>Informations personnelles</h2>
                        <p className="muted-text">Les champs marqués d'un * sont obligatoires.</p>
                      </div>

                      <div className="form-fields">
                        <Field label="Date de naissance *">
                          <input
                            type="date"
                            value={form.birthDate}
                            max={new Date().toISOString().slice(0, 10)}
                            onChange={(event) => updateField("birthDate", event.target.value)}
                            required
                          />
                        </Field>

                        <div className="field-row">
                          <Field label="Ville *">
                            <input
                              value={form.city}
                              onChange={(event) => updateField("city", event.target.value)}
                              placeholder="Ex. Paris"
                              maxLength={100}
                              required
                            />
                          </Field>
                          <Field label="Code postal *">
                            <input
                              value={form.postalCode}
                              onChange={(event) => updateField("postalCode", event.target.value)}
                              placeholder="Ex. 75011"
                              maxLength={12}
                              required
                            />
                          </Field>
                        </div>

                        <Field label="Téléphone *" hint="Utilisé uniquement pour la gestion de ton dossier.">
                          <input
                            type="tel"
                            value={form.phone}
                            onChange={(event) => updateField("phone", event.target.value)}
                            placeholder="+33 6 00 00 00 00"
                            maxLength={30}
                            required
                          />
                        </Field>
                      </div>

                      <div className="form-footer">
                        <span><Icon name="lock" size={15} /> Informations privées</span>
                        <button className="button button-primary" onClick={() => go("activity")}>
                          Continuer <Icon name="arrow" size={17} />
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {page === "activity" && (
                  <section className="form-layout">
                    <aside className="step-aside panel">
                      <span className="step-aside-number">02</span>
                      <p className="eyebrow">ÉTAPE 2 SUR 3</p>
                      <h3>Ton activité, à ta façon.</h3>
                      <p className="muted-text">Précise les transports disponibles, ta zone et les créneaux pendant lesquels tu peux livrer.</p>
                      <div className="aside-note"><Icon name="clock" size={17} /> Planning flexible</div>
                    </aside>

                    <div className="form-panel panel">
                      <div className="form-title">
                        <span className="eyebrow">ACTIVITÉ LIVREUR</span>
                        <h2>Transports & disponibilités</h2>
                        <p className="muted-text">Sélectionne ce qui correspond réellement à ta situation.</p>
                      </div>

                      <div className="form-fields">
                        <div className="field">
                          <span className="field-label">Moyens de transport *</span>
                          <ChoiceGrid
                            items={TRANSPORTS}
                            values={form.transports}
                            onToggle={(value) => {
                              setForm((current) => {
                                const next = current.transports.includes(value)
                                  ? current.transports.filter((item) => item !== value)
                                  : [...current.transports, value];

                                return {
                                  ...current,
                                  transports: next,
                                  mainTransport: next.includes(current.mainTransport)
                                    ? current.mainTransport
                                    : next[0] || "",
                                };
                              });
                            }}
                          />
                        </div>

                        <Field label="Transport principal *">
                          <select
                            value={form.mainTransport}
                            onChange={(event) => updateField("mainTransport", event.target.value)}
                            required
                          >
                            <option value="">Choisir un transport</option>
                            {form.transports.map((transport) => (
                              <option key={transport} value={transport}>{transport}</option>
                            ))}
                          </select>
                        </Field>

                        <div className="field-row">
                          <Field label="Accès au véhicule">
                            <select
                              value={form.vehicleAccess}
                              onChange={(event) => updateField("vehicleAccess", event.target.value)}
                            >
                              <option value="">Sélectionner</option>
                              <option value="Je le possède">Je le possède</option>
                              <option value="J'y ai accès">J'y ai accès</option>
                              <option value="Non applicable">Non applicable</option>
                            </select>
                          </Field>
                          <Field label="Capacité de chargement">
                            <input
                              value={form.vehicleCapacity}
                              onChange={(event) => updateField("vehicleCapacity", event.target.value)}
                              placeholder="Ex. sac, coffre…"
                              maxLength={250}
                            />
                          </Field>
                        </div>

                        <Field label="Photo du véhicule" hint="Facultatif · JPG, PNG ou WEBP · 4 Mo maximum.">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => {
                              uploadPhoto(event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                          {uploading && <small className="field-hint">Envoi de la photo…</small>}
                          {form.vehiclePhoto && (
                            <span className="file-success"><Icon name="check" size={15} /> Photo ajoutée</span>
                          )}
                        </Field>

                        <Field label="Zone de livraison" hint="Villes, codes postaux ou départements.">
                          <input
                            value={form.zone}
                            onChange={(event) => updateField("zone", event.target.value)}
                            placeholder="Ex. Paris et petite couronne"
                            maxLength={250}
                          />
                        </Field>

                        <div className="slider-field">
                          <div className="slider-heading">
                            <label htmlFor="distance">Distance maximale</label>
                            <strong>{form.maxDistance} km</strong>
                          </div>
                          <input
                            id="distance"
                            type="range"
                            min="1"
                            max="100"
                            value={form.maxDistance}
                            onChange={(event) => updateField("maxDistance", Number(event.target.value))}
                          />
                          <div className="slider-scale"><span>1 km</span><span>100 km</span></div>
                        </div>

                        <div className="slider-field">
                          <div className="slider-heading">
                            <label htmlFor="orders">Commandes simultanées</label>
                            <strong>{form.maxOrders}</strong>
                          </div>
                          <input
                            id="orders"
                            type="range"
                            min="1"
                            max="20"
                            value={form.maxOrders}
                            onChange={(event) => updateField("maxOrders", Number(event.target.value))}
                          />
                          <div className="slider-scale"><span>1 commande</span><span>20 commandes</span></div>
                        </div>

                        <div className="field">
                          <span className="field-label">Jours disponibles *</span>
                          <div className="day-grid">
                            {DAYS.map((day) => {
                              const selected = form.availability.days.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  className={`day-button ${selected ? "is-selected" : ""}`}
                                  onClick={() => toggleAvailability("days", day)}
                                  aria-pressed={selected}
                                >
                                  <span>{day.slice(0, 3)}</span>
                                  {selected && <Icon name="check" size={14} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="field-row">
                          <Field label="Heure de début">
                            <input
                              type="time"
                              value={form.availability.start}
                              onChange={(event) => updateAvailability("start", event.target.value)}
                            />
                          </Field>
                          <Field label="Heure de fin">
                            <input
                              type="time"
                              value={form.availability.end}
                              onChange={(event) => updateAvailability("end", event.target.value)}
                            />
                          </Field>
                        </div>

                        <div className="field">
                          <span className="field-label">Types de livraison *</span>
                          <ChoiceGrid
                            items={["Immédiates", "Programmées"]}
                            values={form.availability.mode}
                            onToggle={(value) => toggleAvailability("mode", value)}
                          />
                        </div>

                        <Field label="Précisions sur tes disponibilités">
                          <textarea
                            rows="3"
                            value={form.availability.notes}
                            onChange={(event) => updateAvailability("notes", event.target.value)}
                            placeholder="Ex. disponible uniquement le soir…"
                            maxLength={500}
                          />
                        </Field>

                        <div className="field">
                          <span className="field-label">Types de colis acceptés *</span>
                          <ChoiceGrid
                            items={PRODUCTS}
                            values={form.deliveryTypes}
                            onToggle={(value) => toggleArray("deliveryTypes", value)}
                          />
                        </div>
                      </div>

                      <div className="form-footer">
                        <button className="button button-ghost" onClick={() => go("identity")}>Retour</button>
                        <button className="button button-primary" onClick={() => go("preferences")}>
                          Continuer <Icon name="arrow" size={17} />
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {page === "preferences" && (
                  <section className="form-layout">
                    <aside className="step-aside panel">
                      <span className="step-aside-number">03</span>
                      <p className="eyebrow">ÉTAPE 3 SUR 3</p>
                      <h3>Les détails qui comptent.</h3>
                      <p className="muted-text">Indique comment tu préfères organiser la récupération et la remise des colis.</p>
                      <div className="aside-note"><Icon name="shield" size={17} /> À valider avant envoi</div>
                    </aside>

                    <div className="form-panel panel">
                      <div className="form-title">
                        <span className="eyebrow">PRÉFÉRENCES</span>
                        <h2>Comment tu souhaites livrer</h2>
                        <p className="muted-text">Ces choix préparent ton profil pour la suite du projet.</p>
                      </div>

                      <div className="form-fields">
                        <div className="field">
                          <span className="field-label">Rencontres physiques</span>
                          <div className="radio-list">
                            {[
                              ["yes", "Je préfère éviter les rencontres"],
                              ["depends", "Cela dépend de la commande"],
                              ["no", "La remise en main propre me convient"],
                            ].map(([value, label]) => (
                              <label className={`radio-option ${form.anonymity === value ? "is-selected" : ""}`} key={value}>
                                <input
                                  type="radio"
                                  name="anonymity"
                                  value={value}
                                  checked={form.anonymity === value}
                                  onChange={() => updateField("anonymity", value)}
                                />
                                <span className="radio-dot" />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="field">
                          <span className="field-label">Récupération du produit *</span>
                          <ChoiceGrid
                            items={PICKUP_METHODS}
                            values={form.pickupMethods}
                            onToggle={(value) => toggleArray("pickupMethods", value)}
                          />
                        </div>

                        <div className="field">
                          <span className="field-label">Remise au destinataire *</span>
                          <ChoiceGrid
                            items={HANDOFF_METHODS}
                            values={form.handoffMethods}
                            onToggle={(value) => toggleArray("handoffMethods", value)}
                          />
                        </div>

                        <Field label="Choix de l'adresse">
                          <select
                            value={form.addressMode}
                            onChange={(event) => updateField("addressMode", event.target.value)}
                          >
                            <option value="automatic">Sélection automatique</option>
                            <option value="validation">Sélection avec ma validation</option>
                          </select>
                        </Field>

                        <div className="field">
                          <span className="field-label">Préférences de paiement</span>
                          <p className="field-hint">
                            Facultatif · Ces préférences ne garantissent pas que ces moyens seront disponibles.
                          </p>
                          <ChoiceGrid
                            items={PAYMENT_METHODS}
                            values={form.paymentPreferences}
                            onToggle={(value) => toggleArray("paymentPreferences", value)}
                          />
                        </div>

                        <Field label="Autres précisions" hint="Facultatif · 1 000 caractères maximum.">
                          <textarea
                            rows="4"
                            value={form.notes}
                            onChange={(event) => updateField("notes", event.target.value)}
                            placeholder="Une information utile à ajouter à ton dossier…"
                            maxLength={1000}
                          />
                        </Field>
                      </div>

                      <div className="submission-summary">
                        <div className="summary-icon"><Icon name="shield" size={21} /></div>
                        <div>
                          <strong>Avant d'envoyer</strong>
                          <p>Vérifie tes informations. Ton dossier sera enregistré pour examen. Les fonctionnalités de commande dépendront des prochaines versions de LinkDrop.</p>
                        </div>
                      </div>

                      <div className="form-footer">
                        <button className="button button-ghost" onClick={() => go("activity")}>Retour</button>
                        <button
                          className="button button-primary"
                          onClick={submitApplication}
                          disabled={busy || uploading}
                        >
                          {busy ? "Envoi en cours…" : application ? "Mettre à jour mon dossier" : "Envoyer ma candidature"}
                          {!busy && <Icon name="arrow" size={17} />}
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                <footer className="app-footer">
                  <span className="brand-mark footer-mark">L<span>.</span></span>
                  <div>
                    <strong>LINKDROP</strong>
                    <small>VERSION 1.0 · ESPACE LIVREUR</small>
                  </div>
                  <span className="save-indicator">
                    <span className="save-dot" />
                    {draftSavedAt ? "Brouillon sauvegardé" : "Sauvegarde automatique"}
                  </span>
                </footer>
              </>
            )}
          </>
        )}
      </div>

      {!adminMode && authenticated && (
        <nav className="bottom-nav" aria-label="Navigation principale">
          <button
      className={page === "missions" ? "active" : ""}
      onClick={() => go("missions")}>
  <Icon name="package" size={20} />
      <span>Mes missions</span>
        </button> 
          {STEPS.map((step, index) => (
            <button
              key={step.id}
              className={page === step.id ? "active" : ""}
              onClick={() => go(step.id)}
            >
              <Icon
                name={
                  index === 0 ? "home" :
                  index === 1 ? "user" :
                  index === 2 ? "activity" : "settings"
                }
                size={20}
              />
              <span>{step.label}</span>
              {index > 0 && index <= 3 && (
                <i className={
                  (index === 1 && form.birthDate && form.city && form.phone) ||
                  (index === 2 && form.transports.length && form.availability.days.length) ||
                  (index === 3 && form.pickupMethods.length && form.handoffMethods.length)
                    ? "step-indicator complete"
                    : "step-indicator"
                } />
              )}
            </button>
          ))}
        </nav>
      )}
    </main>
  );
}