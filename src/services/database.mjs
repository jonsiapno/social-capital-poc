// src/services/database.mjs

import mysql from 'mysql2/promise';
import { config } from '../config/config.mjs';
import { aiService } from './ai.mjs';

/**
 * All interaction with database is handled here
 */
class DatabaseService {
    constructor() {
        this.pool = mysql.createPool(config.mysql);
    }

    async testConnection() {
        try {
            const connection = await this.pool.getConnection();
            console.log('Successfully connected to MySQL database');
            connection.release();
        } catch (error) {
            console.error('Error connecting to database:', error);
            throw error;
        }
    }

    async getOrCreateAccount(phoneNumber) {
        try {
            const [rows] = await this.pool.query(
                'SELECT id, tenant_id, role, first_name, last_name, email_address, skills, soc_cap_index, assistant_id, thread_id, status FROM accounts WHERE phone_number = ?',
                [phoneNumber]
            );

            if (rows.length > 0) {
                return {
                    success: true,
                    data: rows[0],
                    isNewAccount: false
                };
            }

            const [tenants] = await this.pool.query('SELECT id FROM tenants LIMIT 1');
            if (tenants.length === 0) {
                throw new Error('No default tenant found. Please set up at least one tenant.');
            }
            const defaultTenantId = tenants[0].id;

            const threadResponse = await aiService.createThread();
            if (!threadResponse.success) {
                throw new Error('Failed to create OpenAI thread');
            }
            const threadId = threadResponse.threadId;

            const [result] = await this.pool.query(
                'INSERT INTO accounts (phone_number, thread_id, tenant_id, status) VALUES (?, ?, ?, ?)',
                [phoneNumber, threadId, defaultTenantId, 'active']
            );

            return {
                success: true,
                data: {
                    id: result.insertId,
                    phone_number: phoneNumber,
                    thread_id: threadId,
                    tenant_id: defaultTenantId,
                    status: 'active'
                },
                isNewAccount: true
            };
        } catch (error) {
            console.error('Error in getOrCreateAccount:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Save the message and return its ID
    async saveMessage(id, role, text) {
        try {
            const [result] = await this.pool.query(
                'INSERT INTO messages (account_id, role, text, flagged) VALUES (?, ?, ?, 0)',
                [id, role, text]
            );
            return result.insertId; // Return messageId for later flag updates
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    }

    // Update message flagging status
    async updateMessageFlag(messageId, isFlagged, flaggedReason = null) {
        try {
            const [result] = await this.pool.query(
                'UPDATE messages SET flagged = ?, flagged_reason = ? WHERE id = ?',
                [isFlagged ? 1 : 0, flaggedReason, messageId]
            );
        } catch (error) {
            console.error('Error updating message flag:', error);
            throw error;
        }
    }

    async getMessages(id, limit) {
        try {
            const [rows] = await this.pool.query(
                'SELECT role, text FROM messages WHERE account_id = ? ORDER BY created_at DESC LIMIT ?',
                [id, limit]
            );

            return rows.reverse().map(row => ({
                role: row.role,
                content: row.text,
            }));
        } catch (error) {
            console.error('Error retrieving messages:', error);
            return [];
        }
    }

    async getStudentName(id) {
        try {
            const [rows] = await this.pool.query(
                'SELECT first_name FROM accounts WHERE id = ?',
                [id]
            );

            if (rows.length > 0) {
                const firstName = rows[0].first_name;
                return firstName || "Name not set";
            }
            return "No account found.";
        } catch (error) {
            console.error('Error retrieving student name:', error);
            return "Unable to retrieve the name at this time.";
        }
    }

    async saveStudentName(id, firstName) {
        try {
            await this.pool.query(
                'UPDATE accounts SET first_name = ? WHERE id = ?',
                [firstName, id]
            );
            return "First name saved successfully.";
        } catch (error) {
            console.error('Error saving student first name:', error);
            return "Unable to save the name at this time.";
        }
    }

    // Add this method to get the last user message ID
    async getLastUserMessageId(userId) {
        try {
            const [rows] = await this.pool.query(
                'SELECT id FROM messages WHERE account_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1',
                [userId, 'user']
            );
            if (rows.length > 0) {
                return rows[0].id;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error retrieving last user message ID:', error);
            throw error;
        }
    }

    // New methods for internship-related queries
    async getInternshipAccounts() {
        try {
            const [rows] = await this.pool.query(
                `SELECT
                    id,
                    first_name,
                    last_name,
                    email_address,
                    field
                FROM accounts
                WHERE internship_experience = 1`
            );
            return rows;
        } catch (error) {
            console.error('Error retrieving internship accounts:', error);
            throw error;
        }
    }

    async updateInternshipStatus(accountId, hasInternship) {
        try {
            await this.pool.query(
                'UPDATE accounts SET internship_experience = ? WHERE id = ?',
                [hasInternship ? 1 : 0, accountId]
            );
            return true;
        } catch (error) {
            console.error('Error updating internship status:', error);
            return false;
        }
    }

    /*
    TODO: Create logic to flag a message for review

    async flagMessage(messageId) {
        try {
            await this.pool.query(
                'UPDATE messages SET flagged = ? WHERE messageId = ?',
                [1, messageId]
            );
            return "Message flagged successfully.";
        } catch (error) {
            console.error('Error flagging message:', error);
            return "Unable to flag the message at this time.";
        }
    }
    */
}

export const dbService = new DatabaseService();
