const { createRequire } = require('module');
const requirePdfParse = createRequire(__filename);

const loadPdfModule = async () => {
  try {
    // Try standard require first
    return requirePdfParse('pdf-parse');
  } catch (err) {
    // If it's an ESM module, we might need to import it
    if (err?.code !== 'ERR_REQUIRE_ESM') {
      throw err;
    }
    return import('pdf-parse');
  }
};

/**
 * Robustly extract text from a PDF buffer, handling different versions of pdf-parse
 * @param {Buffer} pdfBuffer 
 * @returns {Promise<string>}
 */
const extractPdfText = async (pdfBuffer) => {
  const mod = await loadPdfModule();
  
  // 1. Traditional pdf-parse (v1.x) or ESM default export
  const parseFn = mod?.default ?? mod;
  if (typeof parseFn === 'function') {
    const data = await parseFn(pdfBuffer);
    return data?.text ?? '';
  }

  // 2. Newer pdf-parse (v2.x+) which might export a PDFParse class
  const PDFParse = mod?.PDFParse ?? mod?.default?.PDFParse;
  if (typeof PDFParse === 'function') {
    const parser = new PDFParse({ data: pdfBuffer });
    try {
      // getInfo() or getText() depending on what we need
      const result = await parser.getText();
      return result?.text ?? '';
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    }
  }

  throw new Error('PDF parser export not recognized. Ensure pdf-parse is installed correctly.');
};

module.exports = extractPdfText;
