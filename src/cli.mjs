import readline from 'readline';
import {dbService} from './services/database.mjs';
import {aiService} from './services/ai.mjs';

/**
 * The CLI program, which runs in its own window, and handles inputs.
 *
 * How does it call the server?  It doesn't, instead it contains a copy of the server.
 */
export async function startCLI(initialPhoneNumber = null) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let currentAccount = null;

    const switchUser = async (phoneNumber) => {
        console.log('Attempting to switch user to phone number:', phoneNumber);
        try {
            const accountInfo = await dbService.getOrCreateAccount(phoneNumber);
            if (!accountInfo.success) {
                console.error('Failed to initialize account for phone number:', phoneNumber);
                return false;
            }
            currentAccount = accountInfo.data; // this is the important line.
            console.log(`\nSwitched to user account: ${phoneNumber}`);
            const recentMessages = await dbService.getMessages(currentAccount.id, 5);
            console.log('\nFetched recent messages:', recentMessages.length);

            if (recentMessages.length > 0) {
                console.log('\nRecent conversation history:\n');
                recentMessages.forEach(msg => {
                    console.log(`${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}\n`);
                });
            }

            return true;
        } catch (error) {
            console.error('Error switching user:', error);
            return false;
        }
    };

    const handleCommand = async (input) => {
        console.log('Received command:', input);
        const parts = input.split(' ');
        const command = parts[0].toLowerCase();

        switch (command) {
            case '/switch':
                if (parts.length !== 2) {
                    console.log('Usage: /switch <phone_number>');
                    return true;
                }
                return await switchUser(parts[1]);

            case '/help':
                console.log('\nAvailable commands:');
                console.log('/switch <phone_number> - Switch to a different user');
                console.log('/history - Show more conversation history');
                console.log('/clear - Clear the screen');
                console.log('/help - Show this help message');
                console.log('/exit - Exit the application\n');
                return true;

            case '/history':
                if (!currentAccount) {
                    console.log('Please switch to a user first with /switch <phone_number>');
                    return true;
                }
                const messages = await dbService.getMessages(currentAccount.id, 20);
                console.log('\nFetched history messages:', messages.length);
                console.log('\nConversation history:');
                messages.forEach(msg => {
                    console.log(`${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}`);
                });
                console.log('\n');
                return true;

            case '/clear': // what we really need is something that clears the history.
                console.clear();
                return true;

            case '/exit':
                rl.close();
                process.exit(0);

            default:
                console.log('Command not recognized:', command);
                return false;
        }
    };

    const handleUserMessage = async (input) => {
        try {
            const userMessageId = await dbService.saveMessage(currentAccount.id, 'user', input);

            aiService.moderateMessage(input, userMessageId).then(isFlagged => {
                if (isFlagged) {
                    console.log("User message flagged for review.");
                }
            }).catch(error => {
                console.error('Error during user message moderation:', error.message);
            });

            const response = await aiService.generateResponse(input, currentAccount.thread_id, currentAccount.id);

            const aiMessageId = await dbService.saveMessage(currentAccount.id, 'assistant', response);

            aiService.moderateMessage(response, aiMessageId).then(isFlagged => {
                if (isFlagged) {
                    console.log("AI response message flagged for review.");
                }
            }).catch(error => {
                console.error('Error during AI message moderation:', error.message);
            });

            console.log('\nAssistant:', response, '\n');
        } catch (error) {
            console.error('Error during message handling:', error.message);
        }
    };

    const askQuestion = () => {
        const prompt = currentAccount ? 'You: ' : 'Enter phone number to start (/help for commands): ';

        rl.question(prompt, async (input) => {
            if (!input.trim()) {
                console.log('No input provided, asking again.');
                askQuestion();
                return;
            }

            if (input.startsWith('/')) {
                const handled = await handleCommand(input); // the commands start with "/" and are trapped here
                if (handled) {
                    askQuestion();
                    return;
                }
            }

            if (!currentAccount) {
                console.log('No current account, attempting switch.');
                if (await switchUser(input)) {
                    askQuestion();
                    return;
                }
                console.log('Failed to switch user. Please try again or use /help for commands.');
                askQuestion();
                return;
            }

            await handleUserMessage(input); // this does the work
            askQuestion(); // this is a recursive call, and it should be loop over the ask/reesponse sequence
        });
    };

    console.log('Welcome to the Copilot CLI!');
    console.log('Type /help for available commands\n');

    if (initialPhoneNumber) {
        console.log('Initializing with phone number:', initialPhoneNumber);
        await switchUser(initialPhoneNumber);
    }

    askQuestion();
}
