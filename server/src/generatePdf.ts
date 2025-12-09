import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function createPdf() {
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const fontSize = 30;

    page.drawText('BoloForms Signature Engine', {
        x: 50,
        y: height - 4 * fontSize,
        size: fontSize,
        font: timesRomanFont,
        color: rgb(0, 0.53, 0.71),
    });

    page.drawText('Please sign below:', {
        x: 50,
        y: height - 6 * fontSize,
        size: 18,
        font: timesRomanFont,
        color: rgb(0, 0, 0),
    });

    // Add some paragraph text to test alignment
    const text = "This is a sample legal document. It requires a signature to be valid. Ensure the signature is placed correctly within the designated area. This document serves as a test for the signature injection engine.";

    page.drawText(text, {
        x: 50,
        y: height - 8 * fontSize,
        size: 12,
        font: timesRomanFont,
        maxWidth: width - 100,
        lineHeight: 18,
    });

    const pdfBytes = await pdfDoc.save();

    // Ensure public dir exists
    const publicDir = path.join(__dirname, '../../client/public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(path.join(publicDir, 'sample.pdf'), pdfBytes);
    console.log('Sample PDF created at client/public/sample.pdf');
}

createPdf();
