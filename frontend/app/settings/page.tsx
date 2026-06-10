"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import type { ReactNode } from "react";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import {
  Settings as SettingsIcon,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Building2,
  Globe,
  Link2,
  LogOut,
  Save,
  Check,
  RefreshCw,
} from "lucide-react";
import { getCountryDataList, getEmojiFlag } from "countries-list";
import { useAuth } from "@/context/AuthContext";
import { NeoButton, StatusPill } from "@/components/Neo";

/* ── Neobrutalist section + toggle helpers ── */
function Section({
  title,
  Icon: SecIcon,
  tone = "ink",
  children,
}: {
  title: string;
  Icon: typeof SettingsIcon;
  tone?: "ink" | "teal" | "orange";
  children: ReactNode;
}) {
  const bg = tone === "teal" ? "bg-accent-teal" : tone === "orange" ? "bg-accent-orange" : "bg-ink";
  const fg = tone === "teal" ? "text-ink" : "text-paper";
  return (
    <section className="neo-card">
      <div className="px-5 py-3 border-b-2 border-ink bg-paper flex items-center gap-2.5">
        <div className={`size-7 border-2 border-ink grid place-items-center ${bg} ${fg}`}>
          <SecIcon className="size-3.5" strokeWidth={2.5} />
        </div>
        <h2 className="text-xs tracking-[0.18em] font-bold uppercase">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] tracking-[0.18em] font-bold text-muted-foreground mb-1.5 uppercase">
      {children}
    </div>
  );
}

function Toggle({
  on,
  setOn,
  labelOn,
  labelOff,
}: {
  on: boolean;
  setOn: (b: boolean) => void;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <button onClick={() => setOn(!on)} className="flex border-2 border-ink neo-shadow-sm w-fit">
      <span
        className={`px-4 py-2 text-sm font-bold border-r-2 border-ink ${on ? "bg-accent-teal text-ink" : "bg-paper-2"}`}
      >
        {labelOn}
      </span>
      <span
        className={`px-4 py-2 text-sm font-bold ${!on ? "bg-accent-orange text-white" : "bg-paper-2"}`}
      >
        {labelOff}
      </span>
    </button>
  );
}

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
    <div className="flex flex-col h-full overflow-hidden bg-paper font-space">
      {/* Header — black branded bar */}
      <div className="px-6 py-4 shrink-0 relative flex items-center gap-4 bg-ink text-paper border-b-2 border-ink">
        <div className="size-9 grid place-items-center shrink-0 bg-accent-orange border-2 border-paper">
          <SettingsIcon className="size-5 text-paper" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight leading-tight">Settings</h1>
          <p className="text-xs mt-0.5 truncate text-paper/70">
            Preferences · integrations · personalisation
          </p>
        </div>
        <NeoButton variant="danger" onClick={signOut} className="shrink-0">
          <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
        </NeoButton>
        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-accent-orange" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {loadError && (
            <div className="bg-accent-yellow/40 border-2 border-ink p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" strokeWidth={2.5} />
              {loadError}
            </div>
          )}

          {/* Autonomy */}
          <Section title="Autonomy" Icon={ShieldCheck} tone="ink">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="min-w-0">
                  <div className="font-bold">Auto-approve agent actions</div>
                  <div className="text-sm text-muted-foreground">
                    When off, the agent asks before any change. When on, it acts without asking.
                  </div>
                </div>
                <div className="ml-auto shrink-0">
                  <Toggle
                    on={autoApprove}
                    setOn={(v) => {
                      toggleAutoApprove(v);
                    }}
                    labelOn="ON"
                    labelOff="OFF"
                  />
                </div>
              </div>
              <div className="bg-accent-yellow/40 border-2 border-ink p-3 flex items-start gap-3 text-sm">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" strokeWidth={2.5} />
                <span>
                  <span className="font-bold">Sending emails always asks first</span> — even with
                  auto-approve on. Sending is irreversible.
                </span>
              </div>
            </div>
          </Section>

          {/* Integrations */}
          <Section title="Integrations" Icon={Link2} tone="teal">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Google to add application deadlines to your Calendar and send recommender /
                outreach emails from your Gmail. Separate from sign-in.
              </p>

              {googleNotice === "connected" && (
                <p className="text-sm flex items-center gap-1.5 text-[#0D9268]">
                  <Check className="size-4" /> Google connected.
                </p>
              )}
              {googleNotice === "error" && (
                <p className="text-sm flex items-center gap-1.5 text-accent-orange">
                  <AlertTriangle className="size-4" /> Couldn&apos;t connect Google. Try again.
                </p>
              )}

              <div className="border-2 border-ink p-4 neo-shadow-sm flex items-center gap-3">
                <Icon icon="logos:google-icon" width={22} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">Google · Calendar &amp; Gmail</h3>
                    {google?.connected && (
                      <StatusPill tone="teal">
                        <Check className="size-3 mr-1" /> Connected
                      </StatusPill>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {google === null
                      ? "Checking…"
                      : google.connected
                        ? (google.email ?? "Connected")
                        : "Not connected"}
                  </div>
                </div>
                {google?.connected ? (
                  <NeoButton
                    size="sm"
                    variant="default"
                    onClick={disconnectGoogle}
                    disabled={googleBusy}
                    className="shrink-0"
                  >
                    {googleBusy ? "…" : "Disconnect"}
                  </NeoButton>
                ) : (
                  <NeoButton
                    size="sm"
                    variant="primary"
                    onClick={connectGoogle}
                    disabled={googleBusy}
                    className="shrink-0"
                  >
                    {googleBusy ? "…" : "Connect Google"}
                  </NeoButton>
                )}
              </div>

              {/* Reminder cadence */}
              <div>
                <SectionLabel>Deadline reminders (days before)</SectionLabel>
                <div className="flex flex-wrap gap-2">
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
                        className={clsx(
                          "px-3 py-1.5 border-2 border-ink font-mono text-sm font-bold transition-colors",
                          on ? "bg-ink text-paper" : "bg-paper-2 hover:bg-paper"
                        )}
                      >
                        {d}d
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Section>

          {/* Research Interests */}
          <Section title="Research Interests" Icon={Cpu} tone="orange">
            <TagInput
              label="Your research areas"
              placeholder="Type an interest and press Enter..."
              tags={interests}
              onAdd={(v) => setInterests((p) => [...p, v])}
              onRemove={(v) => setInterests((p) => p.filter((x) => x !== v))}
              suggestions={SUGGESTED_INTERESTS}
            />
          </Section>

          {/* Universities */}
          <Section title="Universities of Interest" Icon={Building2} tone="teal">
            <UniversityPicker
              selected={universities}
              onAdd={(v) => setUniversities((p) => [...p, v])}
              onRemove={(v) => setUniversities((p) => p.filter((x) => x !== v))}
            />
          </Section>

          {/* Countries */}
          <Section title="Countries of Interest" Icon={Globe} tone="ink">
            <CountryPicker
              selected={countries}
              onAdd={(v) => setCountries((p) => [...p, v])}
              onRemove={(v) => setCountries((p) => p.filter((x) => x !== v))}
            />
          </Section>

          {/* Footer: legal + hackathon */}
          <div className="pt-2 pb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <a href="/privacy" className="underline">
              Privacy Policy
            </a>
            <a href="/terms" className="underline">
              Terms of Service
            </a>
            <span>
              Built for the{" "}
              <a
                href="https://rapid-agent.devpost.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-accent-orange"
              >
                RapidAgent Hackathon
              </a>{" "}
              by Google
            </span>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      {(isDirty || saved) && (
        <div className="shrink-0 px-6 py-3 flex items-center justify-between gap-4 bg-ink text-paper border-t-2 border-accent-orange">
          <p className="text-xs text-paper/60">
            {saved ? "Preferences saved." : "You have unsaved changes."}
          </p>
          <NeoButton variant={saved ? "teal" : "primary"} onClick={save} disabled={saving}>
            {saving ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : saved ? (
              <Check className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
          </NeoButton>
        </div>
      )}
    </div>
  );
}
