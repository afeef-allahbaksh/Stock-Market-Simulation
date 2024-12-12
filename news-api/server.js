// server.js
const express = require('express');
const cors = require('cors');
const newsRoutes = require('./news-api/routes/news'); // Import news routes
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON bodies
app.use(express.static('news-api/public')); // Serve static files from the public directory

app.use('/api/news', newsRoutes); // Use news routes for API calls

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
