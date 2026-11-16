import dotenv from 'dotenv';

dotenv.config();

const { default: app } = await import('./app.js');
const { default: connectDB } = await import('./config/db.js');
const { startExpirationJob } = await import('./services/expirationService.js');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    startExpirationJob();

    app.listen(PORT, () => {
      console.log(`SwapDesk server running on port ${PORT}`);
      console.log(`Allowed frontend origin: ${process.env.CLIENT_URL}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
