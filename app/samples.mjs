import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export function sampleRows(snapshot) {
  const now = Number(snapshot.now);
  const date = new Date(now * 1000).toISOString().slice(0, 10);
  const later = new Date((now + 86400) * 1000).toISOString().slice(0, 10);
  return [
    ['V-HOST', 'HOST-1001', '200.000000', date, 1],
    ['V-DESIGN', 'ART-2001', '150.000000', later, 2],
    ['V-HOST', 'HOST-1002', '75.000000', date, 3],
  ].map(([vendor_reference, invoice_number, amount, due_date, owner_priority]) => ({
    vendor_reference, invoice_number, amount, currency: 'MDT', invoice_date: date, due_date,
    recipient: snapshot.vendors.find((row) => row.reference === vendor_reference).recipient,
    owner_priority: String(owner_priority), not_before: new Date((now - 300) * 1000).toISOString(),
    expires_at: new Date((now + 86400) * 1000).toISOString(), note: 'Synthetic bill for test-token demonstration.',
  }));
}
export function sampleCsv(snapshot) {
  const rows = sampleRows(snapshot);
  const columns = Object.keys(rows[0]);
  return columns.join(',') + '\n' + rows.map((row) => columns.map((key) => `"${row[key].replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
}
export async function samplePdf(snapshot) {
  const bill = sampleRows(snapshot)[0];
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595, 842]);
  const green = rgb(0.08, 0.23, 0.19);
  page.drawRectangle({ x: 0, y: 732, width: 595, height: 110, color: green });
  page.drawText('HOSTLINE DEMO', { x: 48, y: 787, size: 21, font: bold, color: rgb(1, 1, 1) });
  page.drawText('Synthetic hosting invoice', { x: 48, y: 762, size: 11, font, color: rgb(0.8, 0.9, 0.84) });
  const lines = [
    `Vendor reference: ${bill.vendor_reference}`, `Invoice number: ${bill.invoice_number}`,
    `Amount: ${bill.amount}`, `Currency: ${bill.currency}`, `Invoice date: ${bill.invoice_date}`,
    `Due date: ${bill.due_date}`, `Recipient: ${bill.recipient}`, `Priority: ${bill.owner_priority}`,
    `Not before: ${bill.not_before}`, `Expires at: ${bill.expires_at}`,
  ];
  lines.forEach((line, i) => page.drawText(line, { x: 48, y: 675 - i * 32, size: 11, font, color: green }));
  page.drawLine({ start: { x: 48, y: 280 }, end: { x: 547, y: 280 }, thickness: 1, color: rgb(0.8, 0.84, 0.81) });
  page.drawText('TEST TOKENS ONLY - NO CASH VALUE', { x: 48, y: 250, size: 10, font: bold, color: green });
  page.drawText('Fictional supplier and bill for Mandate / ChainSentinel.', { x: 48, y: 230, size: 10, font });
  return Buffer.from(await pdf.save());
}
