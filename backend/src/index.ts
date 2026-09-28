import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyzeAddress } from './services/scan.js';
import { createCertificatePayload } from './services/certificates.js';
import { generateCopilotExplanation } from './services/explain.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

app.post('/api/scan', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Address is required' });
    const result = await analyzeAddress(address);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/certificates', async (req, res) => {
  try {
    const { scanData, issuerName } = req.body;
    const cert = createCertificatePayload(scanData, issuerName || 'Provenrely Authority');
    res.status(201).json(cert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/explain', async (req, res) => {
  try {
    const { scanData, language } = req.body;
    const explanation = await generateCopilotExplanation(scanData, language);
    res.json(explanation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
