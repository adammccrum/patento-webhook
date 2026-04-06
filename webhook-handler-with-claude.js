const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Middleware to handle webhook events
app.post('/webhook', async (req, res) => {
    const event = req.body;

    // Handle the webhook event here
    console.log('Received webhook:', event);

    try {
        // Example integration with Claude API
        const response = await axios.post('https://api.claude.ai/endpoint', {
            data: event
        });

        console.log('Response from Claude:', response.data);
        res.status(200).send('Webhook received and processed.');
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Error processing webhook.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
