import { getAuthToken } from "@/lib/auth";
import Link from "next/link";
import { Shield, Lock, Eye, Server, Scale, Mail } from "lucide-react";

const SUPPORT = "support@vehinc.co.za";
const ADMIN_PUBLIC = "https://vit-admin.vehinc.co.za";

export default async function PrivacyPolicyPage() {
  const token = await getAuthToken();
  const backHref = token ? "/" : "/login";
  const backLabel = token ? "Back to Dashboard" : "Back to Login";
  const updated = new Date().toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mb-6"
      >
        ← {backLabel}
      </Link>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-teal-100 dark:bg-teal-900/30">
            <Shield className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Privacy Policy
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Last updated: {updated}
            </p>
          </div>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8 text-zinc-700 dark:text-zinc-300">
          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <Lock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              1. Who we are
            </h2>
            <p className="leading-relaxed">
              VIT (Vehicle Income Tracker) is operated by <strong>Vehinc</strong>. This notice
              explains how we process personal information when you use the VIT web consoles,
              mobile app, and related APIs. For privacy requests contact{" "}
              <a className="text-teal-700 dark:text-teal-300 underline" href={`mailto:${SUPPORT}`}>
                {SUPPORT}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <Scale className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              2. POPIA and lawful processing
            </h2>
            <p className="leading-relaxed mb-3">
              We process personal information in line with South Africa&apos;s Protection of
              Personal Information Act (POPIA) and, where applicable, other data-protection laws.
              Processing is typically necessary to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Provide fleet income, expense, maintenance, and admin services under a B2B contract</li>
              <li>Secure accounts (login, MFA, sessions)</li>
              <li>Operate GPS tracking and operational alerts where a tenant enables those modules</li>
              <li>Meet legal or regulatory obligations</li>
            </ul>
            <p className="leading-relaxed mt-3">
              Fleet operators (tenants) act as responsible parties for much of the driver and
              vehicle data they load into their tenant workspace; Vehinc hosts and processes that
              data to deliver the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <Eye className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              3. Information we collect
            </h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold mb-1">Account and profile</h3>
                <p>
                  Name, email, phone, role, authentication data, and optional profile picture.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Driver compliance documents</h3>
                <p>
                  Licence / PRDP / medical expiry details and uploaded documents as configured by
                  the tenant.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Operational records</h3>
                <p>
                  Income and expense entries, vehicle details, maintenance tasks, and related
                  receipts or notes.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Location and device (when enabled)</h3>
                <p>
                  GPS / tracker telemetry for vehicles, approximate device information, IP address
                  on login, and push-notification device identifiers.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Banking details (if captured by the tenant)</h3>
                <p>
                  Optional bank fields on driver profiles for the tenant&apos;s payroll or payout
                  processes — not used by Vehinc for card payments (we do not take public card
                  payments in-app).
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              4. How we use information
            </h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Operate and secure the VIT platform</li>
              <li>Send operational emails and push alerts (reports, reminders, tracking, panic)</li>
              <li>Provide support when you contact us</li>
              <li>Improve reliability and prevent abuse</li>
              <li>Comply with law or lawful requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <Server className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              5. Operators and processors
            </h2>
            <p className="leading-relaxed mb-3">
              We use specialised providers to run the product. They only receive what is needed for
              their role:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>OneSignal</strong> — mobile push notifications (device / user identifiers)
              </li>
              <li>
                <strong>SMTP / Mailgun</strong> — transactional and operational email delivery
              </li>
              <li>
                <strong>OpenStreetMap tile servers</strong> — map tiles on Live Tracking (your
                browser/IP may contact OSM when maps load)
              </li>
              <li>
                <strong>Google ML Kit</strong> — on-device OCR in the mobile app when scanning slips
                (processing stays on the device where possible)
              </li>
              <li>
                <strong>UserWay</strong> — optional accessibility widget when enabled for a
                deployment
              </li>
              <li>
                <strong>Hosting / infrastructure</strong> — servers and databases that store tenant
                data
              </li>
            </ul>
            <p className="leading-relaxed mt-3">
              We do <strong>not</strong> use third-party product-analytics or advertising pixels on
              the admin consoles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              6. Cookies
            </h2>
            <p className="leading-relaxed">
              We use essential cookies (or equivalent) to keep you signed in and apply security
              settings. We do not use non-essential marketing cookies on the admin consoles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              7. Security and retention
            </h2>
            <p className="leading-relaxed">
              We use encryption in transit, access controls, optional MFA, and tenant isolation.
              We retain information for as long as the tenant account needs the service and as
              required for legal, tax, or dispute purposes. Tenants control much of the day-to-day
              data lifecycle inside their workspace.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              8. Your rights
            </h2>
            <p className="leading-relaxed mb-3">
              Subject to POPIA and other applicable law, you may request access, correction,
              deletion, or restriction of personal information we hold, or object to certain
              processing. You may also lodge a complaint with the Information Regulator (South
              Africa).
            </p>
            <p className="leading-relaxed">
              To request deletion of your personal information, use our{" "}
              <Link
                href="/privacy/deletion-request"
                className="text-teal-700 dark:text-teal-300 underline"
              >
                data deletion request form
              </Link>{" "}
              or email {SUPPORT}. We aim to respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              9. Children
            </h2>
            <p className="leading-relaxed">
              VIT is a business fleet product for adult drivers and administrators. It is not
              directed at children under 18, and we do not knowingly collect children&apos;s data
              for marketing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              10. Changes
            </h2>
            <p className="leading-relaxed">
              We may update this notice and will revise the &quot;Last updated&quot; date above.
              Material changes may also be communicated in-product or by email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <Mail className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              11. Contact
            </h2>
            <p className="leading-relaxed">
              Vehinc — VIT support:{" "}
              <a className="text-teal-700 dark:text-teal-300 underline" href={`mailto:${SUPPORT}`}>
                {SUPPORT}
              </a>
              . Help:{" "}
              <Link href="/help" className="text-teal-700 dark:text-teal-300 underline">
                {ADMIN_PUBLIC}/help
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
