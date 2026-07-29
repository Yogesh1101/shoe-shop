import { formatINR } from '@shoe-shop/shared';
import PDFDocument from 'pdfkit';

import type { OrderDocument } from '../models/Order.js';
import type { SettingsDocument } from '../models/Settings.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Renders a GST invoice (or, when the shop has GST switched off, a plain bill
 * of supply) as a PDF buffer.
 *
 * Generated on demand rather than stored: Render's free tier disk is
 * ephemeral, and the order document already holds everything the PDF needs —
 * regenerating it is cheap and never goes stale.
 */
export async function generateInvoicePdf(order: OrderDocument, settings: SettingsDocument): Promise<Buffer> {
  if (!order.invoice) {
    throw ApiError.conflict('INVOICE_NOT_READY', 'This order does not have an invoice yet');
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const title = settings.gstEnabled ? 'Tax Invoice' : 'Bill of Supply';

  doc.fontSize(18).text(settings.legalName || settings.shopName, { continued: false });
  doc.fontSize(10).fillColor('#555');
  if (settings.sellerAddress) doc.text(settings.sellerAddress);
  if (settings.gstEnabled && settings.gstin) doc.text(`GSTIN: ${settings.gstin}`);
  doc.fillColor('#000');

  doc.moveDown(1.5);
  doc.fontSize(16).text(title, { align: 'right' });
  doc.fontSize(10).fillColor('#555');
  doc.text(`Invoice #: ${order.invoice.number}`, { align: 'right' });
  doc.text(`Order #: ${order.orderNumber}`, { align: 'right' });
  doc.text(`Date: ${order.invoice.generatedAt.toLocaleDateString('en-IN')}`, { align: 'right' });
  doc.fillColor('#000');

  doc.moveDown(1.5);
  doc.fontSize(11).text('Billed & shipped to', { underline: true });
  doc.fontSize(10);
  doc.text(order.customer.name);
  doc.text(order.customer.address.line1);
  if (order.customer.address.line2) doc.text(order.customer.address.line2);
  doc.text(`${order.customer.address.city}, ${order.customer.address.state} ${order.customer.address.pincode}`);
  doc.text(`Phone: ${order.customer.phone}`);

  doc.moveDown(1.5);

  const columns = { name: 50, hsn: 260, qty: 320, rate: 370, amount: 460 };
  const tableWidth = 500;

  function tableRow(
    y: number,
    values: { name: string; hsn: string; qty: string; rate: string; amount: string },
    options: { bold?: boolean } = {},
  ): void {
    doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    doc.text(values.name, columns.name, y, { width: columns.hsn - columns.name - 8 });
    doc.text(values.hsn, columns.hsn, y, { width: columns.qty - columns.hsn - 8 });
    doc.text(values.qty, columns.qty, y, { width: columns.rate - columns.qty - 8, align: 'right' });
    doc.text(values.rate, columns.rate, y, { width: columns.amount - columns.rate - 8, align: 'right' });
    doc.text(values.amount, columns.amount, y, { width: 50, align: 'right' });
  }

  const headerY = doc.y;
  tableRow(
    headerY,
    { name: 'Item', hsn: 'HSN', qty: 'Qty', rate: 'Unit price', amount: 'Amount' },
    { bold: true },
  );
  doc
    .moveTo(50, headerY + 14)
    .lineTo(50 + tableWidth, headerY + 14)
    .strokeColor('#ccc')
    .stroke();
  doc.y = headerY + 20;

  for (const item of order.items) {
    const y = doc.y;
    tableRow(y, {
      name: `${item.name} (${item.color}, UK ${item.size})`,
      hsn: item.hsnCode,
      qty: String(item.qty),
      rate: formatINR(item.unitPricePaise),
      amount: formatINR(item.lineTotalPaise),
    });
    doc.y = y + 18;
  }

  doc
    .moveTo(50, doc.y + 4)
    .lineTo(50 + tableWidth, doc.y + 4)
    .strokeColor('#ccc')
    .stroke();
  doc.moveDown(1);

  function totalsRow(label: string, value: string, options: { bold?: boolean } = {}): void {
    doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
    const y = doc.y;
    doc.text(label, 300, y, { width: 150, align: 'right' });
    doc.text(value, columns.amount, y, { width: 50, align: 'right' });
    doc.moveDown(0.4);
  }

  totalsRow('Subtotal', formatINR(order.subtotalPaise));
  if (order.deliveryChargePaise > 0) totalsRow('Delivery', formatINR(order.deliveryChargePaise));
  if (order.codChargePaise > 0) totalsRow('Cash on delivery fee', formatINR(order.codChargePaise));
  for (const line of order.tax.lines) totalsRow(line.label, formatINR(line.amountPaise));
  totalsRow('Total', formatINR(order.totalPaise), { bold: true });

  doc.moveDown(2);
  doc
    .fontSize(8)
    .fillColor('#888')
    .text('This is a computer-generated invoice and does not require a signature.', { align: 'center' });

  doc.end();
  return done;
}
