import cron from 'node-cron';
import moment from 'moment-timezone';
import Bottleneck from 'bottleneck';
import { dbService } from '../services/database.mjs';

// Configurable variables
const DAYS_SINCE_LAST_MESSAGE = 7; // You can change this value as needed

// Rate limiting settings
const MAX_CONCURRENT = 5; // Maximum number of concurrent API calls
const MIN_TIME = 200; // Minimum time (in ms) between each API call
const RESERVOIR = 10; // Number of API calls that can be executed during the reservoir refresh period
const RESERVOIR_REFRESH_INTERVAL = 1000; // Time (in ms) after which the reservoir is refreshed

// Create a Bottleneck limiter
const limiter = new Bottleneck({
    maxConcurrent: MAX_CONCURRENT,
    minTime: MIN_TIME,
    reservoir: RESERVOIR, // Initial number of API calls that can be made
    reservoirRefreshAmount: RESERVOIR,
    reservoirRefreshInterval: RESERVOIR_REFRESH_INTERVAL, // Refresh the reservoir every 1 second
    });

    // Function to run every hour
async function scheduledTask() {
    console.log('Cron job started at', new Date());

    // Get the current time in UTC
    const nowUtc = moment.utc();

    try {
        // Query all accounts
        const [accounts] = await dbService.pool.query('SELECT id, timezone FROM accounts');

        // Process accounts using Bottleneck limiter
        const promises = accounts.map((account) =>
        limiter.schedule(async () => {
            const userId = account.id;
            const userTimezone = account.timezone || 'America/Los_Angeles'; // Default timezone

            // Get current time in user's timezone
            const userNow = nowUtc.clone().tz(userTimezone);

            // Check if it's 4:00 PM in user's timezone
            if (userNow.hour() === 16 && userNow.minute() === 0) {
            console.log(`It's 4:00 PM for user ${userId}`);

            // Calculate the start and end of the day for DAYS_SINCE_LAST_MESSAGE days ago
            const daysAgoStart = userNow
                .clone()
                .subtract(DAYS_SINCE_LAST_MESSAGE, 'days')
                .startOf('day');
            const daysAgoEnd = userNow
                .clone()
                .subtract(DAYS_SINCE_LAST_MESSAGE, 'days')
                .endOf('day');

            // Format dates for SQL
            const daysAgoStartStr = daysAgoStart.format('YYYY-MM-DD HH:mm:ss');
            const daysAgoEndStr = daysAgoEnd.format('YYYY-MM-DD HH:mm:ss');
            const todayStr = userNow.format('YYYY-MM-DD');

            // Prepare queries
            const lastUserMessageQuery = `
                SELECT created_at
                FROM messages
                WHERE account_id = ? AND role = 'user'
                AND created_at BETWEEN ? AND ?
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const assistantMessageTodayQuery = `
                SELECT created_at
                FROM messages
                WHERE account_id = ? AND role = 'assistant'
                AND DATE(created_at) = ?
                LIMIT 1
            `;

            try {
                const [lastUserMessages] = await dbService.pool.query(lastUserMessageQuery, [userId, daysAgoStartStr, daysAgoEndStr]);
                const [assistantMessagesToday] = await dbService.pool.query(assistantMessageTodayQuery, [userId, todayStr]);

                if (lastUserMessages.length > 0 && assistantMessagesToday.length === 0) {
                console.log(`User ${userId} meets the criteria.`);
                // TODO: Insert logic for generating and sending a follow-up message
                // await generateChatCompletion(userId);
                console.log(`Generated chat completion for user ${userId}.`);
                } else {
                console.log(`User ${userId} does not meet the criteria.`);
                }
                
            } catch (err) {
                console.error(`Error processing user ${userId}:`, err);
            }
            } else {
            console.log(`It's not 4:00 PM for user ${userId}.`);
            }
        })
        );

        await Promise.all(promises);
        console.log('Cron job completed at', new Date());
        
    } catch (err) {
        console.error('Error fetching accounts:', err);
    }
}

// Schedule the task to run every hour at minute 0
cron.schedule('0 * * * *', scheduledTask);

// Run the task once when the Docker container starts
scheduledTask();