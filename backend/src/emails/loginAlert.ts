/**
 * Login Alert Email Template
 *
 * Sent to users when a login is detected.
 * Content is in French.
 */

// ============================================================================
// Configuration
// ============================================================================

const LOGO_URL = process.env.LOGO_URL || null;

// ============================================================================
// Types
// ============================================================================

export interface LoginAlertParams {
    email: string;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
}

// ============================================================================
// Template Builder
// ============================================================================

export function buildLoginAlertHtml({ email, timestamp, ip, userAgent }: LoginAlertParams): string {
    const formattedDate = timestamp.toLocaleDateString("fr-TN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerte de connexion - FOLLA</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #2563eb; padding: 32px; text-align: center;">
              ${LOGO_URL
            ? `<img src="${LOGO_URL}" alt="FOLLA" width="100" height="auto" style="display: block; margin: 0 auto 16px auto;" />`
            : `<h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: 2px;">FOLLA</h2>`}
              <span style="background-color: #fbbf24; color: #0f172a; font-size: 11px; font-weight: bold; padding: 4px 12px; border-radius: 12px; display: inline-block; letter-spacing: 1px;">🔐 ALERTE DE CONNEXION</span>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #1a1a1a;">
                Nouvelle connexion détectée
              </h1>
              
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #666; line-height: 1.6;">
                Bonjour,<br><br>
                Nous avons détecté une nouvelle connexion à votre compte FOLLA. Si c'était vous, vous pouvez ignorer cet email.
              </p>
              
              <!-- Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
                      <tr>
                        <td style="color: #64748b; padding: 8px 0; width: 120px;">📧 Compte</td>
                        <td style="color: #0f172a; padding: 8px 0; font-weight: 500;">${email}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding: 8px 0;">📅 Date</td>
                        <td style="color: #0f172a; padding: 8px 0;">${formattedDate}</td>
                      </tr>
                      ${ip ? `
                      <tr>
                        <td style="color: #64748b; padding: 8px 0;">🌐 Adresse IP</td>
                        <td style="color: #0f172a; padding: 8px 0; font-family: monospace;">${ip}</td>
                      </tr>
                      ` : ""}
                      ${userAgent ? `
                      <tr>
                        <td style="color: #64748b; padding: 8px 0; vertical-align: top;">💻 Appareil</td>
                        <td style="color: #0f172a; padding: 8px 0; font-size: 12px; word-break: break-all;">${userAgent}</td>
                      </tr>
                      ` : ""}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; font-size: 14px; color: #92400e;">
                      <strong>⚠️ Ce n'était pas vous ?</strong><br>
                      Si vous n'avez pas effectué cette connexion, nous vous recommandons de changer votre mot de passe immédiatement et de contacter notre support.
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; font-size: 14px; color: #999;">
                Cet email a été envoyé automatiquement pour protéger votre compte.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #999;">
                Des questions ? Contactez-nous à <a href="mailto:contact@folla.tn" style="color: #2563eb; text-decoration: none;">contact@folla.tn</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999;">
                © ${new Date().getFullYear()} FOLLA - Artisanat Tunisien
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function buildLoginAlertText({ email, timestamp, ip, userAgent }: LoginAlertParams): string {
    const formattedDate = timestamp.toLocaleDateString("fr-TN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    return `
🔐 ALERTE DE CONNEXION - FOLLA

Nouvelle connexion détectée

Bonjour,

Nous avons détecté une nouvelle connexion à votre compte FOLLA. Si c'était vous, vous pouvez ignorer cet email.

=== DÉTAILS ===
📧 Compte: ${email}
📅 Date: ${formattedDate}
${ip ? `🌐 Adresse IP: ${ip}` : ""}
${userAgent ? `💻 Appareil: ${userAgent}` : ""}

⚠️ CE N'ÉTAIT PAS VOUS ?
Si vous n'avez pas effectué cette connexion, nous vous recommandons de changer votre mot de passe immédiatement et de contacter notre support.

---
Cet email a été envoyé automatiquement pour protéger votre compte.
Des questions ? Contactez-nous à contact@folla.tn
© ${new Date().getFullYear()} FOLLA - Artisanat Tunisien
  `.trim();
}
