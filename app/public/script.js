// script.js
const fetchNews = async (query = 'stocks OR finance OR market') => {
    const response = await fetch(`/api/news?query=${query}`);
    const articles = await response.json();
    displayNews(articles);
};

const displayNews = (articles) => {
    const container = document.getElementById('news-container');
    container.innerHTML = ''; // Clear previous articles
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

document.getElementById('search-button').addEventListener('click', () => {
    const query = document.getElementById('search-input').value || 'stocks OR finance OR market';
    fetchNews(query); // Fetch news based on user input or default to stocks/finance
});

// Initial fetch to load business/stock news by default
fetchNews();
