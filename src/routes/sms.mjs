import express from 'express';
import twilio from 'twilio';
import { validateTwilioRequest } from '../middleware/twilioValidation.mjs';
import { dbService } from '../services/database.mjs';
import { aiService } from '../services/ai.mjs';
import { config } from '../config/config.mjs';

const router = express.Router();
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

router.post('/', validateTwilioRequest, async (req, res) => {
    try {
        const incomingMessage = req.body.Body.trim();
        const senderNumber = req.body.From;
        
        const accountInfo = await dbService.getOrCreateAccount(senderNumber);

        if (!accountInfo.success) {
            console.error('Failed to get/create account:', accountInfo.error);
            res.status(500).send('Internal Server Error');
            return;
        }

        const { id, thread_id } = accountInfo.data;
        console.log(`Account ${accountInfo.isNewAccount ? 'created' : 'found'}:`, accountInfo.data);

        await dbService.saveMessage(id, 'user', incomingMessage);

        let responseMessage;
        if (incomingMessage.toLowerCase() === 'stop') {
            responseMessage = "You've been unsubscribed. Reply START to resubscribe.";
            // TODO: Insert logic to indicate that the user is inactive

        } else if (incomingMessage.toLowerCase() === 'start') {
            responseMessage = "Welcome back! You're now resubscribed.";
            
        } else {
            responseMessage = await aiService.generateResponse(incomingMessage, thread_id, id);
        }

        await dbService.saveMessage(id, 'assistant', responseMessage);

        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message(responseMessage);
        
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(twiml.toString());

    } catch (error) {
        console.error('Error processing SMS webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

export default router;