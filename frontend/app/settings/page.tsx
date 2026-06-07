"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Icon } from "@iconify/react";
import { getCountryDataList, getEmojiFlag } from "countries-list";
import { useAuth } from "@/context/AuthContext";

/* ── Country data ── */
const ALL_COUNTRIES = getCountryDataList()
  .map((c) => ({ name: c.name, code: c.iso2, flag: getEmojiFlag(c.iso2 as any) }))
  .sort((a, b) => a.name.localeCompare(b.name));

/* ── University tier lookup ── */
const TIER_MAP: Record<string, string> = {
  MIT: "T5",
  Stanford: "T5",
  CMU: "T5",
  Berkeley: "T5",
  Harvard: "T5",
  Princeton: "T10",
  "University of Washington": "T10",
  Cornell: "T10",
  Columbia: "T20",
  NYU: "T20",
};

const TIER_STYLE: Record<string, { bg: string; color: string }> = {
  T5: { bg: "#4ECDC4", color: "#0D0D0D" },
  T10: { bg: "#0D0D0D", color: "#FFFFFF" },
  T20: { bg: "#EDE6D3", color: "#5A5A5A" },
};

const SUGGESTED_INTERESTS = [
  "NLP",
  "LLM Alignment",
  "Computer Vision",
  "Reinforcement Learning",
  "Robotics",
  "ML Systems",
  "Drug Discovery",
  "Computational Biology",
  "Information Retrieval",
  "Human-Computer Interaction",
];

/* ── TagInput (interests) ── */
function TagInput({
  label,
  placeholder,
  tags,
  onAdd,
  onRemove,
  suggestions,
}: {
  label: string;
  placeholder: string;
  tags: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  suggestions?: string[];
}) {
  const [input, setInput] = useState("");

  function tryAdd(val: string) {
    const v = val.trim();
    if (!v || tags.includes(v)) return;
    onAdd(v);
    setInput("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      tryAdd(input);
    }
    if (e.key === "Backspace" && input === "" && tags.length > 0) onRemove(tags[tags.length - 1]);
  }

  const unused = suggestions?.filter((s) => !tags.includes(s)) ?? [];

  return (
    <div>
      <label
        className="block text-[10px] font-bold uppercase tracking-widest font-space mb-2"
        style={{ color: "#9CA3AF" }}
      >
        {label}
      </label>
      <div
        className="flex flex-wrap gap-1.5 p-3 min-h-[48px]"
        style={{ background: "#FFFFFF", border: "2px solid #0D0D0D", borderRadius: "4px" }}
        onClick={() => document.getElementById(`input-${label}`)?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold font-space"
            style={{ background: "#0D0D0D", color: "#FFFFFF", borderRadius: "4px" }}
          >
            {tag}
            <button
              onClick={() => onRemove(tag)}
              style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={`input-${label}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => tryAdd(input)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-24 text-sm font-dm outline-none bg-transparent"
          style={{ color: "#0D0D0D" }}
        />
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {unused.slice(0, 8).map((s) => (
            <button
              key={s}
              onClick={() => onAdd(s)}
              className="text-[10px] font-dm px-2 py-0.5 bouncy"
              style={{
                background: "#F7F0E3",
                border: "1.5px solid #C8C0AF",
                color: "#5A5A5A",
                borderRadius: "4px",
              }}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type DropPos = { top: number; left: number; width: number };

/* ── Country picker ── */
function CountryPicker({
  selected,
  onAdd,
  onRemove,
}: {
  selected: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropPos>({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function openWithPos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow >= 208 ? r.bottom + 4 : r.top - 204;
      setPos({ top, left: r.left, width: r.width });
    }
    setOpen(true);
  }

  const filtered = ALL_COUNTRIES.filter(
    (c) => !selected.includes(c.name) && c.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map((name) => {
            const c = ALL_COUNTRIES.find((x) => x.name === name);
            return (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold font-space"
                style={{ background: "#0D0D0D", color: "#FFFFFF", borderRadius: "4px" }}
              >
                {c?.flag} {name}
                <button
                  onClick={() => onRemove(name)}
                  style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div
        ref={inputRef}
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: "#FFFFFF", border: "2px solid #0D0D0D", borderRadius: "4px" }}
      >
        <Icon icon="solar:magnifer-bold" width={13} style={{ color: "#9CA3AF", flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            openWithPos();
          }}
          onFocus={openWithPos}
          placeholder="Search countries..."
          className="flex-1 text-sm font-dm outline-none bg-transparent"
          style={{ color: "#0D0D0D" }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            background: "#FFFFFF",
            border: "2px solid #0D0D0D",
            borderRadius: "4px",
            boxShadow: "4px 4px 0 #0D0D0D",
            zIndex: 9999,
            maxHeight: "170px",
            overflowY: "auto",
          }}
        >
          {filtered.map((c) => (
            <button
              key={c.code}
              onMouseDown={(e) => {
                e.preventDefault();
                onAdd(c.name);
                setQuery("");
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-dm text-left bouncy"
              style={{ color: "#0D0D0D" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F7F0E3")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <span>{c.flag}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── University picker ── */
interface UniResult {
  name: string;
  country: string;
}

function UniversityPicker({
  selected,
  onAdd,
  onRemove,
}: {
  selected: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UniResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<DropPos>({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function calcPos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const top = spaceBelow >= 208 ? r.bottom + 4 : r.top - 204;
      setPos({ top, left: r.left, width: r.width });
    }
  }

  function onQueryChange(val: string) {
    setQuery(val);
    clearTimeout(timer.current);
    if (!val.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/universities?name=${encodeURIComponent(val)}`);
        const data: UniResult[] = await res.json();
        const filtered = data.filter((u) => !selected.includes(u.name)).slice(0, 8);
        setResults(filtered);
        calcPos();
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map((name) => {
            const tier = TIER_MAP[name];
            const ts = tier ? TIER_STYLE[tier] : null;
            return (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold font-space"
                style={{ background: "#0D0D0D", color: "#FFFFFF", borderRadius: "4px" }}
              >
                {ts && (
                  <span
                    className="text-[9px] font-bold px-1 py-0.5"
                    style={{ background: ts.bg, color: ts.color, borderRadius: "3px" }}
                  >
                    {tier}
                  </span>
                )}
                {name}
                <button
                  onClick={() => onRemove(name)}
                  style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div
        ref={inputRef}
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: "#FFFFFF", border: "2px solid #0D0D0D", borderRadius: "4px" }}
      >
        <Icon
          icon={loading ? "solar:refresh-bold" : "solar:magnifer-bold"}
          width={13}
          style={{ color: "#9CA3AF", flexShrink: 0 }}
        />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search universities..."
          className="flex-1 text-sm font-dm outline-none bg-transparent"
          style={{ color: "#0D0D0D" }}
        />
      </div>
      {open && results.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            background: "#FFFFFF",
            border: "2px solid #0D0D0D",
            borderRadius: "4px",
            boxShadow: "4px 4px 0 #0D0D0D",
            zIndex: 9999,
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {results.map((u) => {
            const tier = TIER_MAP[u.name];
            const ts = tier ? TIER_STYLE[tier] : null;
            return (
              <button
                key={u.name}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAdd(u.name);
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-dm text-left bouncy"
                style={{ color: "#0D0D0D" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F7F0E3")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                {ts && (
                  <span
                    className="text-[9px] font-bold px-1 py-0.5 shrink-0"
                    style={{ background: ts.bg, color: ts.color, borderRadius: "3px" }}
                  >
                    {tier}
                  </span>
                )}
                <span className="truncate">{u.name}</span>
                <span className="ml-auto shrink-0" style={{ color: "#9CA3AF" }}>
                  {u.country}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Page ── */
export default function SettingsPage() {
  const [interests, setInterests] = useState<string[]>([]);
  const [universities, setUniversities] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [reminderOffsets, setReminderOffsets] = useState<number[]>([7, 1]);

  async function toggleAutoApprove(value: boolean) {
    setAutoApprove(value);
    try {
      const { preferencesApi } = await import("../../lib/api");
      await preferencesApi.setAutoApprove(value);
    } catch {
      setAutoApprove(!value); // revert on failure
    }
  }
  const { signOut } = useAuth();

  const [google, setGoogle] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleNotice, setGoogleNotice] = useState<"connected" | "error" | null>(() => {
    if (typeof window === "undefined") return null;
    const g = new URLSearchParams(window.location.search).get("google");
    return g === "connected" || g === "error" ? g : null;
  });

  async function connectGoogle() {
    setGoogleBusy(true);
    try {
      const { integrationsApi } = await import("../../lib/api");
      const res = await integrationsApi.googleAuthUrl();
      window.location.href = res.data.url; // redirect to Google consent
    } catch {
      setGoogleBusy(false);
    }
  }

  async function disconnectGoogle() {
    setGoogleBusy(true);
    try {
      const { integrationsApi } = await import("../../lib/api");
      await integrationsApi.googleDisconnect();
      setGoogle({ connected: false, email: null });
    } catch {
      // keep current state
    } finally {
      setGoogleBusy(false);
    }
  }

  // Fetch Google status on mount and strip the ?google= callback param from the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("google")) {
      params.delete("google");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    import("../../lib/api")
      .then(({ integrationsApi }) => integrationsApi.googleStatus())
      .then((res) => setGoogle(res.data))
      .catch(() => setGoogle({ connected: false, email: null }));
  }, []);

  // Auto-dismiss the connect/error notice. setState lives in a timeout, not the
  // effect body, so it doesn't trip set-state-in-effect.
  useEffect(() => {
    if (!googleNotice) return;
    const t = setTimeout(() => setGoogleNotice(null), 4000);
    return () => clearTimeout(t);
  }, [googleNotice]);

  const [savedSnapshot, setSavedSnapshot] = useState({
    interests: [] as string[],
    universities: [] as string[],
    countries: [] as string[],
    reminderOffsets: [7, 1] as number[],
  });

  useEffect(() => {
    import("../../lib/api").then(({ usersApi }) =>
      usersApi
        .getPreferences()
        .then((res) => {
          const p = res.data;
          setInterests(p.research_interests);
          setUniversities(p.target_universities);
          setCountries(p.target_countries);
          setAutoApprove(!!p.auto_approve);
          const offsets = p.reminder_offsets_days ?? [7, 1];
          setReminderOffsets(offsets);
          setSavedSnapshot({
            interests: p.research_interests,
            universities: p.target_universities,
            countries: p.target_countries,
            reminderOffsets: offsets,
          });
        })
        .catch(() => setLoadError("Could not load preferences."))
    );
  }, []);

  const isDirty =
    JSON.stringify(interests) !== JSON.stringify(savedSnapshot.interests) ||
    JSON.stringify(universities) !== JSON.stringify(savedSnapshot.universities) ||
    JSON.stringify(countries) !== JSON.stringify(savedSnapshot.countries) ||
    JSON.stringify(reminderOffsets) !== JSON.stringify(savedSnapshot.reminderOffsets);

  async function save() {
    setSaving(true);
    try {
      const { usersApi } = await import("../../lib/api");
      await usersApi.upsertPreferences({
        research_interests: interests,
        target_universities: universities,
        target_countries: countries,
        degree_type: "Either",
        funding_required: false,
        auto_approve: autoApprove,
        reminder_offsets_days: reminderOffsets,
      });
      setSavedSnapshot({ interests, universities, countries, reminderOffsets });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // keep dirty state so user can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#F7F0E3" }}>
      {/* Header */}
      <div
        className="px-4 sm:px-6 py-4 sticky top-0 z-10 flex items-center justify-between gap-4"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <div className="min-w-0">
          <h1
            className="text-sm font-bold font-space flex items-center gap-2"
            style={{ color: "#FFFFFF" }}
          >
            <Icon icon="solar:settings-bold" width={15} style={{ color: "#E8472A" }} />
            Preferences
          </h1>
          <p
            className="text-xs font-dm mt-0.5 truncate"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Grad Paddy uses these to personalise search and SOP generation
          </p>
        </div>
        <button
          onClick={signOut}
          className="bouncy flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold font-space flex-shrink-0"
          style={{
            background: "rgba(232,71,42,0.15)",
            color: "#E8472A",
            border: "1.5px solid #E8472A",
            borderRadius: "4px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#E8472A";
            e.currentTarget.style.color = "#FFFFFF";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(232,71,42,0.15)";
            e.currentTarget.style.color = "#E8472A";
          }}
        >
          <Icon icon="solar:logout-2-bold" width={13} />
          Sign out
        </button>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Agent approval */}
          <div
            className="p-5"
            style={{
              background: "#FFFFFF",
              border: "2px solid #0D0D0D",
              boxShadow: "4px 4px 0 #0D0D0D",
              borderRadius: "4px",
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-7 h-7 flex items-center justify-center"
                    style={{
                      background: "#0D0D0D",
                      border: "2px solid #0D0D0D",
                      borderRadius: "4px",
                    }}
                  >
                    <Icon icon="solar:shield-check-bold" width={13} style={{ color: "#FFFFFF" }} />
                  </div>
                  <span className="font-bold font-space text-sm" style={{ color: "#0D0D0D" }}>
                    Always allow actions
                  </span>
                </div>
                <p className="text-xs font-dm" style={{ color: "#9CA3AF" }}>
                  When off, the agent asks you to approve before any change. When on, it acts
                  without asking.
                </p>
              </div>
              <button
                onClick={() => toggleAutoApprove(!autoApprove)}
                role="switch"
                aria-checked={autoApprove}
                className="relative shrink-0 bouncy"
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 999,
                  border: "2px solid #0D0D0D",
                  background: autoApprove ? "#4ECDC4" : "#EDE6D3",
                }}
              >
                <span
                  className="absolute top-1/2"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    background: "#0D0D0D",
                    transform: "translateY(-50%)",
                    left: autoApprove ? 22 : 2,
                    transition: "left 150ms ease-out",
                  }}
                />
              </button>
            </div>
          </div>

          {/* Connected accounts */}
          <div
            className="p-5"
            style={{
              background: "#FFFFFF",
              border: "2px solid #0D0D0D",
              boxShadow: "4px 4px 0 #0D0D0D",
              borderRadius: "4px",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-7 h-7 flex items-center justify-center"
                style={{ background: "#4ECDC4", border: "2px solid #0D0D0D", borderRadius: "4px" }}
              >
                <Icon icon="solar:link-circle-bold" width={13} style={{ color: "#0D0D0D" }} />
              </div>
              <h2 className="text-sm font-bold font-space" style={{ color: "#0D0D0D" }}>
                Connected accounts
              </h2>
            </div>
            <p className="text-xs font-dm mb-3" style={{ color: "#9CA3AF" }}>
              Connect Google to add application deadlines to your Calendar and send recommender /
              outreach emails from your Gmail. Separate from sign-in — grants Calendar & Gmail
              permissions.
            </p>

            {googleNotice === "connected" && (
              <p
                className="text-xs font-dm mb-2 flex items-center gap-1.5"
                style={{ color: "#0D9268" }}
              >
                <Icon icon="solar:check-circle-bold" width={13} />
                Google connected.
              </p>
            )}
            {googleNotice === "error" && (
              <p
                className="text-xs font-dm mb-2 flex items-center gap-1.5"
                style={{ color: "#E8472A" }}
              >
                <Icon icon="solar:danger-triangle-bold" width={13} />
                Couldn&apos;t connect Google. Try again.
              </p>
            )}

            <div
              className="flex items-center justify-between gap-3 p-3"
              style={{ background: "#F7F0E3", border: "1.5px solid #C8C0AF", borderRadius: "4px" }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon icon="logos:google-icon" width={18} className="shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold font-space" style={{ color: "#0D0D0D" }}>
                    Google (Calendar & Gmail)
                  </div>
                  <div className="text-xs font-dm truncate" style={{ color: "#9CA3AF" }}>
                    {google === null
                      ? "Checking…"
                      : google.connected
                        ? `Connected${google.email ? ` · ${google.email}` : ""}`
                        : "Not connected"}
                  </div>
                </div>
              </div>
              {google?.connected ? (
                <button
                  onClick={disconnectGoogle}
                  disabled={googleBusy}
                  className="btn-white btn-sm text-xs shrink-0"
                  style={{ color: "#E8472A", borderColor: "#E8472A" }}
                >
                  {googleBusy ? "…" : "Disconnect"}
                </button>
              ) : (
                <button
                  onClick={connectGoogle}
                  disabled={googleBusy}
                  className="btn-coral btn-sm text-xs shrink-0"
                >
                  {googleBusy ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    <Icon icon="solar:link-circle-bold" width={13} />
                  )}
                  Connect
                </button>
              )}
            </div>

            {/* Reminder cadence */}
            <div className="mt-4 pt-4" style={{ borderTop: "1.5px solid #EDE6D3" }}>
              <div className="text-xs font-bold font-space mb-1" style={{ color: "#0D0D0D" }}>
                Deadline reminders
              </div>
              <p className="text-xs font-dm mb-2" style={{ color: "#9CA3AF" }}>
                Days before each deadline to send a Google Calendar reminder. Applied when you add a
                deadline to your calendar.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[1, 3, 7, 14, 28].map((d) => {
                  const on = reminderOffsets.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setReminderOffsets((prev) =>
                          on ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => b - a)
                        )
                      }
                      className="px-3 py-1 text-xs font-semibold font-space bouncy"
                      style={{
                        background: on ? "#0D0D0D" : "#FFFFFF",
                        color: on ? "#FFFFFF" : "#5A5A5A",
                        border: "1.5px solid #0D0D0D",
                        borderRadius: "4px",
                      }}
                    >
                      {d} {d === 1 ? "day" : "days"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Research Interests */}
          <div
            className="p-5"
            style={{
              background: "#FFFFFF",
              border: "2px solid #0D0D0D",
              boxShadow: "4px 4px 0 #0D0D0D",
              borderRadius: "4px",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-7 h-7 flex items-center justify-center"
                style={{ background: "#E8472A", border: "2px solid #0D0D0D", borderRadius: "4px" }}
              >
                <Icon icon="solar:cpu-bolt-bold" width={13} style={{ color: "#FFFFFF" }} />
              </div>
              <h2 className="text-sm font-bold font-space" style={{ color: "#0D0D0D" }}>
                Research Interests
              </h2>
            </div>
            <TagInput
              label="Your research areas"
              placeholder="Type an interest and press Enter..."
              tags={interests}
              onAdd={(v) => setInterests((p) => [...p, v])}
              onRemove={(v) => setInterests((p) => p.filter((x) => x !== v))}
              suggestions={SUGGESTED_INTERESTS}
            />
          </div>

          {/* Universities */}
          <div
            className="p-5"
            style={{
              background: "#FFFFFF",
              border: "2px solid #0D0D0D",
              boxShadow: "4px 4px 0 #0D0D0D",
              borderRadius: "4px",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-7 h-7 flex items-center justify-center"
                style={{ background: "#4ECDC4", border: "2px solid #0D0D0D", borderRadius: "4px" }}
              >
                <Icon icon="solar:buildings-bold" width={13} style={{ color: "#0D0D0D" }} />
              </div>
              <h2 className="text-sm font-bold font-space" style={{ color: "#0D0D0D" }}>
                Universities of Interest
              </h2>
            </div>
            <UniversityPicker
              selected={universities}
              onAdd={(v) => setUniversities((p) => [...p, v])}
              onRemove={(v) => setUniversities((p) => p.filter((x) => x !== v))}
            />
          </div>

          {/* Countries */}
          <div
            className="p-5"
            style={{
              background: "#FFFFFF",
              border: "2px solid #0D0D0D",
              boxShadow: "4px 4px 0 #0D0D0D",
              borderRadius: "4px",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-7 h-7 flex items-center justify-center"
                style={{ background: "#0D0D0D", border: "2px solid #0D0D0D", borderRadius: "4px" }}
              >
                <Icon icon="solar:global-bold" width={13} style={{ color: "#FFFFFF" }} />
              </div>
              <h2 className="text-sm font-bold font-space" style={{ color: "#0D0D0D" }}>
                Countries of Interest
              </h2>
            </div>
            <CountryPicker
              selected={countries}
              onAdd={(v) => setCountries((p) => [...p, v])}
              onRemove={(v) => setCountries((p) => p.filter((x) => x !== v))}
            />
          </div>
        </div>
      </div>

      {loadError && (
        <div className="sticky bottom-0 px-6 py-3" style={{ background: "#E8472A" }}>
          <p className="text-xs font-dm text-white">{loadError}</p>
        </div>
      )}

      {/* Sticky save bar */}
      {(isDirty || saved) && (
        <div
          className="sticky bottom-0 px-4 sm:px-6 py-3 flex items-center justify-between gap-4"
          style={{ background: "#0D0D0D", borderTop: "2px solid #E8472A" }}
        >
          <p className="text-xs font-dm" style={{ color: "rgba(255,255,255,0.5)" }}>
            {saved ? "Preferences saved." : "You have unsaved changes."}
          </p>
          <button
            onClick={save}
            disabled={saving}
            className={saved ? "btn-teal btn-sm" : "btn-coral btn-sm"}
          >
            <Icon
              icon={
                saving
                  ? "solar:refresh-bold"
                  : saved
                    ? "solar:check-circle-bold"
                    : "solar:floppy-disk-bold"
              }
              width={14}
            />
            <span className="text-sm">
              {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
