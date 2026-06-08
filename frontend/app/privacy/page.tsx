import Link from "next/link";

const APP_NAME = "Grad Paddy";
const CONTACT_EMAIL = "olamidebalogun174@gmail.com";
const LAST_UPDATED = "June 8, 2026";
const HACKATHON_URL = "https://rapid-agent.devpost.com/";

export const metadata = {
  title: "Privacy Policy | Grad Paddy",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated={LAST_UPDATED}>
      <div className="hackathon-note">
        {APP_NAME} is a project built for the{" "}
        <a href={HACKATHON_URL} target="_blank" rel="noopener noreferrer">
          RapidAgent Hackathon
        </a>{" "}
        organized by Google.
      </div>

      <p>
        {APP_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps students manage graduate school
        applications: tracking deadlines, drafting documents, and contacting faculty and
        recommenders. This policy explains what we collect, how we use it, and your choices.
      </p>

      <H>Information we collect</H>
      <ul>
        <li>
          <B>Account &amp; profile.</B> Your name, email, and photo from Google Sign-In, plus
          preferences you set (research interests, target programs).
        </li>
        <li>
          <B>Application content.</B> Data you create in the app: shortlisted faculty, tracked
          applications and deadlines, drafts (SOPs, narratives), uploaded resumes/CVs, and emails
          you draft.
        </li>
        <li>
          <B>Google services data.</B> If you connect your Google account, we access only what the
          features you use require (see below).
        </li>
      </ul>

      <H>How we use Google user data</H>
      <p>
        Connecting Google is optional and separate from sign-in. We request the minimum scopes for
        two features:
      </p>
      <ul>
        <li>
          <B>
            Gmail (<code>gmail.send</code>).
          </B>{" "}
          Send-only. When you review, edit, and explicitly click &ldquo;Send&rdquo; on a
          faculty-outreach or recommendation-request email, we send that single message from your
          Gmail. We cannot read, search, or modify your mailbox, and we do not retain message bodies
          after sending.
        </li>
        <li>
          <B>
            Google Calendar (<code>calendar.events</code>).
          </B>{" "}
          When you click &ldquo;Add deadline to Google Calendar,&rdquo; we create one event for that
          application deadline with your chosen reminder times, and we update or delete only that
          event if the deadline changes. We do not read, modify, or delete your other calendar
          events.
        </li>
      </ul>

      <H>Limited Use disclosure</H>
      <p>
        {APP_NAME}&rsquo;s use and transfer of information received from Google APIs to any other
        app will adhere to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. We do not use Google user data for advertising,
        sell it, or allow humans to read it except where required for security, to comply with law,
        or with your explicit consent.
      </p>

      <H>Storage &amp; retention</H>
      <p>
        Your account and application data are stored in Google Cloud (Firestore and Storage). We
        retain the Google refresh token only to perform the actions above, and delete it when you
        disconnect Google or your account. We do not store the contents of sent emails after
        delivery.
      </p>

      <H>Sharing</H>
      <p>
        We do not sell your data. We share it only with infrastructure providers (such as Google
        Cloud) that process it on our behalf, or where required by law.
      </p>

      <H>Your choices</H>
      <ul>
        <li>
          Disconnect Google anytime in Settings, Connected accounts (this revokes our access).
        </li>
        <li>Delete drafts, applications, resumes, and emails within the app.</li>
        <li>
          Request account deletion by emailing{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </li>
      </ul>

      <H>Contact</H>
      <p>
        Questions about this policy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalShell>
  );
}

function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full overflow-y-auto" style={{ background: "#F7F0E3" }}>
      <div
        className="px-4 sm:px-8 lg:px-16 py-4"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-sm font-bold font-space" style={{ color: "#FFFFFF" }}>
            {title}
          </h1>
          <Link
            href="/login"
            className="text-xs font-semibold font-space"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Grad Paddy
          </Link>
        </div>
      </div>
      <div className="w-full px-4 sm:px-8 lg:px-16 py-8 legal-prose">
        <p className="text-xs font-mono mb-6" style={{ color: "#9CA3AF" }}>
          Last updated: {updated}
        </p>
        {children}
      </div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold font-space mt-6 mb-2" style={{ color: "#0D0D0D" }}>
      {children}
    </h2>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <span style={{ fontWeight: 700, color: "#0D0D0D" }}>{children}</span>;
}
