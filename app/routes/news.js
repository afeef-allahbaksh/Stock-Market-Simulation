
const express = require('express');
const { getNews } = require('../controllers/newsController'); // Import the news controller
const router = express.Router();

router.get('/', getNews); // Define GET route for fetching news

module.exports = router; // Export the router
