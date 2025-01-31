// src/services/chroma.mjs

import { ChromaClient } from 'chromadb';
import { config } from '../config/config.mjs';
import { dbService } from './database.mjs';

class ChromaService {
    constructor() {
        this.client = new ChromaClient({ path: config.chroma.url });
        this.collectionName = 'my_collection';
    }

    async connect() {
        let retries = 5;
        while (retries > 0) {
            try {
                await this.client.heartbeat();
                return true;
            } catch (error) {
                retries--;
                await new Promise(resolve => setTimeout(resolve, 2000));
                if (retries === 0) {
                    throw new Error('Failed to connect to ChromaDB after multiple attempts');
                }
            }
        }
    }

    async deleteCollection() {
        try {
            await this.client.deleteCollection({ name: this.collectionName });
            return true;
        } catch (error) {
            // Collection might not exist, ignore error
            return false;
        }
    }

    async createCollection() {
        try {
            return await this.client.createCollection({
                name: this.collectionName,
                metadatas: {
                    description: 'Student internship experience collection'
                }
            });
        } catch (error) {
            console.error('Error creating collection:', error);
            throw error;
        }
    }

    async addToCollection(collection, documents, metadatas, ids) {
        try {
            await collection.add({ documents, metadatas, ids });
            return true;
        } catch (error) {
            console.error('Error adding items to collection:', error);
            throw error;
        }
    }

    async queryCollection(collection, queryTexts, numResults = 3) {
        try {
            const results = await collection.query({
                queryTexts,
                nResults: numResults
            });

            return {
                metadata: "Results ranked in order of relevance (smaller distance is better)",
                results: results.ids[0].map((id, index) => ({
                    id,
                    document: results.documents[0][index],
                    metadata: results.metadatas[0][index],
                    distance: results.distances[0][index]
                })).sort((a, b) => a.distance - b.distance)
            };
        } catch (error) {
            console.error('Error querying collection:', error);
            throw error;
        }
    }

    async initializeAndQuery(searchQuery) {
        try {
            // Connect to ChromaDB
            await this.connect();

            // Reset and create collection
            await this.deleteCollection();
            const collection = await this.createCollection();

            // Get internship data from database
            const accountData = await dbService.getInternshipAccounts();

            if (accountData.length === 0) {
                return { results: [] };
            }

            // Prepare data for Chroma
            const documents = accountData.map(row =>
                `${row.first_name} ${row.last_name} is a college student who is pursuing a career in ${row.field} and they have already had a relevant internship.`
            );

            const metadatas = accountData.map(row => ({
                id: row.id,
                firstName: row.first_name,
                lastName: row.last_name,
                email: row.email_address,
                field: row.field
            }));

            const ids = accountData.map(row => `${row.id}`);

            // Add data to collection and perform search
            await this.addToCollection(collection, documents, metadatas, ids);
            return await this.queryCollection(collection, [searchQuery]);
        } catch (error) {
            console.error('Error in initializeAndQuery:', error);
            throw error;
        }
    }
}

export const chromaService = new ChromaService();