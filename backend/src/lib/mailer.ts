/**
 * Nodemailer SMTP Mailer using Brevo
 *
 * Reusable email sending module with Brevo SMTP configuration.
 * All SMTP credentials are read from environment variables.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

// ============================================================================
// Types
// ============================================================================

export interface EmailParams {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const SMTP_HOST = process.env.SMTP_HOST || "smtp-relay.brevo.com";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || "Folla <no-reply@folla.tn>";

// ============================================================================
// Transporter Setup
// ============================================================================

let transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;

if (SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: false, // Use STARTTLS (port 587)
        requireTLS: true,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
        // Connection timeout settings
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 30000,
    });

    console.log(`[mailer] ✅ SMTP transporter configured (${SMTP_HOST}:${SMTP_PORT})`);
} else {
    console.warn(
        "[mailer] ⚠️ SMTP credentials not configured (SMTP_USER or SMTP_PASS missing). Email sending is disabled."
    );
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Send an email via Brevo SMTP.
 *
 * @throws Error if SMTP is not configured or sending fails
 */
export async function sendEmail({ to, subject, html, text }: EmailParams): Promise<void> {
    if (!transporter) {
        throw new Error("SMTP not configured (missing SMTP_USER or SMTP_PASS)");
    }

    const info = await transporter.sendMail({
        from: MAIL_FROM,
        to,
        subject,
        html,
        text: text || htmlToPlainText(html),
    });

    console.log(`[mailer] ✅ Email sent to ${to} (messageId: ${info.messageId})`);
}

/**
 * Check if the mailer is configured and ready to send emails.
 */
export function isMailerConfigured(): boolean {
    return transporter !== null;
}

/**
 * Get the configured sender address.
 */
export function getMailFrom(): string {
    return MAIL_FROM;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Basic HTML to plain text conversion for fallback text version.
 */
function htmlToPlainText(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove style tags
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove script tags
        .replace(/<br\s*\/?>/gi, "\n") // Convert br to newlines
        .replace(/<\/p>/gi, "\n\n") // Convert closing p to double newlines
        .replace(/<\/div>/gi, "\n") // Convert closing div to newlines
        .replace(/<\/tr>/gi, "\n") // Convert table rows to newlines
        .replace(/<\/td>/gi, " | ") // Convert table cells to separators
        .replace(/<[^>]+>/g, "") // Remove all other HTML tags
        .replace(/&nbsp;/gi, " ") // Replace &nbsp;
        .replace(/&amp;/gi, "&") // Replace &amp;
        .replace(/&lt;/gi, "<") // Replace &lt;
        .replace(/&gt;/gi, ">") // Replace &gt;
        .replace(/&quot;/gi, '"') // Replace &quot;
        .replace(/&#039;/gi, "'") // Replace &#039;
        .replace(/\n{3,}/g, "\n\n") // Collapse multiple newlines
        .trim();
}
