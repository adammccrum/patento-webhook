'use strict';

const { ClaudeClient } = require('claude-api');

/**
 * Generate a document using Claude.
 * @param {string} docTitle - The title of the document.
 * @param {string} docContent - The content to be included in the document.
 * @returns {Promise<string>} - The generated document.
 */
async function generateDocument(docTitle, docContent) {
    const client = new ClaudeClient();
    try {
        const response = await client.createDocument({ title: docTitle, content: docContent });
        return response;
    } catch (error) {
        console.error('Error generating document:', error);
        throw error;
    }
}

// Example usage
// (async () => {
//     const document = await generateDocument('My Document', 'This is the content of the document.');
//     console.log(document);
// })();
