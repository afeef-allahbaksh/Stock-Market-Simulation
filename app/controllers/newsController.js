// controllers/newsController.js
const axios = require('axios');
const env = require("../../env.json");
const NEWS_API_KEY = env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2/everything';

const getNews = async (req, res) => {
    const { query } = req.query;

    try {
        const response = await axios.get(NEWS_API_URL, {
            params: {
                q: query || 'stocks OR finance OR market', // Default to stock/finance-related topics
                language: 'en', // Optional: limit to English articles
                sortBy: 'relevance', // Sort articles by relevance to stocks/finance
                apiKey: NEWS_API_KEY,
            }
        });

        res.json(response.data.articles.slice(0, 10));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching news', error });
    }
};

module.exports = { getNews };
