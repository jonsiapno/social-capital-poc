Notes

### **Solution: Use `bottleneck` for Rate Limiting**

The [`bottleneck`](https://github.com/SGrondin/bottleneck) library is designed for this purpose. It allows you to limit both:

- **Concurrency**: The number of tasks that can run simultaneously.
- **Rate**: The number of tasks that can start during a defined time interval.

This way, you can ensure that your script does not exceed the maximum allowed API calls per second, as well as control the level of concurrency to prevent overwhelming your system.

---

### **Implementing `bottleneck` in Your Script**

#### **1. Install `bottleneck`:**

```bash
npm install bottleneck
```

#### **2. Modify Your Script to Use `bottleneck`:**

Here's how you can adjust your script to use `bottleneck` for rate limiting.

```javascript
// Import necessary modules
import cron from 'node-cron';
import moment from 'moment-timezone';
import Bottleneck from 'bottleneck';
import { db } from './database'; // Replace with your actual database module
import { generateChatCompletion } from './chat'; // Replace with your actual function

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
function scheduledTask() {
  console.log('Cron job started at', new Date());

  // Get the current time in UTC
  const nowUtc = moment.utc();

  // Query all accounts
  db.query('SELECT id, timezone FROM accounts', async (err, accounts) => {
    if (err) {
      console.error('Error fetching accounts:', err);
      return;
    }

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
            WHERE user_id = ? AND role = 'user'
              AND created_at BETWEEN ? AND ?
            ORDER BY created_at DESC
            LIMIT 1
          `;

          const assistantMessageTodayQuery = `
            SELECT created_at
            FROM messages
            WHERE user_id = ? AND role = 'assistant'
              AND DATE(created_at) = ?
            LIMIT 1
          `;

          try {
            // Check last message from user DAYS_SINCE_LAST_MESSAGE days ago
            const lastUserMessage = await new Promise((resolve, reject) => {
              db.query(
                lastUserMessageQuery,
                [userId, daysAgoStartStr, daysAgoEndStr],
                (err, results) => {
                  if (err) return reject(err);
                  resolve(results[0]); // undefined if no message
                }
              );
            });

            // Check if assistant sent a message today
            const assistantMessageToday = await new Promise((resolve, reject) => {
              db.query(
                assistantMessageTodayQuery,
                [userId, todayStr],
                (err, results) => {
                  if (err) return reject(err);
                  resolve(results[0]); // undefined if no message
                }
              );
            });

            // Check if conditions are met
            if (lastUserMessage && !assistantMessageToday) {
              console.log(`User ${userId} meets the criteria.`);

              // Perform your action here
              // For example, call a function to generate a chat completion
              await generateChatCompletion(userId);
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

    // Wait for all promises to complete
    await Promise.all(promises);

    console.log('Cron job completed at', new Date());
  });
}

// Schedule the task to run every hour at minute 0
cron.schedule('0 * * * *', scheduledTask);

// Run the task once when the Docker container starts
scheduledTask();
```

---

### **Explanation of the `bottleneck` Configuration:**

- **`maxConcurrent`:** Limits the number of concurrent executions. Similar to the concurrency limit in `p-limit`.
- **`minTime`:** Ensures there is at least this amount of time (in milliseconds) between each call. This is useful if your API has a per-second limit.
- **`reservoir`:** The number of jobs that can be executed before the reservoir is depleted. It's like a bucket with tokens.
- **`reservoirRefreshAmount` and `reservoirRefreshInterval`:** Automatically refills the reservoir with a specified number of tokens at a specified interval. This allows you to maintain a fixed rate over time.

#### **Example Values:**

If your API allows:

- **Maximum of 10 API calls per second**
- **Maximum of 5 concurrent connections**

You can set:

```javascript
const MAX_CONCURRENT = 5;
const MIN_TIME = 0; // Since we'll control rate via reservoir
const RESERVOIR = 10;
const RESERVOIR_REFRESH_AMOUNT = 10;
const RESERVOIR_REFRESH_INTERVAL = 1000; // 1 second
```

This configuration ensures that:

- No more than **5 tasks** run simultaneously (`maxConcurrent`).
- No more than **10 tasks** start per second (controlled by `reservoir` and `reservoirRefreshInterval`).

---

### **Adjusting to Your API's Rate Limits:**

**Determine Your API's Constraints:**

- **Calls Per Second (CPS):** The maximum number of API calls allowed per second.
- **Concurrent Connections:** The maximum number of simultaneous connections or requests.

**Configure `bottleneck` Accordingly:**

- **Set `maxConcurrent` to match the maximum allowed concurrent connections.**
- **Set `reservoir` and `reservoirRefreshInterval` to control the number of API calls per time unit.**

---

### **Example: If API Allows 60 Calls Per Minute**

If your API allows a maximum of **60 calls per minute**:

- **Convert to per-second rate:** 1 call per second.
- **Set `reservoir` to `1` and `reservoirRefreshInterval` to `1000` ms.**

```javascript
const MAX_CONCURRENT = 1; // Since only 1 request per second is allowed
const MIN_TIME = 1000; // At least 1 second between each request
const RESERVOIR = 1;
const RESERVOIR_REFRESH_AMOUNT = 1;
const RESERVOIR_REFRESH_INTERVAL = 1000; // 1 second
```

---

### **Using `bottleneck` with Priority and Queues:**

`bottleneck` also allows you to manage queues and set priorities for tasks, which can be useful if you have critical tasks that should be executed before others.