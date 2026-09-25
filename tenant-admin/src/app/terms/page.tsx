import { getAuthToken } from "@/lib/auth";
import Link from "next/link";
import { FileText, Scale, AlertTriangle, CheckCircle } from "lucide-react";

const SUPPORT = "support@vehinc.co.za";

export default async function TermsOfServicePage() {
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
            <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Terms of Service
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Last updated: {updated}
            </p>
          </div>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8 text-zinc-700 dark:text-zinc-300">
          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <Scale className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              1. Acceptance
            </h2>
            <p className="leading-relaxed">
              By accessing VIT (Vehicle Income Tracker), operated by Vehinc, you agree to these
              Terms. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              2. The service
            </h2>
            <p className="leading-relaxed mb-2">
              VIT is a multi-tenant B2B platform for fleet income, expenses, drivers, maintenance,
              reports, and optional GPS tracking / alerts. Features depend on the tenant&apos;s
              plan and configuration.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              3. Accounts
            </h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Keep credentials confidential and notify us of suspected misuse</li>
              <li>Provide accurate information</li>
              <li>Use the service lawfully and only for authorised fleet operations</li>
              <li>Tenant admins are responsible for users they invite and data they load</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              4. Acceptable use
            </h2>
            <p className="leading-relaxed mb-2">You must not:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Break the law or infringe others&apos; rights</li>
              <li>Attempt unauthorised access, disrupt the service, or upload malware</li>
              <li>Impersonate others or misuse panic / alert features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              5. Data
            </h2>
            <p className="leading-relaxed">
              You (or your organisation) retain ownership of data you submit. You grant Vehinc a
              licence to host and process that data to provide VIT. See our{" "}
              <Link href="/privacy" className="text-teal-700 dark:text-teal-300 underline">
                Privacy Policy
              </Link>{" "}
              for POPIA details. You are responsible for the accuracy of data you enter.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              6. Fees and plans
            </h2>
            <p className="leading-relaxed">
              Commercial terms (plans, modules, invoicing) are agreed between Vehinc and the
              customer organisation. VIT does not process public in-app card payments; there is no
              consumer refund checkout in the product.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              7. Availability and liability
            </h2>
            <p className="leading-relaxed">
              We aim for reliable service but do not guarantee uninterrupted operation. To the
              extent permitted by South African law, Vehinc is not liable for indirect or
              consequential loss, including lost profits or data, arising from use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              8. Intellectual property
            </h2>
            <p className="leading-relaxed">
              The VIT software, branding, and documentation remain Vehinc property. You may not
              copy or reverse-engineer the platform except as allowed by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              9. Suspension and termination
            </h2>
            <p className="leading-relaxed">
              We may suspend or terminate access for breach of these Terms, non-payment under a
              commercial agreement, or risk to the platform or other customers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              10. Governing law
            </h2>
            <p className="leading-relaxed">
              These Terms are governed by the laws of the Republic of South Africa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              11. Contact
            </h2>
            <p className="leading-relaxed">
              Questions:{" "}
              <a className="text-teal-700 dark:text-teal-300 underline" href={`mailto:${SUPPORT}`}>
                {SUPPORT}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
