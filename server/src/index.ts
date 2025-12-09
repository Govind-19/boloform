import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';

import pdfRoutes from './routes/pdfRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/pdf', pdfRoutes);


mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/boloforms-signature').then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

app.get('/', (req, res) => {
    res.send('Signature Injection Engine API');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
