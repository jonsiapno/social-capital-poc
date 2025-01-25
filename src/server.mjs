import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import { config } from './config/config.mjs';
import smsRouter from './routes/sms.mjs';
import { dbService } from './services/database.mjs';
import { ChromaClient } from 'chromadb';

export async function startServer() {
    const app = express();
    app.set('trust proxy', 1);

    // Initialize ChromaDB client
    const chromaClient = new ChromaClient({
        path: config.chroma.url
    });

    // Middleware setup
    app.use(helmet());
    app.use(rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100
    }));
    app.use(bodyParser.urlencoded({ 
        extended: false,
        verify: (req, res, buf) => {
            req.rawBody = buf;
        }
    }));

    // Routes
    app.use('/sms', smsRouter);

    // Test database connection
    await dbService.testConnection();

    // Test ChromaDB connection
    let retries = 5;
    while (retries > 0) {
        try {
            await chromaClient.heartbeat();
            console.log("Successfully connected to ChromaDB");
            break;
        } catch (error) {
            console.log(`Waiting for ChromaDB to be ready... (${retries} attempts remaining)`);
            retries--;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Start server
    const server = app.listen(config.port, () => {
        console.log(`Server running on port ${config.port} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Received SIGTERM. Performing graceful shutdown...');
        server.close(async () => {
            await dbService.pool.end();
            console.log('Server closed. Exiting process.');
            process.exit(0);
        });
    });
}