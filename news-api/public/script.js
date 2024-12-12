// script.js
const fetchNews = async (stockSymbols) => {
    const stockQuery = stockSymbols.join(' OR '); // Create query for invested stocks
    const loadingIndicator = document.getElementById('loading-indicator');
    loadingIndicator.style.display = 'block'; // Show loading indicator

    try {
        const response = await fetch(`/api/news?query=${stockQuery}`); // Fetch news based on user input
        if (!response.ok) throw new Error('Network response was not ok');
        const articles = await response.json();
        displayNews(articles, stockSymbols[0]); // Pass the stock symbol to display
    } catch (error) {
        displayError('Error fetching news: ' + error.message);
    } finally {
        loadingIndicator.style.display = 'none'; // Hide loading indicator
    }
};

const displayNews = (articles, stockSymbol) => {
    const container = document.getElementById('news-container');
    container.innerHTML = ''; // Clear previous articles
    const header = document.createElement('h2');
    header.textContent = `News for ${stockSymbol}`;
    container.appendChild(header); // Display stock symbol

    articles.forEach(article => {
        const articleDiv = document.createElement('div');
        articleDiv.className = 'article';
        articleDiv.innerHTML = `
            <h3>${article.title}</h3>
            <p>${article.description || 'No description available.'}</p>
            <a href="${article.url}" target="_blank">Read more</a>
        `;
        container.appendChild(articleDiv); // Append article to the container
    });
};

const displayError = (message) => {
    const container = document.getElementById('news-container');
    container.innerHTML = `<p style="color: red;">${message}</p>`; // Display error message
};

// Function to handle stock input
const handleStockInput = () => {
    const stockSymbol = document.getElementById('stock-input').value.trim().toUpperCase(); // Get user input for stock
    if (stockSymbol) {
        fetchNews([stockSymbol]); // Fetch news for the input stock symbol
    }
};

// Function to clear previous results
const clearResults = () => {
    document.getElementById('news-container').innerHTML = ''; // Clear news container
    document.getElementById('stock-input').value = ''; // Clear input field
};

// Add event listeners for the buttons
document.getElementById('fetch-button').addEventListener('click', handleStockInput);
document.getElementById('clear-button').addEventListener('click', clearResults);
