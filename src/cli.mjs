import readline from 'readline';
import { dbService } from './services/database.mjs';
import { aiService } from './services/ai.mjs';

export async function startCLI(initialPhoneNumber = null) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let currentAccount = null;

    const switchUser = async (phoneNumber) => {
        try {
            const accountInfo = await dbService.getOrCreateAccount(phoneNumber, true);
            if (!accountInfo.success) {
                console.error('Failed to initialize account for phone number:', phoneNumber);
                return false;
            }
            currentAccount = accountInfo.data;
            console.log(`\nSwitched to user account: ${phoneNumber}`);
            
            const recentMessages = await dbService.getMessages(currentAccount.id, 5);
            if (recentMessages.length > 0) {
                console.log('\nRecent conversation history:\n');
                recentMessages.forEach(msg => {
                    console.log(`${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}\n`);
                });
                // console.log('\n');
            }
            
            return true;
        } catch (error) {
            console.error('Error switching user:', error);
            return false;
        }
    };

    const handleCommand = async (input) => {
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
                console.log('\nConversation history:');
                messages.forEach(msg => {
                    console.log(`${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}`);
                });
                console.log('\n');
                return true;

            case '/clear':
                console.clear();
                return true;

            case '/exit':
                rl.close();
                process.exit(0);

            default:
                return false;
        }
    };

    const askQuestion = () => {
        const prompt = currentAccount ? 'You: ' : 'Enter phone number to start (/help for commands): ';
        
        rl.question(prompt, async (input) => {
            if (!input.trim()) {
                askQuestion();
                return;
            }

            if (input.startsWith('/')) {
                const handled = await handleCommand(input);
                if (handled) {
                    askQuestion();
                    return;
                }
            }

            if (!currentAccount) {
                if (await switchUser(input)) {
                    askQuestion();
                    return;
                }
                console.log('Failed to switch user. Please try again or use /help for commands.');
                askQuestion();
                return;
            }

            try {
                await dbService.saveMessage(currentAccount.id, 'user', input);
                
                const response = await aiService.generateResponse(
                    input,
                    currentAccount.thread_id,
                    currentAccount.id
                );

                await dbService.saveMessage(currentAccount.id, 'assistant', response);
                console.log('\nAssistant:', response, '\n');
            } catch (error) {
                console.error('Error:', error.message);
            }

            askQuestion();
        });
    };

    console.log('Welcome to the Copilot CLI!');
    console.log('Type /help for available commands\n');

    if (initialPhoneNumber) {
        await switchUser(initialPhoneNumber);
    }

    askQuestion();

}