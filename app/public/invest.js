document.addEventListener('DOMContentLoaded', function() {
  // Global variable to store portfolio, purchase history, and balance
  let portfolio = {};
  let purchaseHistory = [];
  let balance = 1000; // Starting balance
  let priceAlerts = {};

  // Function to fetch stock data from the API
  async function fetchStockData(symbol) {
      try {
          const response = await fetch(`/api/stock/${symbol}`);
          const data = await response.json();

          if (data["Global Quote"]) {
              checkPriceAlerts(symbol, parseFloat(data["Global Quote"]["05. price"]));
              return data;
          } else {
              throw new Error("Stock price not found");
          }
      } catch (error) {
          console.error("Error fetching stock data:", error.message);
          throw error;
      }
  }

  // Function to check and trigger price alerts
  function checkPriceAlerts(symbol, currentPrice) {
      if (priceAlerts[symbol]) {
          const alerts = priceAlerts[symbol];
          
          if (alerts.upper && currentPrice >= alerts.upper) {
              alert(`${symbol} has reached or exceeded your upper price alert of $${alerts.upper}`);
              delete priceAlerts[symbol].upper;
          }
          
          if (alerts.lower && currentPrice <= alerts.lower) {
              alert(`${symbol} has reached or fallen below your lower price alert of $${alerts.lower}`);
              delete priceAlerts[symbol].lower;
          }
          
          if (!alerts.upper && !alerts.lower) {
              delete priceAlerts[symbol];
          }
      }
  }

  // Function to set price alerts
  function setPriceAlert(symbol, upperLimit = null, lowerLimit = null) {
      if (!upperLimit && !lowerLimit) {
          alert("Please specify at least one price alert limit");
          return;
      }

      priceAlerts[symbol] = {
          ...(upperLimit && { upper: upperLimit }),
          ...(lowerLimit && { lower: lowerLimit })
      };

      alert(`Price alerts set for ${symbol}`);
  }

  // Function to handle stock transactions (buy/sell)
  async function handleTransaction(symbol, amount, transactionType) {
      try {
          const response = await fetch("/api/transaction", {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
              },
              body: JSON.stringify({ 
                  symbol, 
                  amount, 
                  type: transactionType 
              }),
          });
          
          if (response.ok) {
              alert(`${transactionType.toUpperCase()} transaction successful!`);
              await Promise.all([
                  fetchBalance(),
                  fetchPortfolio(),
                  fetchTransactionHistory()
              ]);
          } else {
              const errorData = await response.json();
              alert(`Error: ${errorData.error}`);
          }
      } catch (error) {
          console.error(`Error during ${transactionType}:`, error);
          alert(`Could not complete ${transactionType}. Please try again.`);
      }
  }

  // Event listeners
  const buyButton = document.getElementById("buy-button");
  if (buyButton) {
      buyButton.addEventListener("click", async () => {
          await handleTransaction(
              document.getElementById("stock-symbol").value.trim().toUpperCase(),
              parseInt(document.getElementById("amount").value.trim()),
              "buy"
          );
      });
  }

  const sellButton = document.getElementById("sell-button");
  if (sellButton) {
      sellButton.addEventListener("click", async () => {
          await handleTransaction(
              document.getElementById("stock-symbol").value.trim().toUpperCase(),
              parseInt(document.getElementById("amount").value.trim()),
              "sell"
          );
      });
  }

  const setAlertButton = document.getElementById("set-alert-button");
  if (setAlertButton) {
      setAlertButton.addEventListener("click", () => {
          const symbol = document.getElementById("alert-symbol").value.trim().toUpperCase();
          const upperLimit = parseFloat(document.getElementById("upper-limit").value);
          const lowerLimit = parseFloat(document.getElementById("lower-limit").value);
          
          setPriceAlert(symbol, 
              !isNaN(upperLimit) ? upperLimit : null,
              !isNaN(lowerLimit) ? lowerLimit : null
          );
      });
  }

  async function fetchBalance() {
      try {
          const response = await fetch("/api/balance", {
              method: "GET",
              headers: {
                  "Content-Type": "application/json",
              },
          });
          if (response.ok) {
              const data = await response.json();
              const balanceElement = document.getElementById("balance");
              if (balanceElement) {
                  balanceElement.innerText = data.balance.toFixed(2);
              }
          } else {
              console.error("Failed to fetch balance");
          }
      } catch (error) {
          console.error("Error fetching balance:", error);
      }
  }

  async function fetchPortfolio() {
      try {
          const response = await fetch("/api/portfolio", {
              method: "GET",
              headers: {
                  "Content-Type": "application/json",
              },
          });
          if (response.ok) {
              const data = await response.json();
              const portfolioList = document.getElementById("portfolio-list");
              if (portfolioList) {
                  portfolioList.innerHTML = "";
                  data.portfolio.forEach((item) => {
                      const li = document.createElement("li");
                      li.innerText = `${item.symbol}: ${item.amount} shares at $${parseFloat(item.average_price).toFixed(2)} each`;
                      portfolioList.appendChild(li);
                  });
              }
          } else {
              console.error("Failed to fetch portfolio");
          }
      } catch (error) {
          console.error("Error fetching portfolio:", error);
      }
  }

  async function fetchTransactionHistory() {
      try {
          const response = await fetch("/api/transaction-history", {
              method: "GET",
              headers: {
                  "Content-Type": "application/json",
              },
          });
          if (response.ok) {
              const data = await response.json();
              const historyList = document.getElementById("transaction-history");
              if (historyList) {
                  historyList.innerHTML = "";
                  data.history.forEach((entry) => {
                      const li = document.createElement("li");
                      li.innerText = `${entry.type ? entry.type.toUpperCase() : 'BUY'}: ${entry.symbol} - ${entry.amount} shares at $${parseFloat(entry.price).toFixed(2)} on ${new Date(entry.timestamp).toLocaleString()}`;
                      historyList.appendChild(li);
                  });
              }
          } else {
              console.error("Failed to fetch transaction history");
          }
      } catch (error) {
          console.error("Error fetching transaction history:", error);
      }
  }

  // Toggle history button event listener
  const toggleHistoryButton = document.getElementById("toggle-history-button");
  if (toggleHistoryButton) {
      toggleHistoryButton.addEventListener("click", function() {
          const historyContainer = document.getElementById("transaction-history-container");
          if (historyContainer) {
              if (historyContainer.style.display === "none") {
                  historyContainer.style.display = "block";
                  fetchTransactionHistory();
                  this.innerText = "Hide Transaction History";
              } else {
                  historyContainer.style.display = "none";
                  this.innerText = "Show Transaction History";
              }
          }
      });
  }

  // Start periodic price checks for alerting
  setInterval(async () => {
      for (const symbol of Object.keys(priceAlerts)) {
          try {
              await fetchStockData(symbol);
          } catch (error) {
              console.error(`Error checking price for ${symbol}:`, error);
          }
      }
  }, 600000); // Check every minute

  // Initial data fetch
  fetchBalance();
  fetchPortfolio();
  fetchTransactionHistory();
});