import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function createSamplePdf() {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const { width, height } = page.getSize();

    // Draw text
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const title = 'BoloForms Signature Engine';
    const subtitle = 'Please sign below:';
    const text = 'This is a sample legal document. It requires a signature to be valid. Ensure the signature is placed correctly within the designated area. This document serves as a test for the signature injection engine.';

    page.drawText(title, {
        x: 50,
        y: height - 100,
        size: 24,
        font: font,
        color: rgb(0, 0.53, 0.71),
    });

    page.drawText(subtitle, {
        x: 50,
        y: height - 150,
        size: 14,
        font: font,
        color: rgb(0, 0, 0),
    });

    page.drawText(text, {
        x: 50,
        y: height - 180,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
        maxWidth: width - 100,
        lineHeight: 14,
    });

    const pdfBytes = await pdfDoc.save();

    // Path to client/public
    const outputPath = path.resolve(__dirname, '../../client/public/sample.pdf');
    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`Generated 1-page PDF at ${outputPath}`);
}

createSamplePdf().catch(console.error);
