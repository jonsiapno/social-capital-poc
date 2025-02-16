// src/services/ai.mjs

import OpenAI from 'openai';
import { config } from '../config/config.mjs';
import { dbService } from './database.mjs';
import { chromaService } from './chroma.mjs';

/**
 * All interaction with OpenAI API is located here.
 */

class AIService {
    constructor() {
        this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }

    /**
     * Method to set up assistant
     */
    createAssistantConfig() {
        return {
            name: "Social Capital Assistant",
            instructions: `
                You are an assistant that helps college students find opportunities by making new connections, just like successful job seekers do.

                You provide clear and concise answers in plain text without any formatting like Markdown or HTML.

                When listing email addresses, present them in plain text like "email@example.com" without any additional formatting or links.

                Use the 'get_student_name' and 'save_student_name' functions when needed to retrieve or save the student's name. To delete a student's name, save it as ''.

                Use the 'get_contact_with_relevant_experience' function to search for college students with relevant experience.
                If you find a college student with relevant experience, ask the user if they would like help drafting a first message to the contact.

                If, during your conversation with the user, you detect any of the following intents:
                - stress
                - salary negotiation
                - promotion
                - career changes

                Then you should use the 'human_in_the_loop' function to flag the message and provide a referral to Coach Kaitlyn.

                When the 'human_in_the_loop' function is called, include the detected intents in the 'detected_intents' parameter.
            `,

            tools: [
                {
                    type: "function",
                    function: {
                        name: "get_student_name",
                        description: "Get name of the current student",
                        parameters: {
                            type: "object",
                            properties: {}
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "save_student_name",
                        description: "Save the student's first name to their account",
                        parameters: {
                            type: "object",
                            properties: {
                                first_name: {
                                    type: "string",
                                    description: "The student's first name"
                                }
                            },
                            required: ["first_name"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "get_contact_with_relevant_experience",
                        description: "Your goal is to introduce the user to a college student with relevant experience. Call this function to find any college students with relevant experience. Ask the user if they would like help drafting the first message to the contact.",
                        parameters: {
                            type: "object",
                            properties: {
                                search_query: {
                                    type: "string",
                                    description: "Describe the field that interests the user. This will be used as the search query to see if there are any existing contacts who already have that experience."
                                }
                            },
                            required: ["search_query"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "human_in_the_loop",
                        description: "Use this function when you detect any of the following intents: stress, salary negotiation, promotion, career changes. This will flag the message and provide a referral to Coach Kaitlyn.",
                        parameters: {
                            type: "object",
                            properties: {
                                detected_intents: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "List of detected intents."
                                }
                            },
                            required: ["detected_intents"]
                        }
                    }
                }

            ],
            model: "gpt-4-turbo-preview"
        };
    }

    async createThread() {
        try {
            const thread = await this.openai.beta.threads.create();
            return { success: true, threadId: thread.id };
        } catch (error) {
            console.error('Error creating thread:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteAssistant(assistantId) {
        if (!assistantId) return;

        try {
            await this.openai.beta.assistants.del(assistantId);
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
                try {
                    await this.openai.beta.threads.runs.cancel(threadId, activeRun.id);
                    await this.waitForRunStatus(threadId, activeRun.id);
                } catch (error) {
                    if (error.status === 400 && error.error?.message.includes('Cannot cancel run with status')) {
                        continue;
                    }
                    throw error;
                }
            }
        } catch (error) {
            console.error('Error cancelling active runs:', error);
            throw error;
        }
    }

    async waitForRunStatus(threadId, runId, targetStatuses = ['cancelled', 'failed', 'completed', 'expired']) {
        let runStatus;
        do {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const runInfo = await this.openai.beta.threads.runs.retrieve(threadId, runId);
            runStatus = runInfo.status;
        } while (!targetStatuses.includes(runStatus));

        return runStatus;
    }

    async handleToolCalls(threadId, runId, toolCalls, userId) {
        const toolOutputs = [];

        for (const toolCall of toolCalls) {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            let output;

            switch (toolCall.function.name) {
                case 'get_student_name':
                    output = await dbService.getStudentName(userId);
                    break;

                case 'save_student_name':
                    const name = args.name || args.first_name;
                    output = await dbService.saveStudentName(userId, name);
                    break;

                case 'get_contact_with_relevant_experience':
                    const result = await chromaService.initializeAndQuery(args.search_query);
                    output = JSON.stringify(result);
                    break;

                case 'human_in_the_loop':
                    // Handle the human_in_the_loop tool
                    const detectedIntents = args.detected_intents;
                    const flaggedReason = detectedIntents.join(', ');

                    console.log('Detected intents:', detectedIntents);

                    // Get the last user message ID
                    const lastUserMessageId = await dbService.getLastUserMessageId(userId);

                    if (lastUserMessageId) {
                        await dbService.updateMessageFlag(lastUserMessageId, true, flaggedReason);
                    } else {
                        console.error('No last user message ID found to flag.');
                    }
                    // Provide the Calendly link
                    output = `I recommend you meet with Coach Kaitlyn at https://calendly.com/Kaitlyn`;
                    break;
            }

            toolOutputs.push({
                tool_call_id: toolCall.id,
                output: output
            });
        }

        return this.openai.beta.threads.runs.submitToolOutputs(
            threadId,
            runId,
            { tool_outputs: toolOutputs }
        );
    }

    async waitForRunCompletion(threadId, runId, userId, maxAttempts = 20) {
        const baseDelay = 1000;
        let attemptCount = 0;

        while (attemptCount < maxAttempts) {
            try {
                const run = await this.openai.beta.threads.runs.retrieve(threadId, runId);

                switch (run.status) {
                    case 'completed':
                        return run;
                    case 'requires_action':
                        await this.handleToolCalls(
                            threadId,
                            runId,
                            run.required_action.submit_tool_outputs.tool_calls,
                            userId
                        );
                        break;
                    case 'failed':
                    case 'cancelled':
                    case 'expired':
                        throw new Error(`Run ended with status: ${run.status}`);
                }
            } catch (error) {
                console.error('Error in run completion loop:', error);
                throw error;
            }

            await new Promise(resolve => setTimeout(resolve, baseDelay * (attemptCount + 1)));
            attemptCount++;
        }

        throw new Error('Run did not complete within the maximum number of attempts');
    }

    /**
     * Method to carry out moderation of a received Twilio message.  Called by routes/sms.
     */
    async moderateMessage(text, messageId) {
        try {
            const moderationResponse = await this.openai.moderations.create({
                model: "omni-moderation-latest",
                input: text
            });

            if (moderationResponse?.results?.length > 0) {
                const moderationResult = moderationResponse.results[0];

                let flaggedReason = null;
                if (moderationResult.flagged) {
                    flaggedReason = Object.entries(moderationResult.categories)
                        .filter(([_, isFlagged]) => isFlagged)
                        .map(([category, _]) => category)
                        .join(', ');
                }

                // Save the flagged status and reason to the database
                await dbService.updateMessageFlag(messageId, moderationResult.flagged, flaggedReason);

                return moderationResult.flagged;
            } else {
                console.warn('Unexpected moderation response format:', moderationResponse);
                return false;
            }
        } catch (error) {
            console.error('Error during message moderation:', error);
            return false;
        }
    }

    /**
     * Method to carry out response generation of received Twilio message.  Called by routes/sms.
     * In this code, we are using the created assistant and thread.
     */
    async generateResponse(message, threadId, userId) {
        let assistant = null;

        try {
            await this.cancelActiveRuns(threadId);

            // why do we create a new assistant, instead of just a thread?
            // Create assistant and send message in parallel
            const [createdAssistant, threadMessage] = await Promise.all([
                this.openai.beta.assistants.create(this.createAssistantConfig()),
                this.openai.beta.threads.messages.create(threadId, {
                    role: "user",
                    content: message
                })
            ]);

            assistant = createdAssistant;

            const run = await this.openai.beta.threads.runs.create(threadId, {
                assistant_id: assistant.id
            });

            await this.waitForRunCompletion(threadId, run.id, userId);

            const messages = await this.openai.beta.threads.messages.list(threadId);
            const lastMessageForRun = messages.data
                .filter(message => message.run_id === run.id && message.role === "assistant")
                .pop();

            return lastMessageForRun?.content[0]?.text?.value ||
                   "I apologize, but I'm having trouble generating a response right now.";

        } catch (error) {
            console.error('Error generating AI response:', error);
            return "I apologize, but I'm having trouble processing your request right now.";
        } finally {
            // Always cleanup the assistant in the background
            if (assistant?.id) {
                this.cleanupAssistant(assistant.id);
            }
        }
    }
}

export const aiService = new AIService();
