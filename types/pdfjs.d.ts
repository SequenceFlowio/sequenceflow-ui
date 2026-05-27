declare module "pdfjs-dist/legacy/build/pdf.js";

declare module "pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js";

declare module "pdf-parse" {
  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, unknown>
  ): Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
  export = pdfParse;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, unknown>
  ): Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
  export = pdfParse;
}
