import express from 'express';
import twilio from 'twilio';
import { validateTwilioRequest } from '../middleware/twilioValidation.mjs';
import { dbService } from '../services/database.mjs';
import { aiService } from '../services/ai.mjs';
import { config } from '../config/config.mjs';

const router = express.Router();
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);


/**
 * Process an inbound Twilio message, by:
 * 1) recording it in the database,
 * 2) moderating it - using OpenAI moderation api
 * 3) processing it - using OpenAI assistant api
 */
router.post('/', validateTwilioRequest, async (req, res) => {
    try {

        // Extract and log incoming message details
        const incomingMessage = req.body.Body ? req.body.Body.trim() : '';
        const senderNumber = req.body.From;
        const messagingServiceSid = req.body.MessagingServiceSid;

        // Send an empty response back to Twilio immediately
        const twiml = new twilio.twiml.MessagingResponse(); // No message added
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(twiml.toString());

        // Now process the message asynchronously
        (async () => {
            try {

                const accountInfo = await dbService.getOrCreateAccount(senderNumber);

                if (!accountInfo.success) {
                    console.error('Failed to get/create account:', accountInfo.error);
                    return;
                }

                const { id, thread_id } = accountInfo.data;

                // Save the incoming message and get its messageId
                const userMessageId = await dbService.saveMessage(id, 'user', incomingMessage);

                // Moderate the incoming message
                const isFlagged = await aiService.moderateMessage(incomingMessage, userMessageId);

                if (isFlagged) {
                    console.log(`Incoming message flagged and processed: Message ID ${userMessageId}`);
                }

                let responseMessage;
                if (incomingMessage.toLowerCase() === 'stop') {
                    responseMessage = "You've been unsubscribed. Reply START to resubscribe.";
                    // TODO: Update user's active status in the database

                } else if (incomingMessage.toLowerCase() === 'start') {
                    responseMessage = "Welcome back! You're now resubscribed.";
                    // TODO: Update user's active status in the database

                } else {
                    responseMessage = await aiService.generateResponse(incomingMessage, thread_id, id);
                }

                // Save the AI response
                const aiMessageId = await dbService.saveMessage(id, 'assistant', responseMessage);

                // Moderate the AI response
                const aiIsFlagged = await aiService.moderateMessage(responseMessage, aiMessageId);

                if (aiIsFlagged) {
                    console.log(`Outgoing AI message flagged and processed: Message ID ${aiMessageId}`);
                }

                // Send AI response to the user via Twilio
                await twilioClient.messages.create({
                    body: responseMessage,
                    messagingServiceSid: messagingServiceSid, // Use the extracted MessagingServiceSid
                    to: senderNumber,
                });

            } catch (asyncError) {
                console.error('Error in asynchronous processing:', asyncError);
            }
        })();

    } catch (error) {
        console.error('Error processing SMS webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

export default router;
