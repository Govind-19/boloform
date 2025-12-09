import express from 'express';
import { signPdf } from '../controllers/pdfController';

const router = express.Router();

router.post('/sign', signPdf);

export default router;
