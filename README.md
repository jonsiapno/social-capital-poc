# social-capital-proof-of-concept

## prototype:
https://www.figma.com/proto/PH59Yz1IXwjqfiVEsQcQzI/New-Chatbot?node-id=320-109&p=f&t=CWrk1LLQ2jtzIuE1-1&scaling=scale-down&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=320%3A109

To run the CLI application, TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are not required.


Create a .env:
```markdown
```bash
CHROMA_URL=http://chroma:8000
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
NODE_ENV=production
PORT=3000
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
OPENAI_API_KEY=
```

To start the server:
```markdown
```bash
docker-compose up --build
```

For local testing:

The server will be available at http://localhost:3000
Use ngrok to create a public URL for Twilio webhooks:

```markdown
```bash
ngrok http 3000
```

To run the CLI application:
```markdown
```bash
# Without initial phone number:
npm run cli

# With initial phone number:
npm run cli -- +1234567890
```

The webhook endpoint is:
```markdown
```bash
https://your-ngrok-url.ngrok.io/sms
```

To turn off the server:
Stop the container on Docker Desktop
```markdown
```bash
docker-compose down
```
