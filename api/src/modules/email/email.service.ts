import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import Mailgun from 'mailgun.js';
import FormData from 'form-data';

type MailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private mailgunClient: ReturnType<Mailgun['client']> | null = null;
  private readonly configured: boolean;
  private readonly useMailgun: boolean;

  constructor(private readonly configService: ConfigService) {
    const mailgunKey =
      this.configService.get<string>('email.mailgunApiKey') ?? process.env.MAILGUN_API_KEY;
    const mailgunDomain =
      this.configService.get<string>('email.mailgunDomain') ?? process.env.MAILGUN_DOMAIN;
    this.useMailgun = Boolean(mailgunKey && mailgunDomain);
    if (this.useMailgun) {
      const mailgun = new Mailgun(FormData);
      this.mailgunClient = mailgun.client({
        username: 'api',
        key: mailgunKey!,
        url: this.configService.get<string>('email.mailgunUrl') ?? process.env.MAILGUN_URL,
      });
    }
    const user =
      this.configService.get<string>('email.user') ?? process.env.EMAIL_USER;
    const pass =
      this.configService.get<string>('email.password') ?? process.env.EMAIL_PASSWORD;
    if (!this.useMailgun && Boolean(user && pass)) {
      this.transporter = nodemailer.createTransport({
        host:
          this.configService.get<string>('email.host') ??
          process.env.EMAIL_HOST ??
          'smtp.mailgun.org',
        port:
          this.configService.get<number>('email.port') ??
          Number(process.env.EMAIL_PORT ?? 587),
        secure:
          this.configService.get<boolean>('email.secure') ||
          process.env.EMAIL_SECURE === 'true',
        auth: { user, pass },
      });
    }
    this.configured = this.useMailgun || Boolean(this.transporter);
  }

  private getDefaultFrom(): string {
    return (
      this.configService.get<string>('email.from') ??
      process.env.EMAIL_FROM ??
      'noreply@vit.com'
    );
  }

  private async sendViaMailgun(mailOptions: MailOptions): Promise<{ sent: boolean }> {
    if (!this.mailgunClient) return { sent: false };
    const domain =
      this.configService.get<string>('email.mailgunDomain') ?? process.env.MAILGUN_DOMAIN!;
    const from = mailOptions.from ?? this.getDefaultFrom();
    const toList = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
    const payload = {
      from,
      to: toList,
      subject: mailOptions.subject,
      text: mailOptions.text ?? '',
      html: mailOptions.html ?? '',
    };
    await this.mailgunClient.messages.create(domain, payload as Parameters<typeof this.mailgunClient.messages.create>[1]);
    return { sent: true };
  }

  private async sendViaSmtp(mailOptions: MailOptions): Promise<{ sent: boolean }> {
    if (!this.transporter) {
      console.warn('Email not configured (missing MAILGUN_* or EMAIL_USER/EMAIL_PASSWORD). Skipping send.');
      return { sent: false };
    }
    const from = mailOptions.from ?? this.getDefaultFrom();
    await this.transporter.sendMail({
      ...mailOptions,
      from,
    });
    return { sent: true };
  }

  private async send(mailOptions: MailOptions): Promise<{ sent: boolean }> {
    if (!this.configured) {
      console.warn('Email not configured. Skipping send.');
      return { sent: false };
    }
    try {
      if (this.useMailgun && this.mailgunClient) {
        return await this.sendViaMailgun(mailOptions);
      }
      return await this.sendViaSmtp(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /** Send a simple test email (used by POST /email/test). */
  async sendTestEmail(to: string): Promise<{ sent: boolean }> {
    const subject = 'VIT – Email test';
    const text = `This is a test email from the VIT platform. If you received this, the email system is working.`;
    const html = `<!DOCTYPE html><html><body><p>This is a test email from the <strong>VIT platform</strong>.</p><p>If you received this, the email system is working.</p></body></html>`;
    return this.send({ to, subject, text, html });
  }

  async sendMonthlyReport(
    to: string,
    tenantName: string,
    reportData: {
      period: { startDate: Date; endDate: Date };
      summary: {
        totalIncome: number;
        totalExpenses: number;
        totalPetrolCost: number;
        netIncome: number;
        trips: number;
      };
      topVehicles: Array<{ vehicle: string; totalIncome: number; trips: number }>;
      topDrivers: Array<{ driverName: string; totalIncome: number; trips: number }>;
      fuelEfficiency: Array<{ vehicle: string; kmPerLitre: number }>;
    },
  ) {
    const formatCurrency = (amount: number) => `R ${amount.toFixed(2)}`;
    const formatDate = (date: Date) => date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .summary-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px; }
          .summary-item { padding: 15px; background: #f3f4f6; border-radius: 6px; }
          .summary-label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; }
          .summary-value { font-size: 24px; font-weight: bold; color: #111827; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #14b8a6; color: white; font-weight: 600; }
          tr:hover { background: #f9fafb; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Monthly Financial Report</h1>
            <p>${tenantName}</p>
            <p>${formatDate(reportData.period.startDate)} - ${formatDate(reportData.period.endDate)}</p>
          </div>
          <div class="content">
            <div class="summary-box">
              <h2>Summary</h2>
              <div class="summary-grid">
                <div class="summary-item">
                  <div class="summary-label">Total Income</div>
                  <div class="summary-value">${formatCurrency(reportData.summary.totalIncome)}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Total Expenses</div>
                  <div class="summary-value">${formatCurrency(reportData.summary.totalExpenses)}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Petrol Costs</div>
                  <div class="summary-value">${formatCurrency(reportData.summary.totalPetrolCost)}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Net Income</div>
                  <div class="summary-value" style="color: ${reportData.summary.netIncome >= 0 ? '#059669' : '#dc2626'}">${formatCurrency(reportData.summary.netIncome)}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Total Trips</div>
                  <div class="summary-value">${reportData.summary.trips}</div>
                </div>
              </div>
            </div>

            ${reportData.topVehicles.length > 0 ? `
            <div class="summary-box">
              <h2>Top Performing Vehicles</h2>
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Total Income</th>
                    <th>Trips</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.topVehicles.map(v => `
                    <tr>
                      <td>${v.vehicle}</td>
                      <td>${formatCurrency(v.totalIncome)}</td>
                      <td>${v.trips}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}

            ${reportData.topDrivers.length > 0 ? `
            <div class="summary-box">
              <h2>Top Performing Drivers</h2>
              <table>
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Total Income</th>
                    <th>Trips</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.topDrivers.map(d => `
                    <tr>
                      <td>${d.driverName}</td>
                      <td>${formatCurrency(d.totalIncome)}</td>
                      <td>${d.trips}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}

            ${reportData.fuelEfficiency.length > 0 ? `
            <div class="summary-box">
              <h2>Fuel Efficiency by Vehicle</h2>
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>KM per Litre</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.fuelEfficiency.map(f => `
                    <tr>
                      <td>${f.vehicle}</td>
                      <td>${f.kmPerLitre.toFixed(2)} km/L</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}

            <div class="footer">
              <p>This is an automated monthly report from VIT (Vehicle Income Tracker)</p>
              <p>Generated on ${new Date().toLocaleDateString('en-ZA')}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await this.send({
      to,
      subject: `Monthly Financial Report - ${tenantName} - ${formatDate(reportData.period.startDate)}`,
      html,
    });
    return result;
  }

  async sendPasswordResetEmail(
    to: string,
    userName: string,
    resetUrl: string,
    tenantName: string,
  ) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { margin:0; padding:0; background:#0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.6; color:#111827; }
          .wrapper { width:100%; background:#0f172a; padding:24px 12px; }
          .container { max-width:600px; margin:0 auto; background:#f9fafb; border-radius:16px; overflow:hidden; box-shadow:0 20px 40px rgba(15,23,42,0.35); }
          .header { background: radial-gradient(circle at top left,#22c55e,#14b8a6 40%,#0f172a 100%); color:#f9fafb; padding:28px 24px 20px; text-align:left; }
          .brand-row { display:flex; align-items:center; gap:12px; }
          .brand-title { font-size:22px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; }
          .brand-subtitle { font-size:13px; opacity:0.9; }
          .pill { display:inline-block; margin-top:8px; padding:4px 10px; border-radius:999px; background:rgba(15,23,42,0.55); font-size:11px; text-transform:uppercase; letter-spacing:0.08em; }
          .content { padding:28px 24px 24px; background:#f9fafb; }
          .title { font-size:20px; font-weight:600; margin-bottom:4px; color:#020617; }
          .lead { font-size:14px; color:#4b5563; margin-bottom:18px; }
          .button { display:inline-block; padding:12px 24px; background:#0d9488; color:#ecfeff; text-decoration:none; border-radius:999px; font-weight:600; font-size:14px; box-shadow:0 10px 25px rgba(13,148,136,0.35); }
          .button:hover { background:#0f766e; }
          .link-block { margin-top:18px; font-size:12px; color:#6b7280; word-break:break-all; }
          .warning { background:#fef3c7; border-radius:10px; padding:12px 14px; margin:18px 0; border:1px solid #facc15; font-size:13px; color:#92400e; }
          .footer { padding:18px 24px 24px; text-align:center; color:#9ca3af; font-size:11px; background:#f3f4f6; }
          .logo-circle { width:40px; height:40px; border-radius:50%; background:rgba(15,23,42,0.18); display:flex; align-items:center; justify-content:center; }
          .logo-text { font-size:18px; font-weight:800; letter-spacing:0.06em; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="brand-row">
                <div class="logo-circle">
                  <span class="logo-text">V</span>
                </div>
                <div>
                  <div class="brand-title">Vehicle Income Tracker</div>
                  <div class="brand-subtitle">${tenantName}</div>
                </div>
              </div>
              <div class="pill">Security notification</div>
            </div>
            <div class="content">
              <h1 class="title">Password reset requested</h1>
              <p class="lead">
                Hi ${userName}, we received a request to reset the password for your VIT account.
                If this was you, use the secure button below to choose a new password.
              </p>
              <p style="text-align:center; margin:22px 0;">
                <a href="${resetUrl}" class="button">Reset password</a>
              </p>
              <div class="link-block">
                If the button doesn’t work, copy and paste this link into your browser:<br />
                <span style="color:#0f766e;">${resetUrl}</span>
              </div>
              <div class="warning">
                <strong>Security notice:</strong> This link is valid for 1 hour. If you didn’t request a password
                reset, you can safely ignore this email or contact your administrator.
              </div>
              <p style="font-size:13px; color:#6b7280; margin-top:12px;">
                For your safety, never share this link or your password with anyone.
              </p>
            </div>
            <div class="footer">
              <div>VIT – Vehicle Income Tracker</div>
              <div>Generated on ${new Date().toLocaleDateString('en-ZA')}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to,
      subject: `Password Reset Request - ${tenantName}`,
      html,
    });
  }

  async sendVerificationEmail(
    to: string,
    userName: string,
    verificationUrl: string,
    tenantName: string,
  ) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { margin:0; padding:0; background:#0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.6; color:#111827; }
          .wrapper { width:100%; background:#0f172a; padding:24px 12px; }
          .container { max-width:600px; margin:0 auto; background:#f9fafb; border-radius:16px; overflow:hidden; box-shadow:0 20px 40px rgba(15,23,42,0.35); }
          .header { background: radial-gradient(circle at top left,#22c55e,#14b8a6 40%,#0f172a 100%); color:#f9fafb; padding:28px 24px 20px; text-align:left; }
          .brand-row { display:flex; align-items:center; gap:12px; }
          .brand-title { font-size:22px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; }
          .brand-subtitle { font-size:13px; opacity:0.9; }
          .pill { display:inline-block; margin-top:8px; padding:4px 10px; border-radius:999px; background:rgba(15,23,42,0.55); font-size:11px; text-transform:uppercase; letter-spacing:0.08em; }
          .content { padding:28px 24px 24px; background:#f9fafb; }
          .title { font-size:20px; font-weight:600; margin-bottom:4px; color:#020617; }
          .lead { font-size:14px; color:#4b5563; margin-bottom:18px; }
          .button { display:inline-block; padding:12px 24px; background:#0d9488; color:#ecfeff; text-decoration:none; border-radius:999px; font-weight:600; font-size:14px; box-shadow:0 10px 25px rgba(13,148,136,0.35); }
          .button:hover { background:#0f766e; }
          .link-block { margin-top:18px; font-size:12px; color:#6b7280; word-break:break-all; }
          .info { background:#eff6ff; border-radius:10px; padding:12px 14px; margin:18px 0; border:1px solid #3b82f6; font-size:13px; color:#1d4ed8; }
          .footer { padding:18px 24px 24px; text-align:center; color:#9ca3af; font-size:11px; background:#f3f4f6; }
          .logo-circle { width:40px; height:40px; border-radius:50%; background:rgba(15,23,42,0.18); display:flex; align-items:center; justify-content:center; }
          .logo-text { font-size:18px; font-weight:800; letter-spacing:0.06em; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="brand-row">
                <div class="logo-circle">
                  <span class="logo-text">V</span>
                </div>
                <div>
                  <div class="brand-title">Vehicle Income Tracker</div>
                  <div class="brand-subtitle">${tenantName}</div>
                </div>
              </div>
              <div class="pill">Email verification</div>
            </div>
            <div class="content">
              <h1 class="title">Verify your email address</h1>
              <p class="lead">
                Hello ${userName}, thank you for signing up. Please confirm your email to activate your VIT account
                and start tracking your vehicles and income.
              </p>
              <p style="text-align:center; margin:22px 0;">
                <a href="${verificationUrl}" class="button">Verify email</a>
              </p>
              <div class="link-block">
                If the button doesn’t work, copy and paste this link into your browser:<br />
                <span style="color:#0f766e;">${verificationUrl}</span>
              </div>
              <div class="info">
                <strong>Important:</strong> This verification link will expire in 24 hours. If you didn’t create an
                account, you can safely ignore this email.
              </div>
            </div>
            <div class="footer">
              <div>This is an automated email from VIT (Vehicle Income Tracker)</div>
              <div>Generated on ${new Date().toLocaleDateString('en-ZA')}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to,
      subject: `Verify Your Email - ${tenantName}`,
      html,
    });
  }

  async sendAdminPasswordResetEmail(
    to: string,
    userName: string,
    resetUrl: string,
    appName: string,
  ) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { margin:0; padding:0; background:#0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.6; color:#111827; }
          .wrapper { width:100%; background:#0f172a; padding:24px 12px; }
          .container { max-width:600px; margin:0 auto; background:#f9fafb; border-radius:16px; overflow:hidden; box-shadow:0 20px 40px rgba(15,23,42,0.35); }
          .header { background: radial-gradient(circle at top left,#22c55e,#14b8a6 40%,#0f172a 100%); color:#f9fafb; padding:28px 24px 20px; text-align:left; }
          .brand-row { display:flex; align-items:center; gap:12px; }
          .brand-title { font-size:22px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; }
          .brand-subtitle { font-size:13px; opacity:0.9; }
          .pill { display:inline-block; margin-top:8px; padding:4px 10px; border-radius:999px; background:rgba(15,23,42,0.55); font-size:11px; text-transform:uppercase; letter-spacing:0.08em; }
          .content { padding:28px 24px 24px; background:#f9fafb; }
          .title { font-size:20px; font-weight:600; margin-bottom:4px; color:#020617; }
          .lead { font-size:14px; color:#4b5563; margin-bottom:18px; }
          .button { display:inline-block; padding:12px 24px; background:#0d9488; color:#ecfeff; text-decoration:none; border-radius:999px; font-weight:600; font-size:14px; box-shadow:0 10px 25px rgba(13,148,136,0.35); }
          .button:hover { background:#0f766e; }
          .link-block { margin-top:18px; font-size:12px; color:#6b7280; word-break:break-all; }
          .warning { background:#fef3c7; border-radius:10px; padding:12px 14px; margin:18px 0; border:1px solid #facc15; font-size:13px; color:#92400e; }
          .footer { padding:18px 24px 24px; text-align:center; color:#9ca3af; font-size:11px; background:#f3f4f6; }
          .logo-circle { width:40px; height:40px; border-radius:50%; background:rgba(15,23,42,0.18); display:flex; align-items:center; justify-content:center; }
          .logo-text { font-size:18px; font-weight:800; letter-spacing:0.06em; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="brand-row">
                <div class="logo-circle">
                  <span class="logo-text">V</span>
                </div>
                <div>
                  <div class="brand-title">Vehicle Income Tracker</div>
                  <div class="brand-subtitle">${appName}</div>
                </div>
              </div>
              <div class="pill">Admin security</div>
            </div>
            <div class="content">
              <h1 class="title">Reset your admin password</h1>
              <p class="lead">
                Hello ${userName}, a password reset was requested for your admin account. Use the secure button
                below if you initiated this request.
              </p>
              <p style="text-align:center; margin:22px 0;">
                <a href="${resetUrl}" class="button">Reset admin password</a>
              </p>
              <div class="link-block">
                If the button doesn’t work, copy and paste this link into your browser:<br />
                <span style="color:#0f766e;">${resetUrl}</span>
              </div>
              <div class="warning">
                <strong>Security notice:</strong> This link will expire in 1 hour. If you didn’t request this reset,
                please ignore this email and, if concerned, notify your platform administrator.
              </div>
            </div>
            <div class="footer">
              <div>This is an automated email from VIT (Vehicle Income Tracker)</div>
              <div>Generated on ${new Date().toLocaleDateString('en-ZA')}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to,
      subject: `Password Reset Request - ${appName}`,
      html,
    });
  }

  async sendNewTenantCreatedEmail(
    to: string[],
    tenantName: string,
    tenantSlug: string,
  ) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Tenant Created</h1>
          </div>
          <div class="content">
            <p>A new tenant has been created on the platform.</p>
            <p><strong>Name:</strong> ${tenantName}</p>
            <p><strong>Slug:</strong> ${tenantSlug}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-ZA', { dateStyle: 'long' })}</p>
            <div class="footer">
              <p>This is an automated email from VIT (Vehicle Income Tracker)</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const recipientList = to.filter(Boolean);
    if (recipientList.length === 0) return { sent: 0 };
    let sent = 0;
    for (const email of recipientList) {
      try {
        const r = await this.send({
          to: email,
          subject: `New tenant created: ${tenantName} (${tenantSlug})`,
          html,
        });
        if (r.sent) sent++;
      } catch (error) {
        console.error('Error sending new tenant created email to', email, error);
      }
    }
    return { sent };
  }

  async sendTenantAdminWelcomeEmail(
    to: string,
    userName: string,
    tenantName: string,
    loginUrl: string,
  ) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #14b8a6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to VIT</h1>
            <p>Tenant Admin Account</p>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Your tenant admin account has been created for <strong>${tenantName}</strong>.</p>
            <p>Use the password that was provided to you. You can sign in at:</p>
            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Sign in to Tenant Admin</a>
            </div>
            <p>Or copy and paste this link: <span style="word-break: break-all; color: #14b8a6;">${loginUrl}</span></p>
            <p>If you did not expect this email, please contact your platform administrator.</p>
            <div class="footer">
              <p>This is an automated email from VIT (Vehicle Income Tracker)</p>
              <p>Generated on ${new Date().toLocaleDateString('en-ZA')}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to,
      subject: `Welcome - Your tenant admin account for ${tenantName}`,
      html,
    });
  }

  async sendEmailOtp(to: string, code: string, tenantName: string): Promise<{ sent: boolean }> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { margin:0; padding:0; background:#0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.6; color:#111827; }
          .wrapper { width:100%; background:#0f172a; padding:24px 12px; }
          .container { max-width:600px; margin:0 auto; background:#f9fafb; border-radius:16px; overflow:hidden; box-shadow:0 20px 40px rgba(15,23,42,0.35); }
          .header { background: radial-gradient(circle at top left,#22c55e,#14b8a6 40%,#0f172a 100%); color:#f9fafb; padding:28px 24px 20px; text-align:left; }
          .brand-row { display:flex; align-items:center; gap:12px; }
          .brand-title { font-size:22px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; }
          .brand-subtitle { font-size:13px; opacity:0.9; }
          .pill { display:inline-block; margin-top:8px; padding:4px 10px; border-radius:999px; background:rgba(15,23,42,0.55); font-size:11px; text-transform:uppercase; letter-spacing:0.08em; }
          .content { padding:28px 24px 24px; background:#f9fafb; }
          .title { font-size:20px; font-weight:600; margin-bottom:4px; color:#020617; }
          .lead { font-size:14px; color:#4b5563; margin-bottom:18px; }
          .code { font-size:28px; font-weight:700; letter-spacing:0.35em; color:#0f766e; padding:16px 12px; background:#ecfeff; border-radius:14px; text-align:center; margin:20px 0; border:1px solid #99f6e4; }
          .footer { padding:18px 24px 24px; text-align:center; color:#9ca3af; font-size:11px; background:#f3f4f6; }
          .warning { background:#fef3c7; border-radius:10px; padding:12px 14px; margin:18px 0; border:1px solid #facc15; font-size:13px; color:#92400e; }
          .logo-circle { width:40px; height:40px; border-radius:50%; background:rgba(15,23,42,0.18); display:flex; align-items:center; justify-content:center; }
          .logo-text { font-size:18px; font-weight:800; letter-spacing:0.06em; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="brand-row">
                <div class="logo-circle">
                  <span class="logo-text">V</span>
                </div>
                <div>
                  <div class="brand-title">Vehicle Income Tracker</div>
                  <div class="brand-subtitle">${tenantName}</div>
                </div>
              </div>
              <div class="pill">Email verification code</div>
            </div>
            <div class="content">
              <h1 class="title">Your one-time verification code</h1>
              <p class="lead">
                Use the code below in the app to verify your email address. For your security, this code is valid
                for 10 minutes only.
              </p>
              <div class="code">${code}</div>
              <div class="warning">
                <strong>Security:</strong> Never share this code with anyone. If you didn’t request it, you can ignore
                this email and your account will remain unchanged.
              </div>
            </div>
            <div class="footer">
              <div>This is an automated email from VIT (Vehicle Income Tracker)</div>
              <div>Generated on ${new Date().toLocaleDateString('en-ZA')}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    return this.send({
      to,
      subject: `Your verification code - ${tenantName}`,
      html,
    });
  }
}

