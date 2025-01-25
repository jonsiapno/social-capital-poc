import OpenAI from 'openai';
import { config } from '../config/config.mjs';
import { dbService } from './database.mjs';

class AIService {
    constructor() {
        this.openai = new OpenAI({ apiKey: config.openai.apiKey });
        this.assistantConfig = {
            name: "College Application Advisor",
            instructions: "You are a college advisor to high school students. Use the 'get_student_name' and 'save_student_name' functions when needed to retrieve or save the student's name. To delete a student's name, save it as ''. Only show the top 3 of any list.",
            tools: [
                {"type": "code_interpreter"},
                {
                    "type": "function",
                    "function": {
                        "name": "get_student_name",
                        "description": "Get name of the current student",
                        "parameters": {
                                "type": "object", 
                                "properties": {
                                }
                            }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "save_student_name",
                        "description": "Save the student's first name to their account",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "first_name": {
                                    "type": "string",
                                    "description": "The student's first name"
                                }
                            },
                            "required": ["first_name"]
                        }
                    }
                }
            ],
            model: "gpt-4-turbo-preview"
        };
    }

    async deleteAssistant(assistantId) {
        try {
            const response = await this.openai.beta.assistants.del(assistantId);
            console.log(`Assistant ${assistantId} deleted successfully`);
            return response;
        } catch (error) {
            console.error('Error deleting assistant:', error);
            throw error;
        }
    }

    async cleanupAssistant(assistantId) {
        if (assistantId) {
            this.deleteAssistant(assistantId).catch(error => {
                console.error('Background assistant cleanup failed:', error);
            });
        }
    }

    async cancelActiveRuns(threadId) {
        try {
            const runsList = await this.openai.beta.threads.runs.list(threadId);
            const activeRuns = runsList.data.filter(run => 
                !['completed', 'cancelled', 'failed', 'expired', 'cancelling'].includes(run.status)
            );

            for (const activeRun of activeRuns) {
                console.log(`Cancelling active run ${activeRun.id}...`);
                try {
                    await this.openai.beta.threads.runs.cancel(threadId, activeRun.id);
                } catch (error) {
                    if (error.status === 400 && error.error?.message.includes('Cannot cancel run with status')) {
                        console.log(`Run ${activeRun.id} cannot be cancelled because it is ${activeRun.status}.`);
                        continue;
                    }
                    throw error;
                }

                let runStatus = activeRun.status;
                while (!['cancelled', 'failed', 'completed', 'expired'].includes(runStatus)) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const runInfo = await this.openai.beta.threads.runs.retrieve(threadId, activeRun.id);
                    runStatus = runInfo.status;
                }
                console.log(`Run ${activeRun.id} has status '${runStatus}'.`);
            }
        } catch (error) {
            console.error('Error cancelling active runs:', error);
        }
    }

    async processToolCalls(threadId, runId, requiredAction, id) {
        const tool_outputs = [];
        for (const tool_call of requiredAction.submit_tool_outputs.tool_calls) {
            if (tool_call.function.name === "get_student_name") {
                const name = await dbService.getStudentName(id);
                tool_outputs.push({
                    tool_call_id: tool_call.id,
                    output: name,
                });
            }

            if (tool_call.function.name === "save_student_name") {
                const args = JSON.parse(tool_call.function.arguments || '{}');
                const name = args.name || args.first_name;
                const result = await dbService.saveStudentName(id, name);
                tool_outputs.push({
                    tool_call_id: tool_call.id,
                    output: JSON.stringify(result),
                });
            }
        }

        await this.openai.beta.threads.runs.submitToolOutputs(
            threadId,
            runId,
            { tool_outputs }
        );
    }

    async waitForRunCompletion(threadId, runId, id, maxAttempts = 10) {
        let attemptCount = 0;
        while (attemptCount < maxAttempts) {
            const polledRun = await this.openai.beta.threads.runs.retrieve(threadId, runId);
    
            if (polledRun.status === 'completed') return polledRun;
    
            if (polledRun.status === 'requires_action') {
                await this.processToolCalls(threadId, runId, polledRun.required_action, id);
            }
    
            if (['failed', 'cancelled', 'expired'].includes(polledRun.status)) {
                break;
            }
    
            await new Promise(resolve => setTimeout(resolve, 1000));
            attemptCount++;
        }
    
        throw new Error('Run did not complete in time');
    }

    async generateResponse(message, threadId, id) {
        let assistant = null;
        try {
            await this.cancelActiveRuns(threadId);

            // Parallel processing of assistant creation and message sending
            const [createdAssistant, threadMessage] = await Promise.all([
                this.openai.beta.assistants.create(this.assistantConfig),
                this.openai.beta.threads.messages.create(threadId, {
                    role: "user",
                    content: message
                })
            ]);

            assistant = createdAssistant;

            const run = await this.openai.beta.threads.runs.create(threadId, {
                assistant_id: assistant.id,
            });

            await this.waitForRunCompletion(threadId, run.id, id);

            const messages = await this.openai.beta.threads.messages.list(threadId);
            const lastMessageForRun = messages.data
                .filter(message => message.run_id === run.id && message.role === "assistant")
                .pop();

            let response = "I apologize, but I'm having trouble generating a response right now.";
            
            if (lastMessageForRun?.content[0]?.text?.value) {
                response = lastMessageForRun.content[0].text.value;
            }

            // Trigger assistant cleanup without awaiting it
            if (assistant?.id) {
                this.cleanupAssistant(assistant.id);
            }

            return response;

        } catch (error) {
            console.error('Error generating AI response:', error);
            
            // Trigger cleanup without awaiting it
            if (assistant?.id) {
                this.cleanupAssistant(assistant.id);
            }
            
            return "I apologize, but I'm having trouble processing your request right now.";
        }
    }
    }

export const aiService = new AIService();


/*

Revert to code below

import OpenAI from 'openai';
import { config } from '../config/config.mjs';
import { dbService } from './database.mjs';

class AIService {
    constructor() {
        this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }

    async deleteAssistant(assistantId) {
        try {
            const response = await this.openai.beta.assistants.del(assistantId);
            console.log(`Assistant ${assistantId} deleted successfully`);
            return response;
        } catch (error) {
            console.error('Error deleting assistant:', error);
            throw error;
        }
    }

    async cleanupAssistant(assistantId) {
        if (assistantId) {
            // Fire and forget - don't await the deletion
            this.deleteAssistant(assistantId).catch(error => {
                console.error('Background assistant cleanup failed:', error);
            });
        }
    }

    async cancelActiveRuns(threadId) {
        try {
            const runsList = await this.openai.beta.threads.runs.list(threadId);
            const activeRuns = runsList.data.filter(run => 
                !['completed', 'cancelled', 'failed', 'expired', 'cancelling'].includes(run.status)
            );

            for (const activeRun of activeRuns) {
                console.log(`Cancelling active run ${activeRun.id}...`);
                try {
                    await this.openai.beta.threads.runs.cancel(threadId, activeRun.id);
                } catch (error) {
                    if (error.status === 400 && error.error?.message.includes('Cannot cancel run with status')) {
                        console.log(`Run ${activeRun.id} cannot be cancelled because it is ${activeRun.status}.`);
                        continue;
                    }
                    throw error;
                }

                let runStatus = activeRun.status;
                while (!['cancelled', 'failed', 'completed', 'expired'].includes(runStatus)) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const runInfo = await this.openai.beta.threads.runs.retrieve(threadId, activeRun.id);
                    runStatus = runInfo.status;
                }
                console.log(`Run ${activeRun.id} has status '${runStatus}'.`);
            }
        } catch (error) {
            console.error('Error cancelling active runs:', error);
        }
    }

    async generateResponse(message, threadId, id) {
        let assistant = null;
        try {
            await this.cancelActiveRuns(threadId);

            assistant = await this.openai.beta.assistants.create({
                name: "College Application Advisor",
                instructions: "You are a college advisor to high school students. Use the 'get_student_name' and 'save_student_name' functions when needed to retrieve or save the student's name. To delete a student's name, save it as ''. Only show the top 3 of any list.",
                tools: [
                    {"type": "code_interpreter"},
                    {
                        "type": "function",
                        "function": {
                            "name": "get_student_name",
                            "description": "Get name of the current student",
                            "parameters": {
                                "type": "object",
                                "properties": {}
                            }
                        }
                    },
                    {
                        "type": "function",
                        "function": {
                            "name": "save_student_name",
                            "description": "Save the student's first name to their account",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "first_name": {
                                        "type": "string",
                                        "description": "The student's first name"
                                    }
                                },
                                "required": ["first_name"]
                            }
                        }
                    }
                ],
                model: "gpt-4-turbo-preview"
            });

            await this.openai.beta.threads.messages.create(threadId, {
                role: "user",
                content: message
            });

            const run = await this.openai.beta.threads.runs.create(threadId, {
                assistant_id: assistant.id,
            });

            let attemptCount = 0;
            const maxAttempts = 5;

            while (attemptCount < maxAttempts) {
                let polledRun = await this.openai.beta.threads.runs.retrieve(threadId, run.id);

                if (polledRun.status === 'completed') {
                    break;
                }

                if (polledRun.status === 'requires_action') {
                    const requiredAction = polledRun.required_action;
                    if (requiredAction) {
                        const tool_outputs = [];

                        for (const tool_call of requiredAction.submit_tool_outputs.tool_calls) {
                            if (tool_call.function.name === "get_student_name") {
                                const name = await dbService.getStudentName(id);
                                tool_outputs.push({
                                    tool_call_id: tool_call.id,
                                    output: name,
                                });
                            }

                            if (tool_call.function.name === "save_student_name") {
                                const args = JSON.parse(tool_call.function.arguments || '{}');
                                const name = args.name || args.first_name;
                                const result = await dbService.saveStudentName(id, name);
                                tool_outputs.push({
                                    tool_call_id: tool_call.id,
                                    output: JSON.stringify(result),
                                });
                            }
                        }

                        polledRun = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
                        while (polledRun.status === 'queued') {
                            await new Promise(resolve => setTimeout(resolve, 100));
                            polledRun = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
                        }

                        await this.openai.beta.threads.runs.submitToolOutputs(
                            threadId,
                            run.id,
                            { tool_outputs }
                        );
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500));
                attemptCount++;
            }

            let finalRunStatus = await this.openai.beta.threads.runs.retrieve(threadId, run.id);

            if (finalRunStatus.status !== 'completed') {
                finalRunStatus = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
                if (finalRunStatus.status === 'completed') {
                    // Proceed to retrieve the assistant's response
                } else {
                    try {
                        await this.openai.beta.threads.runs.cancel(threadId, run.id);
                        while (true) {
                            const runStatus = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
                            if (['cancelled', 'failed', 'expired'].includes(runStatus.status)) {
                                break;
                            }
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    } catch (error) {
                        if (error.status === 400 && error.message.includes("Cannot cancel run with status 'completed'")) {
                            console.log(`Run ${run.id} has already completed.`);
                        } else {
                            console.error(`Error canceling run ${run.id}: ${error.message}`);
                            throw new Error("Unable to cancel run");
                        }
                    }
                }
            }

            const messages = await this.openai.beta.threads.messages.list(threadId);
            const lastMessageForRun = messages.data
                .filter(message => message.run_id === run.id && message.role === "assistant")
                .pop();

            let response = "I apologize, but I'm having trouble generating a response right now.";
            
            if (lastMessageForRun?.content[0]?.text?.value) {
                response = lastMessageForRun.content[0].text.value;
            }

            // Trigger assistant cleanup without awaiting it
            if (assistant?.id) {
                this.cleanupAssistant(assistant.id);
            }

            return response;

        } catch (error) {
            console.error('Error generating AI response:', error);
            
            // Trigger cleanup without awaiting it
            if (assistant?.id) {
                this.cleanupAssistant(assistant.id);
            }
            
            return "I apologize, but I'm having trouble processing your request right now.";
        }
    }
}

export const aiService = new AIService();
*/