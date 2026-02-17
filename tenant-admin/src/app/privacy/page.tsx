import { requireAuth } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, FileText } from "lucide-react";

export default async function PrivacyPolicyPage() {
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
            <Shield className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Privacy Policy
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              1. Introduction
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Welcome to VIT (Vehicle Income Tracker). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              2. Information We Collect
            </h2>
            <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
              <div>
                <h3 className="font-semibold mb-2">Personal Information</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Name, email address, and phone number</li>
                  <li>Driver license information and PRDP details</li>
                  <li>Banking information for payment processing</li>
                  <li>Profile pictures and documents</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Usage Data</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Income and expense records</li>
                  <li>Vehicle and trip information</li>
                  <li>Device information and IP addresses</li>
                  <li>Login history and authentication data</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
              <li>To provide and maintain our services</li>
              <li>To process transactions and manage accounts</li>
              <li>To send important notifications and updates</li>
              <li>To improve our services and user experience</li>
              <li>To comply with legal obligations</li>
              <li>To detect and prevent fraud or security issues</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              4. Data Security
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
              <li>Encryption of data in transit and at rest</li>
              <li>Multi-factor authentication (MFA) support</li>
              <li>Biometric authentication options</li>
              <li>Regular security audits and updates</li>
              <li>Access controls and role-based permissions</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              5. Data Retention
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Financial records are retained according to applicable accounting and tax regulations. You may request deletion of your data subject to legal requirements.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              6. Your Rights (GDPR Compliance)
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
              Under GDPR and other data protection laws, you have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300 ml-4">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
              <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong>Objection:</strong> Object to processing of your data</li>
              <li><strong>Restriction:</strong> Request restriction of processing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              7. Cookies and Tracking
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We use cookies and similar technologies to maintain your session, remember your preferences, and improve our services. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              8. Third-Party Services
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We may use third-party services for analytics, email delivery, and cloud storage. These services have their own privacy policies, and we encourage you to review them.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              9. Children's Privacy
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              10. Changes to This Policy
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              11. Contact Us
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              If you have questions about this Privacy Policy or wish to exercise your rights, please contact us through the Help & Support page or your tenant administrator.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

