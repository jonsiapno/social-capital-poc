import { ChromaClient } from "chromadb";
import { config } from "../config/config.mjs";

async function deleteCollection(client, collectionName) {
    try {
        await client.deleteCollection({
            name: collectionName
        });
        console.log(`Collection ${collectionName} deleted successfully`);
    } catch (error) {
        console.error('Error deleting collection:', error);
    }
}

async function createCollection(client, collectionName) {
    try {
        const collection = await client.createCollection({
            name: collectionName,
            metadatas: {
                "description": "My first collection"
            }
        });
        console.log(`Collection ${collectionName} created successfully`);
        return collection;
    } catch (error) {
        console.error('Error creating collection:', error);
        return null;
    }
}

async function addToCollection(collection, documents, metadatas, ids) {
    try {
        await collection.add({
            documents: documents,
            metadatas: metadatas,
            ids: ids
        });
        console.log('Items added successfully');
    } catch (error) {
        console.error('Error adding items:', error);
    }
}

async function queryCollection(collection, queryTexts, numResults = 2) {
    try {
        const results = await collection.query({
            queryTexts: queryTexts,
            nResults: numResults
        });

        // Sort results by distance (closest first)
        const sortedResults = results.ids[0].map((id, index) => ({
            id: id,
            document: results.documents[0][index],
            metadata: results.metadatas[0][index],
            distance: results.distances[0][index]
        })).sort((a, b) => a.distance - b.distance);

        console.log('Sorted Query Results:');
        sortedResults.forEach(result => {
            console.log(`ID: ${result.id}`);
            console.log(`Document: ${result.document}`);
            console.log(`Metadata: ${JSON.stringify(result.metadata)}`);
            console.log(`Distance: ${result.distance}`);
            console.log('---');
        });

        return sortedResults;
    } catch (error) {
        console.log('Error querying collection:', error);
        return null;
    }
}

async function initializeAndQuery() {
    const chromaClient = new ChromaClient({
        path: config.chroma.url
    });

    try {
        let retries = 5;
        while (retries > 0) {
            try {
                await chromaClient.heartbeat();
                console.log("Successfully connected to ChromaDB");
                break;
            } catch (error) {
                console.log(`Waiting for ChromaDB to be ready... (${retries} attempts remaining)`);
                retries--;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        if (retries === 0) {
            throw new Error("Failed to connect to ChromaDB");
        } 

        const collectionName = 'my_collection';
        await deleteCollection(chromaClient, collectionName);
        const collection = await createCollection(chromaClient, collectionName);

        if (collection) {
            const documents = [
                "The quick brown fox jumps over the lazy dog",
                "Hello, world!",
                "ChromaDB is awesome"
            ];
            const metadatas = [
                { source: "example1" },
                { source: "example2" },
                { source: "example3" }
            ];
            const ids = ["id1", "id2", "id3"];

            await addToCollection(collection, documents, metadatas, ids);
            await queryCollection(collection, ["fox"]);
        }
    } catch (error) {
        console.error("Application error:", error);
    }
}

initializeAndQuery();