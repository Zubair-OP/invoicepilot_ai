import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../observability/logger.js";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface CustomSmtpConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  customSmtp?: CustomSmtpConfig;
}

// Lazily constructed transporter so importing this module never requires the
// SMTP credentials. When credentials are absent the send becomes a no-op stub.
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  if (transporter) return transporter;

  const isGmail = (env.SMTP_HOST ?? "smtp.gmail.com").includes("gmail");

  if (isGmail) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  } else {
    const port = Number(env.SMTP_PORT ?? 587);
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  return transporter;
}

/**
 * Sends one email through Nodemailer.
 * Priority:
 * 1. User's custom SMTP configuration (if configured in settings)
 * 2. Platform SMTP (with sender display name and Reply-To set to user's business email)
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  let transport: nodemailer.Transporter | null = null;
  let fromAddress = env.EMAIL_FROM || `"InvoicePilot" <${env.SMTP_USER}>`;

  // 1. Check if the user has provided their own SMTP credentials
  if (params.customSmtp?.user && params.customSmtp?.pass) {
    const isGmail = (params.customSmtp.host ?? "smtp.gmail.com").includes("gmail");
    if (isGmail) {
      transport = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: params.customSmtp.user,
          pass: params.customSmtp.pass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });
    } else {
      const port = Number(params.customSmtp.port ?? 587);
      transport = nodemailer.createTransport({
        host: params.customSmtp.host,
        port,
        secure: port === 465,
        auth: {
          user: params.customSmtp.user,
          pass: params.customSmtp.pass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });
    }
    const senderName = params.fromName || "InvoicePilot";
    fromAddress = `"${senderName}" <${params.customSmtp.user}>`;
  } else {
    // 2. Default platform SMTP
    transport = getTransporter();
    if (params.fromName) {
      const systemUser = env.SMTP_USER || "billing@invoicepilot.com";
      fromAddress = `"${params.fromName}" <${systemUser}>`;
    }
  }

  if (!transport) {
    logger.info(
      { to: params.to, subject: params.subject },
      "[Email Stub] SMTP credentials not set — email not sent"
    );
    return;
  }

  const replyToAddress = params.replyTo || (params.fromEmail ? `"${params.fromName || "Sender"}" <${params.fromEmail}>` : undefined);

  logger.info({ to: params.to, from: fromAddress, replyTo: replyToAddress, subject: params.subject }, "Connecting to SMTP and sending email");

  try {
    const info = await transport.sendMail({
      from: fromAddress,
      to: params.to,
      replyTo: replyToAddress,
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });

    logger.info({ to: params.to, messageId: info.messageId, response: info.response }, "Email sent via Nodemailer");
  } catch (error) {
    logger.error({ to: params.to, err: error }, "Failed to send email via SMTP");
    throw error;
  }
}
