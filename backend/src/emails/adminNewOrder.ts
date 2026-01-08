/**
 * Admin New Order Email Template
 *
 * Sent to admin when a new order is placed.
 * Content is in French.
 */

import type { OrderWithItems } from "../services/emailService";

// ============================================================================
// Configuration
// ============================================================================

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} TND`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-TN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "En attente",
    pending_payment: "En attente de paiement",
    paid: "Payé ✅",
    failed: "Échoué ❌",
  };
  return labels[status] || status;
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

export interface AdminNewOrderParams {
  order: OrderWithItems;
  shippingFee: number;
}

export function buildAdminNewOrderHtml({ order, shippingFee }: AdminNewOrderParams): string {
  const customerName = escapeHtml(order.name) || "—";
  const orderDate = formatDate(order.createdAt);
  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Build items table rows
  const itemRows = order.items
    .map((item) => {
      const variant = buildVariantString(item);
      const subtotal = item.price * item.quantity;
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
            <strong style="color: #0f172a;">${escapeHtml(item.product.title)}</strong>
            ${variant ? `<br><span style="color: #64748b; font-size: 11px;">${escapeHtml(variant)}</span>` : ""}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #475569;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #0f172a;">${formatCurrency(item.price)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #0f172a;">${formatCurrency(subtotal)}</td>
        </tr>
      `;
    })
    .join("");

  // Payment status color
  const statusColors: Record<string, string> = {
    pending: "#f59e0b",
    pending_payment: "#f59e0b",
    paid: "#10b981",
    failed: "#ef4444",
  };
  const statusColor = statusColors[order.paymentStatus] || "#6b7280";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouvelle commande #${order.id}</title>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px; text-align: center;">
              <span style="background-color: #fbbf24; color: #0f172a; font-size: 11px; font-weight: bold; padding: 4px 12px; border-radius: 12px; display: inline-block; margin-bottom: 12px; letter-spacing: 1px;">🔔 NOUVELLE COMMANDE</span>
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0 0 8px 0;">Commande #${order.id}</h1>
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">${orderDate}</p>
            </td>
          </tr>
          
          <!-- Quick Stats -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="text-align: center;">
                    <p style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; margin: 0 0 4px 0;">Total</p>
                    <p style="color: #0f172a; font-size: 18px; font-weight: bold; margin: 0;">${formatCurrency(order.total)}</p>
                  </td>
                  <td width="33%" style="text-align: center;">
                    <p style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; margin: 0 0 4px 0;">Articles</p>
                    <p style="color: #0f172a; font-size: 18px; font-weight: bold; margin: 0;">${totalItems}</p>
                  </td>
                  <td width="33%" style="text-align: center;">
                    <p style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; margin: 0 0 4px 0;">Paiement</p>
                    <p style="color: ${statusColor}; font-size: 18px; font-weight: bold; margin: 0;">${getPaymentStatusLabel(order.paymentStatus)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Customer Info -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #e2e8f0;">
              <h3 style="color: #0f172a; font-size: 14px; font-weight: 600; margin: 0 0 16px 0; text-transform: uppercase;">👤 Informations Client</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                <tr>
                  <td style="color: #64748b; padding: 8px 16px 8px 0; width: 120px;">Nom</td>
                  <td style="color: #0f172a; padding: 8px 0;">${customerName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 8px 16px 8px 0;">Email</td>
                  <td style="color: #0f172a; padding: 8px 0;"><a href="mailto:${escapeHtml(order.email)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(order.email) || "—"}</a></td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 8px 16px 8px 0;">Téléphone</td>
                  <td style="color: #0f172a; padding: 8px 0;"><a href="tel:${escapeHtml(order.phone)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(order.phone) || "—"}</a></td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 8px 16px 8px 0;">Adresse</td>
                  <td style="color: #0f172a; padding: 8px 0;">${escapeHtml(order.address) || "—"}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 8px 16px 8px 0;">Région</td>
                  <td style="color: #0f172a; padding: 8px 0;">${escapeHtml(order.region) || "—"}</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Payment Info -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #e2e8f0;">
              <h3 style="color: #0f172a; font-size: 14px; font-weight: 600; margin: 0 0 16px 0; text-transform: uppercase;">💳 Paiement</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                <tr>
                  <td style="color: #64748b; padding: 8px 16px 8px 0; width: 120px;">Méthode</td>
                  <td style="color: #0f172a; padding: 8px 0;">${getPaymentMethodLabel(order.paymentMethod)}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 8px 16px 8px 0;">Statut paiement</td>
                  <td style="color: ${statusColor}; padding: 8px 0; font-weight: bold;">${getPaymentStatusLabel(order.paymentStatus)}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 8px 16px 8px 0;">Statut commande</td>
                  <td style="color: #0f172a; padding: 8px 0;">${escapeHtml(order.status)}</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Products -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #e2e8f0;">
              <h3 style="color: #0f172a; font-size: 14px; font-weight: 600; margin: 0 0 16px 0; text-transform: uppercase;">📦 Produits commandés</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f1f5f9;">
                    <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #475569; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Produit</th>
                    <th style="padding: 10px 12px; text-align: center; font-size: 11px; color: #475569; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Qté</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 11px; color: #475569; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Prix unit.</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 11px; color: #475569; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Sous-total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="padding: 12px; text-align: right; color: #64748b; border-top: 1px solid #e2e8f0;">Sous-total</td>
                    <td style="padding: 12px; text-align: right; color: #0f172a; border-top: 1px solid #e2e8f0;">${formatCurrency(subtotal)}</td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding: 12px; text-align: right; color: #64748b;">Livraison</td>
                    <td style="padding: 12px; text-align: right; color: ${shippingFee === 0 ? '#10b981' : '#0f172a'}; font-weight: ${shippingFee === 0 ? 'bold' : 'normal'};">${shippingFee === 0 ? 'Gratuite ✅' : formatCurrency(shippingFee)}</td>
                  </tr>
                  <tr>
                    <td colspan="3" style="background-color: #0f172a; color: #ffffff; font-size: 12px; font-weight: bold; padding: 12px; text-align: right;">TOTAL</td>
                    <td style="background-color: #0f172a; color: #fbbf24; font-size: 16px; font-weight: bold; padding: 12px; text-align: right;">${formatCurrency(order.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>
          
          <!-- Action Button -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <a href="${FRONTEND_URL}/admin/orders" style="background-color: #2563eb; border-radius: 6px; color: #ffffff; display: inline-block; font-size: 14px; font-weight: 600; padding: 12px 24px; text-decoration: none;">Voir dans l'admin →</a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 11px; margin: 0 0 4px 0;">Cet email a été envoyé automatiquement par le système FOLLA.</p>
              <p style="color: #94a3b8; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} FOLLA - Artisanat Tunisien</p>
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

export function buildAdminNewOrderText({ order, shippingFee }: AdminNewOrderParams): string {
  const customerName = order.name || "—";
  const orderDate = formatDate(order.createdAt);
  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const itemsList = order.items
    .map((item) => {
      const variant = buildVariantString(item);
      const itemSubtotal = item.price * item.quantity;
      return `  ${item.product.title}${variant ? ` (${variant})` : ""} | Qté: ${item.quantity} | ${formatCurrency(item.price)} | Sous-total: ${formatCurrency(itemSubtotal)}`;
    })
    .join("\n");

  return `
🔔 NOUVELLE COMMANDE #${order.id}
Date: ${orderDate}

=== RÉSUMÉ ===
Sous-total: ${formatCurrency(subtotal)}
Livraison: ${shippingFee === 0 ? 'Gratuite ✅' : formatCurrency(shippingFee)}
Total: ${formatCurrency(order.total)}
Articles: ${totalItems}
Paiement: ${getPaymentStatusLabel(order.paymentStatus)}

=== CLIENT ===
Nom: ${customerName}
Email: ${order.email || "—"}
Téléphone: ${order.phone || "—"}
Adresse: ${order.address || "—"}
Région: ${order.region || "—"}

=== PAIEMENT ===
Méthode: ${getPaymentMethodLabel(order.paymentMethod)}
Statut paiement: ${getPaymentStatusLabel(order.paymentStatus)}
Statut commande: ${order.status}

=== PRODUITS ===
${itemsList}

Sous-total: ${formatCurrency(subtotal)}
Livraison: ${shippingFee === 0 ? 'Gratuite' : formatCurrency(shippingFee)}
TOTAL: ${formatCurrency(order.total)}

---
Voir dans l'admin: ${FRONTEND_URL}/admin/orders
© ${new Date().getFullYear()} FOLLA - Artisanat Tunisien
  `.trim();
}
