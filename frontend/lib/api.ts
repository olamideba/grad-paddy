import { auth } from "./firebase";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

async function getToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

type Std<T> = { success: boolean; data: T; message: string };

// ── Users / Preferences ──────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface Preferences {
  research_interests: string[];
  target_countries: string[];
  target_universities: string[];
  degree_type: string;
  funding_required: boolean;
  auto_approve?: boolean;
  reminder_offsets_days?: number[];
}

export const preferencesApi = {
  // Patch only the auto-approve flag, preserving other preferences server-side
  // by merging into the latest values fetched here.
  setAutoApprove: async (value: boolean) => {
    const cur = await usersApi.getPreferences();
    return usersApi.upsertPreferences({ ...cur.data, auto_approve: value });
  },
};

// ── Emails (agent-drafted faculty / recommender emails) ─────────────────────────

export interface Email {
  id: string;
  to: string;
  subject: string;
  body_markdown: string;
  kind: "faculty" | "recommender";
  ref_id: string | null;
  linked_application_id: string | null;
  status: "draft" | "sent";
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export const emailsApi = {
  list: () => request<Std<Email[]>>("/api/emails/"),
  get: (id: string) => request<Std<Email>>(`/api/emails/${id}`),
  update: (id: string, data: { to?: string; subject?: string; body_markdown?: string }) =>
    request<Std<Email>>(`/api/emails/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  send: (id: string) => request<Std<Email>>(`/api/emails/${id}/send`, { method: "POST" }),
  delete: (id: string) =>
    request<Std<{ status: string }>>(`/api/emails/${id}`, { method: "DELETE" }),
};

// ── Integrations (Google: Gmail + Calendar) ─────────────────────────────────────

export interface GoogleStatus {
  connected: boolean;
  email: string | null;
}

export const integrationsApi = {
  googleStatus: () => request<Std<GoogleStatus>>("/api/integrations/google/status"),
  googleAuthUrl: () => request<Std<{ url: string }>>("/api/integrations/google/auth-url"),
  googleDisconnect: () =>
    request<Std<{ status: string }>>("/api/integrations/google", { method: "DELETE" }),
};

export const usersApi = {
  createOrFetch: (email: string, name: string, avatar_url?: string) =>
    request<Std<Profile>>("/api/users/me", {
      method: "POST",
      body: JSON.stringify({ email, name, avatar_url }),
    }),

  getProfile: () => request<Std<Profile>>("/api/users/me"),

  updateProfile: (data: Partial<Pick<Profile, "name" | "avatar_url"> & { onboarded: boolean }>) =>
    request<Std<Profile>>("/api/users/me", { method: "PATCH", body: JSON.stringify(data) }),

  getPreferences: () => request<Std<Preferences>>("/api/users/me/preferences"),

  upsertPreferences: (prefs: Preferences) =>
    request<Std<Preferences>>("/api/users/me/preferences", {
      method: "PUT",
      body: JSON.stringify(prefs),
    }),
};

// ── Shortlist ─────────────────────────────────────────────────────────────────

export interface Faculty {
  id: string;
  name: string;
  university: string;
  department: string;
  email: string | null;
  webpage: string | null;
  research_summary: string | null;
  fit_score: number;
  position_status: string;
  outreach_status: string;
  created_at: string;
  updated_at: string;
}

export interface ShortlistStats {
  total: number;
  open_positions: number;
  contacted: number;
}

export const shortlistApi = {
  list: (filters?: { position_status?: string; outreach_status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.position_status) params.set("position_status", filters.position_status);
    if (filters?.outreach_status) params.set("outreach_status", filters.outreach_status);
    const qs = params.toString();
    return request<Std<Faculty[]>>(`/api/shortlist/${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<Std<Faculty>>(`/api/shortlist/${id}`),
  stats: () => request<Std<ShortlistStats>>("/api/shortlist/stats"),
  add: (data: {
    name: string;
    university: string;
    department: string;
    email?: string;
    webpage?: string;
    research_summary?: string;
    fit_score?: number;
    position_status?: string;
    outreach_status?: string;
  }) => request<Std<Faculty>>("/api/shortlist/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Omit<Faculty, "id" | "created_at" | "updated_at">>) =>
    request<Std<Faculty>>(`/api/shortlist/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateOutreach: (id: string, status: string) =>
    request<Std<{ status: string }>>(`/api/shortlist/${id}/outreach-status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  delete: (id: string) =>
    request<Std<{ status: string }>>(`/api/shortlist/${id}`, { method: "DELETE" }),
};

// ── Tracker ───────────────────────────────────────────────────────────────────

export interface Attachment {
  kind: "sop" | "narrative" | "cv";
  ref_id: string;
  title: string;
}

export interface Application {
  id: string;
  university: string;
  program: string;
  department: string;
  deadline: string;
  status: string;
  sop_status: string;
  cv_status: string;
  recommenders: { name: string; status: string; email?: string }[];
  attachments?: Attachment[];
  funded: string;
  notes: string | null;
  calendar_event_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackerStats {
  sop_ready: number;
  recs_confirmed: number;
  funded_programs: number;
  total: number;
}

export const trackerApi = {
  list: () => request<Std<Application[]>>("/api/tracker/"),
  get: (id: string) => request<Std<Application>>(`/api/tracker/${id}`),
  stats: () => request<Std<TrackerStats>>("/api/tracker/stats"),
  create: (data: {
    university: string;
    program: string;
    department: string;
    deadline?: string;
    status?: string;
    sop_status?: string;
    cv_status?: string;
    recommenders?: { name: string; status: string }[];
    funded?: string;
    notes?: string;
  }) => request<Std<Application>>("/api/tracker/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Omit<Application, "id" | "created_at" | "updated_at">>) =>
    request<Std<Application>>(`/api/tracker/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  updateStatus: (id: string, status: string) =>
    request<Std<{ status: string }>>(`/api/tracker/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  updateSopStatus: (id: string, sop_status: string) =>
    request<Std<{ status: string }>>(`/api/tracker/${id}/sop-status`, {
      method: "PATCH",
      body: JSON.stringify({ sop_status }),
    }),
  updateCvStatus: (id: string, cv_status: string) =>
    request<Std<{ status: string }>>(`/api/tracker/${id}/cv-status`, {
      method: "PATCH",
      body: JSON.stringify({ cv_status }),
    }),
  updateFunded: (id: string, funded: string) =>
    request<Std<{ status: string }>>(`/api/tracker/${id}/funded`, {
      method: "PATCH",
      body: JSON.stringify({ funded }),
    }),
  addRecommender: (id: string, name: string, status = "not_asked") =>
    request<Std<{ status: string }>>(`/api/tracker/${id}/recommenders`, {
      method: "POST",
      body: JSON.stringify({ name, status }),
    }),
  updateRecommenderStatus: (id: string, name: string, status: string) =>
    request<Std<{ status: string }>>(
      `/api/tracker/${id}/recommenders/${encodeURIComponent(name)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    ),
  addAttachment: (id: string, data: { kind: string; ref_id: string; title?: string }) =>
    request<Std<Application>>(`/api/tracker/${id}/attachments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeAttachment: (id: string, ref_id: string) =>
    request<Std<Application>>(`/api/tracker/${id}/attachments/${ref_id}`, { method: "DELETE" }),
  addToCalendar: (id: string) =>
    request<Std<Application>>(`/api/tracker/${id}/calendar`, { method: "POST" }),
  removeFromCalendar: (id: string) =>
    request<Std<Application>>(`/api/tracker/${id}/calendar`, { method: "DELETE" }),
  delete: (id: string) =>
    request<Std<{ status: string }>>(`/api/tracker/${id}`, { method: "DELETE" }),
};

// ── Drafts ────────────────────────────────────────────────────────────────────

export interface Draft {
  id: string;
  type: string;
  title: string;
  content: string;
  word_count: number;
  status: string;
  ai_generated: boolean;
  source_tags: string[];
  linked_faculty_id: string | null;
  linked_application_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftStats {
  total: number;
  approved: number;
  need_review: number;
}

export const draftsApi = {
  list: (filters?: { type?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return request<Std<Draft[]>>(`/api/drafts/${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<Std<Draft>>(`/api/drafts/${id}`),
  stats: () => request<Std<DraftStats>>("/api/drafts/stats"),
  create: (data: {
    type: string;
    title: string;
    content?: string;
    ai_generated?: boolean;
    source_tags?: string[];
    linked_faculty_id?: string;
    linked_application_id?: string;
  }) => request<Std<Draft>>("/api/drafts/", { method: "POST", body: JSON.stringify(data) }),
  updateContent: (id: string, content: string) =>
    request<Std<Draft>>(`/api/drafts/${id}/content`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),
  updateStatus: (id: string, status: string) =>
    request<Std<{ status: string }>>(`/api/drafts/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  delete: (id: string) =>
    request<Std<{ status: string }>>(`/api/drafts/${id}`, { method: "DELETE" }),
};

// ── CVs / resumes ───────────────────────────────────────────────────────────────

export interface CV {
  id: string;
  title: string;
  filename: string;
  content_type: string;
  size: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export const cvsApi = {
  list: () => request<Std<CV[]>>("/api/cvs/"),
  upload: async (file: File, title?: string) => {
    const token = await getToken();
    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    // No Content-Type header — the browser sets the multipart boundary.
    const res = await fetch(`${BASE}/api/cvs/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json() as Promise<Std<CV>>;
  },
  // Fetches the file with auth and returns a blob object URL for viewing/downloading.
  fetchBlobUrl: async (id: string) => {
    const token = await getToken();
    const res = await fetch(`${BASE}/api/cvs/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
  update: (id: string, data: { title?: string; status?: string }) =>
    request<Std<CV>>(`/api/cvs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<Std<{ status: string }>>(`/api/cvs/${id}`, { method: "DELETE" }),
};

// ── Sessions ──────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  title: string;
  user_id: string;
  starred?: boolean;
  group_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: string;
  content: string;
  ag_ui_events: Record<string, unknown>[];
  created_at: string;
}

export const sessionsApi = {
  list: () => request<Std<Session[]>>("/api/sessions/"),
  create: (first_message: string) =>
    request<Std<Session>>("/api/sessions/", {
      method: "POST",
      body: JSON.stringify({ first_message }),
    }),
  get: (id: string) => request<Std<Session>>(`/api/sessions/${id}`),
  delete: (id: string) =>
    request<Std<{ status: string }>>(`/api/sessions/${id}`, { method: "DELETE" }),
  rename: (id: string, title: string) =>
    request<Std<Session>>(`/api/sessions/${id}/rename`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),
  toggleStar: (id: string) =>
    request<Std<Session>>(`/api/sessions/${id}/star`, { method: "PATCH" }),
  setGroup: (id: string, group_id: string | null) =>
    request<Std<Session>>(`/api/sessions/${id}/group`, {
      method: "PATCH",
      body: JSON.stringify({ group_id }),
    }),
  listMessages: (id: string) => request<Std<Message[]>>(`/api/sessions/${id}/messages`),
  createMessage: (id: string, role: string, content: string) =>
    request<Std<Message>>(`/api/sessions/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ role, content }),
    }),
};

export const groupsApi = {
  list: () => request<Std<Group[]>>("/api/groups/"),
  create: (name: string) =>
    request<Std<Group>>("/api/groups/", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  delete: (id: string, deleteSessions: boolean) =>
    request<Std<{ status: string }>>(`/api/groups/${id}?delete_sessions=${deleteSessions}`, {
      method: "DELETE",
    }),
};

// ── HITL ──────────────────────────────────────────────────────────────────────

export type HITLKind = "approval" | "choice" | "input";
export type HITLDecision = "approved" | "rejected";

export interface HITLOption {
  id: string;
  label: string;
}

export interface HITLItem {
  id: string;
  session_id: string;
  run_id: string;
  kind: HITLKind;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  options?: HITLOption[] | null;
  schema?: Record<string, unknown> | null;
  status: string;
  response: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
  expires_at?: string | null;
}

export const hitlApi = {
  getPending: (sessionId: string) =>
    request<Std<HITLItem | null>>(`/api/hitl/sessions/${sessionId}/pending`),
  resolve: (hitlId: string, decision: HITLDecision, response?: Record<string, unknown>) =>
    request<Std<HITLItem>>(`/api/hitl/${hitlId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ decision, response: response ?? null }),
    }),
};
