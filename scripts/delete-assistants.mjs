import OpenAI from 'openai';
import { config } from '../src/config/config.mjs';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

async function listAssistants() {
    try {
        const assistants = await openai.beta.assistants.list({
            limit: 100, // Adjust this number as needed
            order: 'desc'
        });
        return assistants.data;
    } catch (error) {
        console.error('Error listing assistants:', error);
        throw error;
    }
}

async function deleteAssistant(assistantId) {
    try {
        const response = await openai.beta.assistants.del(assistantId);
        console.log(`Successfully deleted assistant ${assistantId}`);
        return response;
    } catch (error) {
        console.error(`Error deleting assistant ${assistantId}:`, error);
        throw error;
    }
}

async function deleteAllAssistants() {
    try {
        const assistants = await listAssistants();
        console.log(`Found ${assistants.length} assistants`);
        
        for (const assistant of assistants) {
            try {
                await deleteAssistant(assistant.id);
            } catch (error) {
                console.error(`Failed to delete assistant ${assistant.id}, continuing with others...`);
            }
        }
        console.log('Finished deleting assistants');
    } catch (error) {
        console.error('Error in deleteAllAssistants:', error);
    }
}

async function deleteSpecificAssistant(assistantId) {
    try {
        await deleteAssistant(assistantId);
        console.log('Assistant deleted successfully');
    } catch (error) {
        console.error('Failed to delete assistant:', error);
    }
}

// Example usage:
async function main() {
    const command = process.argv[2];
    const assistantId = process.argv[3];

    switch (command) {
        case 'list':
            try {
                const assistants = await listAssistants();
                console.log('Available assistants:');
                assistants.forEach(assistant => {
                    console.log(`ID: ${assistant.id}, Name: ${assistant.name}, Created: ${new Date(assistant.created_at * 1000).toLocaleString()}`);
                });
            } catch (error) {
                console.error('Error listing assistants:', error);
            }
            break;

        case 'delete':
            if (!assistantId) {
                console.error('Please provide an assistant ID');
                process.exit(1);
            }
            await deleteSpecificAssistant(assistantId);
            break;

        case 'delete-all':
            const confirmation = process.argv[3] === '--confirm';
            if (!confirmation) {
                console.log('Warning: This will delete ALL assistants.');
                console.log('To confirm, run again with: delete-all --confirm');
                process.exit(1);
            }
            await deleteAllAssistants();
            break;

        default:
            console.log(`
            Usage:
            node delete-assistants.js list                    - List all assistants
            node delete-assistants.js delete <assistant-id>   - Delete specific assistant
            node delete-assistants.js delete-all --confirm    - Delete all assistants
            `);
    }
}

main().catch(console.error);