import dotenv from 'dotenv';

dotenv.config();

/**
 * Decodes the environment variables into a JSON object which organizes them by type
 */
export const config = {
    port: process.env.PORT || 3000,
    openai: {
        apiKey: process.env.OPENAI_API_KEY
    },
    chroma: {
        url: process.env.CHROMA_URL || "http://chroma:8000"
    },
    mysql: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    },
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN
    }
};
