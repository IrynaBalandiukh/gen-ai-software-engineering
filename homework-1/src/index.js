import express from 'express';
import transactionRoutes from './routes/transactions.js';
import accountRoutes from './routes/accounts.js';
import { notFound, errorHandler } from './utils/errorHandlers.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/transactions', transactionRoutes);
app.use('/accounts', accountRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Banking Transactions API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
