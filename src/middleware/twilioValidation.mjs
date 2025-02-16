import twilio from 'twilio';

/**
 * This is middleware to validate a twilio-received input.
 */
export const validateTwilioRequest = (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    const twilioSignature = req.headers['x-twilio-signature'];
    const ngrokUrl = req.headers['x-forwarded-proto'] + '://' + req.headers['x-forwarded-host'] + req.originalUrl;
    const regularUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    if (!twilioSignature) {
        return res.status(400).send('No Twilio signature found');
    }

    const requestIsValidNgrok = twilio.validateRequest(
        process.env.TWILIO_AUTH_TOKEN,
        twilioSignature,
        ngrokUrl,
        req.body
    );

    const requestIsValidRegular = twilio.validateRequest(
        process.env.TWILIO_AUTH_TOKEN,
        twilioSignature,
        regularUrl,
        req.body
    );

    if (requestIsValidNgrok || requestIsValidRegular) {
        next();
    } else {
        res.status(403).send('Invalid Twilio signature');
    }
};
