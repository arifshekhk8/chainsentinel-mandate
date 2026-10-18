import { Worker } from 'node:worker_threads';
import { parse } from 'csv-parse/sync';
import { keccak256 } from 'ethers';
import { AppError, check } from './errors.mjs';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const REQUIRED_COLUMNS = ['vendor_reference', 'invoice_number', 'amount', 'currency', 'invoice_date', 'due_date'];
export const FIELD_NAMES = [...REQUIRED_COLUMNS, 'recipient', 'owner_priority', 'not_before', 'expires_at', 'note'];
const PDF_LABELS = { 'Vendor reference': 'vendor_reference', 'Invoice number': 'invoice_number',
  Amount: 'amount', Currency: 'currency', 'Invoice date': 'invoice_date', 'Due date': 'due_date',
  Recipient: 'recipient', Priority: 'owner_priority', 'Not before': 'not_before', 'Expires at': 'expires_at' };

function extractPdf(buffer) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pdf-worker.mjs', import.meta.url), { workerData: buffer,
      resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 } });
    const timer = setTimeout(() => { worker.terminate(); reject(new AppError('PDF processing timed out; use a smaller text PDF or CSV.')); }, 10000);
    const finish = (error, text) => { clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(text); };
    worker.once('message', (value) => finish(value.error ? new AppError(value.error) : null, value.text));
    worker.once('error', () => finish(new AppError('Could not safely process this PDF. Use a smaller text PDF or CSV.')));
    worker.once('exit', (code) => { if (code !== 0) finish(new AppError('PDF processing stopped; use a smaller text PDF or CSV.')); });
  });
}

export async function parseUpload(filename, buffer) {
  check(buffer.length > 0, 'The file is empty.');
  check(buffer.length <= MAX_FILE_BYTES, 'Files must be 5 MB or smaller.', 413);
  const safeName = String(filename).split(/[\\/]/).at(-1).replace(/[\x00-\x1f]/g, '').slice(0, 120);
  const ext = safeName.toLowerCase().split('.').at(-1);
  check(['csv', 'pdf'].includes(ext), 'Upload a CSV or text PDF. Other file types are not supported.');
  let sourceText, records;
  if (ext === 'pdf') {
    check(buffer.subarray(0, 5).toString() === '%PDF-', 'The file is not a valid PDF.');
    sourceText = await extractPdf(buffer);
    const fields = Object.fromEntries(FIELD_NAMES.map((key) => [key, '']));
    const seen = new Set();
    const repeated = [];
    for (const line of sourceText.split(/\r?\n/)) {
      const separator = line.indexOf(':');
      const label = line.slice(0, separator).trim();
      const key = Object.hasOwn(PDF_LABELS, label) ? PDF_LABELS[label] : undefined;
      if (separator < 0 || !key) continue;
      if (seen.has(key)) { fields[key] = ''; repeated.push(key); }
      else { fields[key] = line.slice(separator + 1).trim(); seen.add(key); }
    }
    // Unknown layouts remain editable drafts. Never guess fields from prose or instructions.
    records = [{ fields, extractionWarnings: repeated.map((key) => `Repeated ${key}: review the original and enter the correct value.`) }];
  } else {
    try { sourceText = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw new AppError('CSV must be valid UTF-8 text.'); }
    check(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(sourceText), 'CSV contains binary/control data.');
    check(sourceText.length <= 200000, 'CSV text is too large; use at most 50 short bill records.');
    try {
      const rows = parse(sourceText, { bom: true, skip_empty_lines: true, max_record_size: 10000 });
      const headers = rows.shift()?.map((value) => value.trim());
      check(headers && REQUIRED_COLUMNS.every((key) => headers.includes(key)), `CSV needs these headers: ${REQUIRED_COLUMNS.join(', ')}.`);
      check(headers.length === new Set(headers).size && headers.every((key) => FIELD_NAMES.includes(key)), 'CSV headers are repeated or unsupported.');
      check(rows.length >= 1 && rows.length <= 50, 'Use 1–50 bill rows per CSV.');
      records = rows.map((row) => {
        check(row.length === headers.length, 'Every CSV row must match its headers.');
        return { fields: Object.fromEntries(FIELD_NAMES.map((key) => [key, row[headers.indexOf(key)]?.trim() ?? ''])), extractionWarnings: [] };
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Malformed CSV. Check quotes, headers and the number of columns.');
    }
  }
  for (const record of records) for (const [key, value] of Object.entries(record.fields)) {
    check(value.length <= (key === 'note' ? 6000 : 200), `The ${key} field is too long.`);
  }
  return { filename: safeName, hash: keccak256(buffer), sourceText, records };
}
