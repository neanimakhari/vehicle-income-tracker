import { requireAuth } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft, HelpCircle, MessageCircle, Book, Mail, Search, ChevronRight } from "lucide-react";

export default async function HelpPage() {
  await requireAuth();
  
  const faqs = [
    {
      question: "How do I add a new driver?",
      answer: "Navigate to the Drivers page and click 'Add Driver'. Fill in the required information including name, email, and password. You can also upload driver documents and profile pictures."
    },
    {
      question: "How do I generate reports?",
      answer: "Go to the Reports page to view analytics and generate custom reports. You can filter by date range, export data, and schedule monthly email reports."
    },
    {
      question: "How do I reset a driver's password?",
      answer: "Currently, password reset must be done through the API or database. A forgot password feature is coming soon. Contact support for assistance."
    },
    {
      question: "What is MFA and why is it required?",
      answer: "Multi-Factor Authentication (MFA) adds an extra layer of security. If your tenant requires MFA, drivers must set it up before they can log in. You can check MFA status on the Drivers page."
    },
    {
      question: "How do I manage vehicles?",
      answer: "Go to the Vehicles page to add, edit, or disable vehicles. Vehicle information is used for income tracking and maintenance scheduling."
    },
    {
      question: "Can I export data?",
      answer: "Yes, you can export reports and data from the Reports page. Custom reports can be downloaded as JSON, and monthly reports are sent via email."
    },
    {
      question: "How do I set up maintenance reminders?",
      answer: "Navigate to the Maintenance page and create a new maintenance task. Set the due date or due KM, and the system will track progress based on vehicle usage."
    },
    {
      question: "What should I do if a driver can't log in?",
      answer: "Check if the driver account is active, verify MFA requirements, and ensure the device is approved (if device allowlist is enabled). Contact support if issues persist."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-lg bg-teal-100 dark:bg-teal-900/30">
            <HelpCircle className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Help & Support
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Get help with using VIT Tenant Admin
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/help#faq"
          className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-teal-500 dark:hover:border-teal-500 transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <Book className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">FAQ</h3>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Frequently asked questions and answers
          </p>
          <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 mt-2" />
        </Link>

        <Link
          href="/help#contact"
          className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-teal-500 dark:hover:border-teal-500 transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <MessageCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Contact Support</h3>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Get in touch with our support team
          </p>
          <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 mt-2" />
        </Link>

        <Link
          href="/privacy"
          className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-teal-500 dark:hover:border-teal-500 transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <Search className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Documentation</h3>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Privacy Policy and Terms of Service
          </p>
          <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 mt-2" />
        </Link>
      </div>

      {/* FAQ Section */}
      <section id="faq" className="mb-8">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6"
            >
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                {faq.question}
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Contact Support
          </h2>
        </div>
        <div className="space-y-4 text-zinc-700 dark:text-zinc-300">
          <p>
            Need additional help? Our support team is here to assist you.
          </p>
          <div className="space-y-2">
            <p><strong>Email:</strong> support@vit.com</p>
            <p><strong>Response Time:</strong> Within 24 hours during business days</p>
            <p><strong>Hours:</strong> Monday - Friday, 9:00 AM - 5:00 PM</p>
          </div>
          <div className="mt-6 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
            <p className="text-sm text-teal-900 dark:text-teal-100">
              <strong>Tip:</strong> Before contacting support, check the FAQ section above. Many common questions are answered there.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

