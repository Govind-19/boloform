import { Request, Response } from 'express';
import { PDFDocument, rgb } from 'pdf-lib';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const signPdf = async (req: Request, res: Response) => {
    try {
        const { pdfId, signatures, fields } = req.body;

        // Load Original PDF
        // In serverless, we might not have access to client/public easily depending on bundle.
        // Ideally, pass the PDF content from frontend or fetch from URL.
        // Fallback: Try to read from local file if it exists, else throw or use empty/minimal PDF.
        // For this demo, we'll try to find sample.pdf relative to this file, assuming it's bundled.
        // If running in Netlify Function, structure differs. 
        // Best approach for demo: Let's create a blank PDF if file not found, OR rely on a known path.
        // We will try a few paths.

        let pdfBuffer: Buffer;
        const possiblePaths = [
            path.join(__dirname, '../../../client/public/sample.pdf'), // Local dev
            path.join(process.cwd(), 'client/dist/sample.pdf'), // Netlify build (maybe)
            path.join(__dirname, '../../sample.pdf') // If we move it
        ];

        let foundPath = possiblePaths.find(p => fs.existsSync(p));

        if (foundPath) {
            pdfBuffer = fs.readFileSync(foundPath);
        } else {
            // Fallback: If we can't find the file, create a new one to demonstrate it works.
            // In a real app, user would upload the PDF to sign.
            const newDoc = await PDFDocument.create();
            newDoc.addPage([600, 400]);
            pdfBuffer = Buffer.from(await newDoc.save());
        }

        // 2. Hash Original
        const originalHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

        // 3. Load PDF with pdf-lib
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();

        // 4. Process Fields
        // fields: Array of { id, type, x, y, width, height, page, content? }
        const fieldList = fields || [];

        for (const field of fieldList) {
            const pageIndex = field.page - 1;
            if (pageIndex >= pages.length) continue;

            const page = pages[pageIndex];
            const { width: pageWidth, height: pageHeight } = page.getSize();

            const x = (field.x / 100) * pageWidth;
            const hPoints = (field.height / 100) * pageHeight;
            const wPoints = (field.width / 100) * pageWidth;
            const y = pageHeight - ((field.y / 100) * pageHeight) - hPoints;

            if (field.type === 'signature' || field.type === 'image') {
                if (field.content) { // Base64
                    // Embed image
                    let image;
                    try {
                        if (field.content.startsWith('data:image/png')) {
                            image = await pdfDoc.embedPng(field.content);
                        } else if (field.content.startsWith('data:image/jpeg') || field.content.startsWith('data:image/jpg')) {
                            image = await pdfDoc.embedJpg(field.content);
                        }
                    } catch (e) {
                        console.error("Error embedding image", e);
                    }

                    if (image) {
                        const imgDims = image.scaleToFit(wPoints, hPoints);
                        const xOffset = (wPoints - imgDims.width) / 2;
                        const yOffset = (hPoints - imgDims.height) / 2;

                        page.drawImage(image, {
                            x: x + xOffset,
                            y: y + yOffset,
                            width: imgDims.width,
                            height: imgDims.height,
                        });
                    }
                } else {
                    page.drawRectangle({
                        x, y, width: wPoints, height: hPoints,
                        borderColor: rgb(1, 0, 0),
                        borderWidth: 1,
                    });
                }
            } else if (field.type === 'text') {
                page.drawRectangle({
                    x, y, width: wPoints, height: hPoints,
                    borderColor: rgb(0, 0, 1),
                    borderWidth: 1,
                });
                if (field.content) {
                    const fontSize = 12; // Dynamic?
                    page.drawText(field.content, {
                        x: x + 5,
                        y: y + hPoints - 15,
                        size: fontSize,
                    });
                }
            } else if (field.type === 'date') {
                page.drawRectangle({
                    x, y, width: wPoints, height: hPoints,
                    borderColor: rgb(0.96, 0.62, 0.04), // #f59e0b
                    borderWidth: 1,
                    color: rgb(0.96, 0.62, 0.04),
                    opacity: 0.1,
                });
            } else if (field.type === 'radio') {
                const centerX = x + (wPoints / 2);
                const centerY = y + (hPoints / 2);
                const radius = Math.min(wPoints, hPoints) / 2;

                page.drawEllipse({
                    x: centerX,
                    y: centerY,
                    xScale: radius,
                    yScale: radius,
                    borderColor: rgb(0.92, 0.28, 0.6), // #ec4899
                    borderWidth: 1,
                    color: rgb(0.92, 0.28, 0.6),
                    opacity: 0.1,
                });
            }
        }

        // 5. Save Signed PDF
        const signedPdfBytes = await pdfDoc.save();
        const signedPdfBase64 = Buffer.from(signedPdfBytes).toString('base64');

        // 6. Hash Signed PDF
        const signedHash = crypto.createHash('sha256').update(signedPdfBytes).digest('hex');

        // 7. Return Data URI
        // Don't write to file system in Serverless/Vercel/Netlify

        res.json({
            success: true,
            // Return full data URI so frontend can utilize it directly
            url: `data:application/pdf;base64,${signedPdfBase64}`,
            originalHash,
            signedHash
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to sign PDF' });
    }
};
