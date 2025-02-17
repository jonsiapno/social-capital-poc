/**
 * Example program to send a message to my phone using Twilio
 */

import twilio from "twilio";
import express from "express"; // not yet used
import {config} from "./config/config.mjs";


console.log(config.twilio.accountSid);
const router = express.Router(); // not yet used
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);


try {
    //const incomingMessage = req.body.Body ? req.body.Body.trim() : '';
    //const senderNumber = req.body.From;
    //const messagingServiceSid = req.body.MessagingServiceSid;

    // Send an empty response back to Twilio immediately
    //const twiml = new twilio.twiml.MessagingResponse(); // No message added
    //res.writeHead(200, { 'Content-Type': 'text/xml' });
    //res.end(twiml.toString());

    const senderNumber = "650-862-1376";
    const responseMessage = "Now is the time for all good men to come to the aid of their party";

    // Send response to the user via Twilio
    //await twilioClient.messages.create({
    //    body: responseMessage,
    //    //messagingServiceSid: messagingServiceSid, // Use the extracted MessagingServiceSid
    //    to: senderNumber,
    //});

    twilioClient.messages
        .create({
            body: responseMessage,
            from: '+18443293312',
            to: '+16508621376'})
        .then(message => console.log(message.sid));

} catch (error) {
    console.error('Error sms esend:', error);
    //res.status(500).send('Internal Server Error');
}
