import Link from "next/link";

const APP_NAME = "Grad Paddy";
const CONTACT_EMAIL = "olamidebalogun174@gmail.com";
const LAST_UPDATED = "June 8, 2026";
const HACKATHON_URL = "https://rapid-agent.devpost.com/";

export const metadata = {
  title: "Terms of Service | Grad Paddy",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated={LAST_UPDATED}>
      <div className="hackathon-note">
        {APP_NAME} is a project built for the{" "}
        <a href={HACKATHON_URL} target="_blank" rel="noopener noreferrer">
          RapidAgent Hackathon
        </a>{" "}
        organized by Google.
      </div>

      <p>
        These terms govern your use of {APP_NAME} (the &ldquo;Service&rdquo;). By using the Service
        you agree to them. If you do not agree, do not use the Service.
      </p>

      <H>The Service</H>
      <p>
        {APP_NAME} helps students manage graduate school applications: tracking deadlines, drafting
        documents, organizing faculty shortlists, and, if you connect Google, adding deadlines to
        your calendar and sending application emails from your Gmail. AI-generated content is a
        drafting aid; you are responsible for reviewing it before use.
      </p>

      <H>Your account</H>
      <p>
        You sign in with Google and are responsible for activity under your account. You must
        provide accurate information and use the Service lawfully.
      </p>

      <H>Connecting Google</H>
      <p>
        Connecting Google is optional. We act on your Google account only on your explicit action,
        such as creating a calendar event you request or sending an email you composed and approved.
        You can revoke access anytime in Settings or via your Google Account permissions.
      </p>

      <H>Acceptable use</H>
      <ul>
        <li>Do not send spam, harassment, or unlawful content through the Service.</li>
        <li>Do not misrepresent your identity to recommenders or faculty.</li>
        <li>Do not attempt to disrupt, reverse-engineer, or abuse the Service.</li>
      </ul>

      <H>Content</H>
      <p>
        You own the content you create (drafts, resumes, emails). You grant us a limited license to
        store and process it solely to provide the Service. See our{" "}
        <Link href="/privacy">Privacy Policy</Link> for how data is handled.
      </p>

      <H>Disclaimers</H>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties. We do not guarantee
        admission outcomes, the accuracy of AI-generated drafts, or uninterrupted availability. To
        the maximum extent permitted by law, we are not liable for indirect or consequential
        damages.
      </p>

      <H>Changes &amp; termination</H>
      <p>
        We may update these terms or the Service, and may suspend access for violations. Continued
        use after changes means you accept them. You may stop using the Service at any time.
      </p>

      <H>Contact</H>
      <p>
        Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
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
