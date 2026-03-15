import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface InvoiceData {
  publisherName: string;
  domains: string[];
  month: number;
  year: number;
  totalImpressions: number;
  totalRevenue: number;
  revenueSharePct: number;
  publisherEarnings: number;
  invoiceNumber: string;
  status: string;
}

export async function buildInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const { width } = page.getSize();
  let y = 800;

  const draw = (text: string, size: number, isBold = false) => {
    const f = isBold ? bold : font;
    page.drawText(text, { x: 50, y, size, font: f, color: rgb(0, 0, 0) });
    y -= size + 4;
  };

  draw("INVOICE", 20, true);
  y -= 10;
  draw(`Invoice #: ${data.invoiceNumber}`, 12);
  draw(`Month: ${data.month}/${data.year}`, 12);
  draw(`Status: ${data.status}`, 12);
  y -= 16;
  draw(`Publisher: ${data.publisherName}`, 12, true);
  if (data.domains.length > 0) {
    draw(`Domains: ${data.domains.join(", ")}`, 10);
  }
  y -= 16;
  draw(`Total Impressions: ${data.totalImpressions.toLocaleString()}`, 11);
  draw(`Total Revenue: $${data.totalRevenue.toFixed(2)}`, 11);
  draw(`Revenue Share: ${data.revenueSharePct}%`, 11);
  draw(`Publisher Earnings: $${data.publisherEarnings.toFixed(2)}`, 11, true);

  return doc.save();
}
