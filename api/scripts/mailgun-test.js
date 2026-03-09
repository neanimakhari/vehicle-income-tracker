// Simple standalone Mailgun HTTP API test script.
// Usage:
//   cd api
//   node scripts/mailgun-test.js you@example.com
//
// Reads configuration from environment variables:
//   MAILGUN_API_KEY   - required
//   MAILGUN_DOMAIN    - required
//   MAILGUN_URL       - optional, default https://api.mailgun.net
//   EMAIL_FROM        - optional, default "VIT <noreply@...>"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Mailgun = require('mailgun.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FormData = require('form-data');

async function main() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const baseUrl = process.env.MAILGUN_URL || 'https://api.mailgun.net';
  const to = process.argv[2] || process.env.MAILGUN_TEST_TO;

  if (!apiKey || !domain) {
    console.error('MAILGUN_API_KEY and MAILGUN_DOMAIN must be set in the environment.');
    process.exit(1);
  }

  if (!to) {
    console.error('Usage: node scripts/mailgun-test.js recipient@example.com');
    console.error('Or set MAILGUN_TEST_TO in the environment.');
    process.exit(1);
  }

  const from =
    process.env.EMAIL_FROM ||
    `VIT <noreply@${domain}>`;

  const mailgun = new Mailgun(FormData);
  const client = mailgun.client({
    username: 'api',
    key: apiKey,
    url: baseUrl,
  });

  const subject = 'VIT – Mailgun API test (standalone script)';
  const text =
    'This is a test email sent directly via the Mailgun HTTP API from the VIT droplet.';

  console.log('Using Mailgun API:');
  console.log(`  URL:    ${baseUrl}`);
  console.log(`  Domain: ${domain}`);
  console.log(`  From:   ${from}`);
  console.log(`  To:     ${to}`);

  try {
    const result = await client.messages.create(domain, {
      from,
      to: [to],
      subject,
      text,
    });
    console.log('Mailgun API response:', result);
  } catch (err) {
    console.error('Error calling Mailgun API:', err);
    process.exit(1);
  }
}

main();

