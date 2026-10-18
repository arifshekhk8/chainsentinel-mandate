import { parentPort, workerData } from 'node:worker_threads';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

try {
  const task = getDocument({ data: new Uint8Array(workerData), isEvalSupported: false,
    useSystemFonts: false, disableFontFace: true, useWasm: false, stopAtErrors: true, verbosity: 0 });
  const pdf = await task.promise;
  if (pdf.numPages > 20) throw new Error('Use a PDF with at most 20 pages.');
  let text = '';
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent({ disableNormalization: true });
    for (const item of content.items) {
      if (typeof item.str === 'string') text += item.str + (item.hasEOL ? '\n' : ' ');
      if (text.length > 200000) throw new Error('PDF text is too large; use a smaller bill.');
    }
    text += '\n';
  }
  await task.destroy();
  if (text.trim().length < 20) throw new Error('No readable text. Use a text PDF or CSV; scanned images are not supported.');
  parentPort.postMessage({ text });
} catch (error) {
  const message = /at most|too large|No readable text/.test(error.message) ? error.message
    : 'This PDF is unreadable, encrypted or malformed. Use a readable text PDF or CSV.';
  parentPort.postMessage({ error: message });
}
