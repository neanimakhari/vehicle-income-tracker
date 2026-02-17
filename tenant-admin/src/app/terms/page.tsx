import { requireAuth } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft, FileText, Scale, AlertTriangle, CheckCircle } from "lucide-react";

export default async function TermsOfServicePage() {
  await requireAuth();
  
  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-teal-100 dark:bg-teal-900/30">
            <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Terms of Service
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              1. Acceptance of Terms
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              By accessing and using VIT (Vehicle Income Tracker), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              2. Description of Service
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
              VIT is a vehicle income tracking platform that allows:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
              <li>Recording and tracking vehicle income and expenses</li>
              <li>Managing driver profiles and documents</li>
              <li>Generating reports and analytics</li>
              <li>Maintenance scheduling and tracking</li>
              <li>Multi-tenant administration</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              3. User Accounts and Responsibilities
            </h2>
            <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
              <div>
                <h3 className="font-semibold mb-2">Account Creation</h3>
                <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">User Responsibilities</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Provide accurate and complete information</li>
                  <li>Keep your password secure and confidential</li>
                  <li>Notify us immediately of any unauthorized access</li>
                  <li>Comply with all applicable laws and regulations</li>
                  <li>Use the service only for lawful purposes</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              4. Acceptable Use
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
              <li>Use the service for any illegal or unauthorized purpose</li>
              <li>Attempt to gain unauthorized access to the system</li>
              <li>Interfere with or disrupt the service or servers</li>
              <li>Upload malicious code, viruses, or harmful content</li>
              <li>Impersonate any person or entity</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              5. Data and Content
            </h2>
            <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
              <div>
                <h3 className="font-semibold mb-2">Your Data</h3>
                <p>You retain ownership of all data you upload to the platform. You grant us a license to use, store, and process your data to provide the service.</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Data Accuracy</h3>
                <p>You are responsible for the accuracy and completeness of all data you enter. We are not liable for errors in data you provide.</p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              6. Payment and Billing
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              If applicable, payment terms will be specified in your service agreement. You are responsible for all fees associated with your account. We reserve the right to change our pricing with reasonable notice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              7. Service Availability
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We strive to provide reliable service but do not guarantee uninterrupted or error-free operation. We may perform maintenance that temporarily affects service availability. We are not liable for any losses resulting from service interruptions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              8. Intellectual Property
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              The VIT platform, including its design, features, and functionality, is owned by us and protected by intellectual property laws. You may not copy, modify, or create derivative works without our written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              9. Limitation of Liability
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              10. Termination
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
              We may terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties. Upon termination, your right to use the service will cease immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              11. Changes to Terms
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. We will notify users of significant changes. Your continued use of the service after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              12. Governing Law
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              These Terms of Service shall be governed by and construed in accordance with the laws of the jurisdiction in which the service provider operates, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              13. Contact Information
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              For questions about these Terms of Service, please contact us through the Help & Support page or your tenant administrator.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

