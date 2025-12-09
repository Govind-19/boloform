import { Request, Response } from 'express';
import { PDFDocument, rgb } from 'pdf-lib';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const signPdf = async (req: Request, res: Response) => {
    try {
        const { pdfId, signatures, fields } = req.body;
        // For prototype, we use the sample.pdf or uploaded one. 
        // Assuming pdfId refers to a file we have.
        // "signatures" is an array of { id, imageBase64, x, y, width, height, page }

        // 1. Load Original PDF
        const pdfPath = path.join(__dirname, '../../../client/public/sample.pdf'); // Defaulting to sample for now
        const pdfBuffer = fs.readFileSync(pdfPath);

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
            const page = pages[pageIndex];
            const { width: pageWidth, height: pageHeight } = page.getSize();

            // Coordinates are in %. Convert to PDF points.
            // PDF Origin is Bottom-Left.
            // Web Origin is Top-Left.
            // x = (field.x / 100) * pageWidth
            // y = pageHeight - ((field.y / 100) * pageHeight) - (heightInPoints)

            const x = (field.x / 100) * pageWidth;
            const hPoints = (field.height / 100) * pageHeight;
            const wPoints = (field.width / 100) * pageWidth;
            const y = pageHeight - ((field.y / 100) * pageHeight) - hPoints;

            if (field.type === 'signature' || field.type === 'image') {
                if (field.content) { // Base64
                    // Embed image
                    let image;
                    if (field.content.startsWith('data:image/png')) {
                        image = await pdfDoc.embedPng(field.content);
                    } else if (field.content.startsWith('data:image/jpeg') || field.content.startsWith('data:image/jpg')) {
                        image = await pdfDoc.embedJpg(field.content);
                    }

                    if (image) {
                        // Aspect ratio fit
                        const imgDims = image.scaleToFit(wPoints, hPoints);
                        // Center it in the box
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
                    // Draw placeholder rectangle
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
                // Draw Date placeholder (Orange: #f59e0b -> 0.96, 0.62, 0.04)
                page.drawRectangle({
                    x, y, width: wPoints, height: hPoints,
                    borderColor: rgb(0.96, 0.62, 0.04),
                    borderWidth: 1,
                    color: rgb(0.96, 0.62, 0.04),
                    opacity: 0.1,
                });
            } else if (field.type === 'radio') {
                // Draw Radio placeholder (Pink: #ec4899 -> 0.92, 0.28, 0.6)
                // Draw circle centered in the box
                const centerX = x + (wPoints / 2);
                const centerY = y + (hPoints / 2);
                const radius = Math.min(wPoints, hPoints) / 2;

                page.drawEllipse({
                    x: centerX,
                    y: centerY,
                    xScale: radius,
                    yScale: radius,
                    borderColor: rgb(0.92, 0.28, 0.6),
                    borderWidth: 1,
                    color: rgb(0.92, 0.28, 0.6),
                    opacity: 0.1,
                });
            }
        }

        // 5. Save Signed PDF
        const signedPdfBytes = await pdfDoc.save();

        // 6. Hash Signed PDF
        const signedHash = crypto.createHash('sha256').update(signedPdfBytes).digest('hex');

        // 7. Store in DB (Mock for now, or real MongoDB)
        // await AuditLog.create({ originalHash, signedHash, timestamp: new Date() });

        // 8. Write to file to return URL
        const signedFileName = `signed_${Date.now()}.pdf`;
        const signedPath = path.join(__dirname, '../../../client/public', signedFileName);
        fs.writeFileSync(signedPath, signedPdfBytes);

        res.json({
            success: true,
            url: `/${signedFileName}`,
            originalHash,
            signedHash
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to sign PDF' });
    }
};
