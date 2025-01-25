import { startServer } from './server.mjs';
import { startCLI } from './cli.mjs';

const args = process.argv.slice(2);
const mode = args[0] || 'server';

if (mode === 'cli') {
    const initialPhoneNumber = args[1];
    startCLI(initialPhoneNumber);
} else {
    startServer();
}