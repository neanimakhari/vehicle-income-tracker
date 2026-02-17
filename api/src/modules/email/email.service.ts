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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #14b8a6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
            <p>${tenantName}</p>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>We received a request to reset your password for your VIT account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #14b8a6;">${resetUrl}</p>
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email or contact support if you have concerns.
            </div>
            <p>If you didn't request a password reset, you can safely ignore this email.</p>
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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #14b8a6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
          .info { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email Address</h1>
            <p>${tenantName}</p>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Thank you for signing up! Please verify your email address to complete your account setup.</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #14b8a6;">${verificationUrl}</p>
            <div class="info">
              <strong>ℹ️ Note:</strong> This verification link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
            </div>
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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #14b8a6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
            <p>${appName}</p>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>We received a request to reset your password for your admin account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #14b8a6;">${resetUrl}</p>
            <div class="warning">
              <strong>Security notice:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email or contact support.
            </div>
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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .code { font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #14b8a6; padding: 16px; background: white; border-radius: 8px; text-align: center; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email verification code</h1>
            <p>${tenantName}</p>
          </div>
          <div class="content">
            <p>Your one-time verification code is:</p>
            <div class="code">${code}</div>
            <p>Enter this code in the app to verify your email. The code expires in 10 minutes.</p>
            <div class="warning">
              <strong>Security:</strong> Never share this code. If you didn't request it, ignore this email.
            </div>
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
      subject: `Your verification code - ${tenantName}`,
      html,
    });
  }
}

