/**
 * Order Confirmation Email Template
 *
 * Sent to customers after successful order creation.
 * Content is in French (Tunisian locale).
 */

import type { OrderWithItems } from "../services/emailService";

// ============================================================================
// Configuration
// ============================================================================

const LOGO_URL = process.env.LOGO_URL || null;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4002";

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number): string {
    return `${amount.toFixed(2)} TND`;
}

function getPaymentMethodLabel(method: string | null): string {
    const labels: Record<string, string> = {
        cod: "Paiement à la livraison",
        paymee_card: "Carte bancaire (Paymee)",
        konnect_card: "Carte bancaire (Konnect)",
        card: "Carte bancaire",
        unknown: "Non spécifié",
    };
    return labels[method || "unknown"] || method || "Non spécifié";
}

function escapeHtml(text: string | null | undefined): string {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function buildVariantString(item: OrderWithItems["items"][0]): string {
    const parts: string[] = [];

    if (item.variant) parts.push(item.variant);
    if (item.color) parts.push(`Couleur: ${item.color}`);
    if (item.size) parts.push(`Taille: ${item.size}`);

    if (item.attributes && typeof item.attributes === "object") {
        const attrs = item.attributes as Record<string, any>;
        if (attrs.variantLabel) {
            parts.push(attrs.variantLabel);
        }
    }

    return parts.length > 0 ? parts.join(", ") : "";
}

// ============================================================================
// Template Builder
// ============================================================================

export interface OrderConfirmationParams {
    order: OrderWithItems;
    shippingFee: number;
}

export function buildOrderConfirmationHtml({ order, shippingFee }: OrderConfirmationParams): string {
    const customerName = escapeHtml(order.name) || "Client";

    // Calculate subtotal from items
    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Build product cards
    const productCards = order.items
        .map((item) => {
            const variant = buildVariantString(item);
            const imageUrl = item.product.images?.[0]
                ? item.product.images[0].startsWith("http")
                    ? item.product.images[0]
                    : `${BACKEND_URL}${item.product.images[0]}`
                : "";

            return `
        <tr>
          <td style="padding: 20px 0; border-bottom: 1px solid #eee;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="80" valign="top">
                  ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(item.product.title)}" width="80" height="80" style="border-radius: 8px; object-fit: cover; background-color: #f5f5f5;" />` : '<div style="width: 80px; height: 80px; background-color: #f5f5f5; border-radius: 8px;"></div>'}
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">${escapeHtml(item.product.title)}</p>
                  <p style="margin: 0 0 4px 0; font-size: 14px; color: #666;">${formatCurrency(item.price)}${item.quantity > 1 ? ` × ${item.quantity}` : ""}</p>
                  ${variant ? `<p style="margin: 8px 0 0 0;"><span style="display: inline-block; width: 12px; height: 12px; background-color: #f4a261; border-radius: 50%;"></span> <span style="font-size: 12px; color: #888;">${escapeHtml(variant)}</span></p>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
        })
        .join("");

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation de commande #${order.id}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px;">
          
          <!-- Logo -->
          <tr>
            <td style="padding-bottom: 32px;">
              ${LOGO_URL
            ? `<img src="${LOGO_URL}" alt="FOLLA" width="120" height="auto" style="display: block;" />`
            : `<h2 style="margin: 0; font-size: 28px; font-weight: 700; color: #2d5016; letter-spacing: 2px;">FOLLA</h2>`}
            </td>
          </tr>
          
          <!-- Main Heading -->
          <tr>
            <td style="padding-bottom: 24px;">
              <h1 style="margin: 0; font-size: 42px; font-weight: 700; color: #1a1a1a; line-height: 1.1;">
                Confirmation<br>de commande 🛍️
              </h1>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding-bottom: 8px;">
              <p style="margin: 0; font-size: 16px; color: #1a1a1a;">
                Bonjour ${customerName},
              </p>
            </td>
          </tr>
          
          <!-- Order Info -->
          <tr>
            <td style="padding-bottom: 40px;">
              <p style="margin: 0; font-size: 16px; color: #666; line-height: 1.6;">
                Merci pour votre achat ! Nous avons bien reçu votre commande 
                <strong style="color: #1a1a1a;">N°: ${order.id}</strong>. 
                Nous vous informerons dès son expédition.
              </p>
            </td>
          </tr>
          
          <!-- Order Summary Header -->
          <tr>
            <td style="padding-bottom: 16px;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">
                Récapitulatif de commande
              </h2>
            </td>
          </tr>
          
          <!-- Products -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${productCards}
              </table>
            </td>
          </tr>
          
          <!-- Pricing -->
          <tr>
            <td style="padding-top: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 14px; color: #666;">Sous-total</td>
                        <td style="font-size: 14px; color: #1a1a1a; text-align: right;">${formatCurrency(subtotal)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 14px; color: #666;">Livraison</td>
                        <td style="font-size: 14px; color: #1a1a1a; text-align: right;">${shippingFee > 0 ? formatCurrency(shippingFee) : "Gratuite"}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 16px; font-weight: 600; color: #1a1a1a;">Total</td>
                        <td style="font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: right;">${formatCurrency(order.total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Shipping Info -->
          <tr>
            <td style="padding-top: 32px; padding-bottom: 16px;">
              <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a; text-transform: uppercase; letter-spacing: 0.5px;">
                Adresse de livraison
              </h3>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 32px;">
              <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.6;">
                ${customerName}<br>
                ${escapeHtml(order.address) || "—"}<br>
                ${escapeHtml(order.region) || "—"}<br>
                ${escapeHtml(order.phone) || ""}
              </p>
            </td>
          </tr>
          
          <!-- Payment Method -->
          <tr>
            <td style="padding-bottom: 16px;">
              <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a; text-transform: uppercase; letter-spacing: 0.5px;">
                Mode de paiement
              </h3>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 40px;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                ${getPaymentMethodLabel(order.paymentMethod)}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; border-top: 1px solid #eee; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #999;">
                Des questions ? Contactez-nous à <a href="mailto:contact@folla.tn" style="color: #1a1a1a; text-decoration: underline;">contact@folla.tn</a>
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

export function buildOrderConfirmationText({ order, shippingFee }: OrderConfirmationParams): string {
    const customerName = order.name || "Client";
    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const itemsList = order.items
        .map((item) => {
            const variant = buildVariantString(item);
            return `- ${item.product.title}${variant ? ` (${variant})` : ""}: ${formatCurrency(item.price)} x ${item.quantity}`;
        })
        .join("\n");

    return `
CONFIRMATION DE COMMANDE

Bonjour ${customerName},

Merci pour votre achat ! Nous avons bien reçu votre commande N°: ${order.id}.
Nous vous informerons dès son expédition.

RÉCAPITULATIF DE COMMANDE
${itemsList}

Sous-total: ${formatCurrency(subtotal)}
Livraison: ${shippingFee > 0 ? formatCurrency(shippingFee) : "Gratuite"}
Total: ${formatCurrency(order.total)}

ADRESSE DE LIVRAISON
${customerName}
${order.address || "—"}
${order.region || "—"}
${order.phone || ""}

MODE DE PAIEMENT
${getPaymentMethodLabel(order.paymentMethod)}

---
Des questions ? Contactez-nous à contact@folla.tn
© ${new Date().getFullYear()} FOLLA - Artisanat Tunisien
  `.trim();
}
