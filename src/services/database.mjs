import mysql from 'mysql2/promise';
import { config } from '../config/config.mjs';

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

    async getOrCreateAccount(phoneNumber, isPhone = true) {
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

            const thread = await openai.beta.threads.create();
            const threadId = thread.id;

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

    async saveMessage(id, role, text) {
        try {
            await this.pool.query(
                'INSERT INTO messages (account_id, role, text) VALUES (?, ?, ?)',
                [id, role, text]
            );
            // console.log('Message saved:', { id, role, text });
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    }

    async getMessages(id, limit) {
        try {
            const [rows] = await this.pool.query(
                'SELECT role, text FROM messages WHERE account_id = ? ORDER BY created_at DESC LIMIT ?',
                [id, limit]
            );

            const messages = rows.reverse().map(row => ({
                role: row.role,
                content: row.text,
            }));

            return messages;
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
                console.log(`Retrieved name '${firstName}' for account ${id}`);
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