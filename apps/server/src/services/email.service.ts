import { formatINR, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@shoe-shop/shared';
import nodemailer, { type Transporter } from 'nodemailer';

import { env, features } from '../config/env.js';
import type { OrderDocument } from '../models/Order.js';
import { logger } from '../utils/logger.js';

/**
 * Order emails: a receipt to the customer, an alert to the shop owner.
 *
 * Both are best-effort. An order that was paid for (or a COD order the
 * customer is expecting a call about) must never be lost or fail to appear
 * just because Brevo had a bad minute — every call here catches and logs
 * rather than throwing back into the request that triggered it.
 */

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 is implicit TLS; every other port (587, the Brevo default) upgrades
    // with STARTTLS instead.
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

function money(paise: number): string {
  return formatINR(paise);
}

function orderItemLines(order: OrderDocument): string {
  return order.items
    .map(
      (item) =>
        `  ${item.qty} x ${item.name} (${item.color}, UK ${item.size}) — ${money(item.lineTotalPaise)}`,
    )
    .join('\n');
}

function orderSummaryText(order: OrderDocument): string {
  const lines = [
    `Order ${order.orderNumber}`,
    '',
    orderItemLines(order),
    '',
    `Subtotal: ${money(order.subtotalPaise)}`,
  ];
  if (order.deliveryChargePaise > 0) lines.push(`Delivery: ${money(order.deliveryChargePaise)}`);
  if (order.codChargePaise > 0) lines.push(`Cash on delivery fee: ${money(order.codChargePaise)}`);
  lines.push(
    `Total: ${money(order.totalPaise)}`,
    '',
    `Payment method: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
  );
  return lines.join('\n');
}

export async function sendOrderConfirmationEmail(order: OrderDocument): Promise<void> {
  if (!features.email) return;

  const subject = `Order confirmed — ${order.orderNumber}`;
  const text = [
    `Hi ${order.customer.name},`,
    '',
    'Thanks for your order! Here is a summary:',
    '',
    orderSummaryText(order),
    '',
    'Delivering to:',
    order.customer.address.line1,
    order.customer.address.line2 ?? '',
    `${order.customer.address.city}, ${order.customer.address.state} ${order.customer.address.pincode}`,
    '',
    order.paymentMethod === 'cod'
      ? 'Please keep the amount ready for our delivery partner.'
      : 'Your payment has been received.',
  ]
    .filter((line) => line !== '')
    .join('\n');

  try {
    await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to: order.customer.email,
      subject,
      text,
    });
  } catch (error) {
    logger.warn(
      { err: error, orderNumber: order.orderNumber },
      'Could not send order confirmation email',
    );
  }
}

export async function sendOwnerNewOrderAlert(order: OrderDocument): Promise<void> {
  if (!features.email || !env.OWNER_EMAIL) return;

  const subject = `New order — ${order.orderNumber} (${money(order.totalPaise)})`;
  const text = [
    orderSummaryText(order),
    '',
    `Customer: ${order.customer.name} — ${order.customer.phone} — ${order.customer.email}`,
    '',
    'Delivering to:',
    order.customer.address.line1,
    order.customer.address.line2 ?? '',
    `${order.customer.address.city}, ${order.customer.address.state} ${order.customer.address.pincode}`,
    order.notes ? `\nCustomer note: ${order.notes}` : '',
  ]
    .filter((line) => line !== '')
    .join('\n');

  try {
    await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to: env.OWNER_EMAIL,
      subject,
      text,
    });
  } catch (error) {
    logger.warn(
      { err: error, orderNumber: order.orderNumber },
      'Could not send new-order alert email',
    );
  }
}

/** Sent when an admin moves an order forward — "packed", "shipped", "delivered". */
export async function sendOrderStatusEmail(order: OrderDocument): Promise<void> {
  if (!features.email) return;

  const label = ORDER_STATUS_LABELS[order.status];
  const subject = `Order ${order.orderNumber}: ${label}`;
  const text = `Hi ${order.customer.name},\n\nYour order ${order.orderNumber} is now: ${label}.`;

  try {
    await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to: order.customer.email,
      subject,
      text,
    });
  } catch (error) {
    logger.warn(
      { err: error, orderNumber: order.orderNumber },
      'Could not send order status email',
    );
  }
}
