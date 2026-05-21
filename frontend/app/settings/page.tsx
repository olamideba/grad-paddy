"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Icon } from "@iconify/react";
import { getCountryDataList, getEmojiFlag } from "countries-list";

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
  const [savedSnapshot, setSavedSnapshot] = useState({
    interests: [] as string[],
    universities: [] as string[],
    countries: [] as string[],
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
          setSavedSnapshot({
            interests: p.research_interests,
            universities: p.target_universities,
            countries: p.target_countries,
          });
        })
        .catch(() => setLoadError("Could not load preferences."))
    );
  }, []);

  const isDirty =
    JSON.stringify(interests) !== JSON.stringify(savedSnapshot.interests) ||
    JSON.stringify(universities) !== JSON.stringify(savedSnapshot.universities) ||
    JSON.stringify(countries) !== JSON.stringify(savedSnapshot.countries);

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
      });
      setSavedSnapshot({ interests, universities, countries });
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
        className="px-6 py-4 sticky top-0 z-10"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <h1
          className="text-sm font-bold font-space flex items-center gap-2"
          style={{ color: "#FFFFFF" }}
        >
          <Icon icon="solar:settings-bold" width={15} style={{ color: "#E8472A" }} />
          Preferences
        </h1>
        <p className="text-xs font-dm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
          Grad Paddy uses these to personalise search and SOP generation
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-2xl mx-auto space-y-6">
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
          className="sticky bottom-0 px-6 py-3 flex items-center justify-between gap-4"
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
