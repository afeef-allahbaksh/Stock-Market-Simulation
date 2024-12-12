const http = require("http");
const express = require("express");
const axios = require("axios");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 3000;
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

app.use(cookieParser());

// Load environment variables from env.json
const env = require("../env.json");
let apiKey = env.API_KEY;
const apiUrl =
  "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=";
const portfolio = [];

//console.log("API Key:", apiKey);

const { Pool } = require("pg");

// Initialize the pool with your database credentials
const pool = new Pool({
  user: env.user, // Replace with your database username
  host: env.host, // Replace with your database host, usually 'localhost'
  database: env.db_name, // Replace with your database name
  password: env.password, // Replace with your database password
  port: env.post, // Replace with your database port, usually 5432
});

//log the requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const newsRoutes = require("./routes/news");

app.use("/api/news", newsRoutes);

app.use(express.urlencoded({ extended: true }));

function authenticateToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Access token missing" });
  }

  jwt.verify(token, env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

//Simple function to see if you have connected to the API or not.
app.get("/api/status", async (req, res) => {
  try {
    let response = await axios.get(`${apiUrl}AAPL&apikey=${apiKey}`);

    //Global quote is one of the things you recieve no matter what, so if you dont get this, the API is not connected.
    if (response.data && response.data["Global Quote"]) {
      res.status(200).json({ status: "connected" });
    } else {
      res.status(400).json({ status: "disconnected" });
    }
  } catch (error) {
    res.status(500).json({ status: "disconnected" });
  }
});

app.get("/api/stock/:symbol", authenticateToken, async (req, res) => {
  const symbol = req.params.symbol;
  try {
    const response = await axios.get("https://www.alphavantage.co/query", {
      params: {
        function: "GLOBAL_QUOTE",
        symbol: symbol,
        apikey: apiKey,
      },
    });

    // Log the full response data
    console.log("Alpha Vantage response data:", response.data);
    console.log(
      "Stock price:",
      response.data["Global Quote"]
        ? response.data["Global Quote"]["05. price"]
        : "Price not found",
    );

    // Check if the expected data structure is present
    if (response.data["Global Quote"]) {
      res.json(response.data);
    } else {
      // Handle case where expected data is missing
      res.status(404).json({ error: "Stock data not found" });
    }
  } catch (error) {
    console.error(
      "Error fetching stock data:",
      error.response ? error.response.data : error.message,
    );
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});

app.post("/api/invest", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { symbol, amount } = req.body;
  if (!symbol || !amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid symbol or amount" });
  }
  try {
    const response = await axios.get("https://www.alphavantage.co/query", {
      params: {
        function: "GLOBAL_QUOTE",
        symbol: symbol,
        apikey: apiKey,
      },
    });
    let globalQuote = response.data["Global Quote"];
    if (!globalQuote || !globalQuote["05. price"]) {
      //simulate price because I am out of API calls. just generating a random price
      globalQuote = {};
      globalQuote["05. price"] = Math.random() * 200;
    }
    const stockPrice = parseFloat(globalQuote["05. price"]);
    const totalCost = amount * stockPrice;
    const userResult = await pool.query(
      "SELECT balance FROM users WHERE id = $1",
      [userId],
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    let userBalance = parseFloat(userResult.rows[0].balance);
    if (userBalance < totalCost) {
      return res
        .status(400)
        .json({ error: "Insufficient balance to invest in this stock" });
    }
    userBalance -= totalCost;
    await pool.query("UPDATE users SET balance = $1 WHERE id = $2", [
      userBalance,
      userId,
    ]);
    const portfolioResult = await pool.query(
      "SELECT * FROM portfolios WHERE user_id = $1 AND symbol = $2",
      [userId, symbol],
    );
    if (portfolioResult.rows.length > 0) {
      const existingAmount = parseInt(portfolioResult.rows[0].amount);
      const existingAvgPrice = parseFloat(
        portfolioResult.rows[0].average_price,
      );
      const newAmount = existingAmount + amount;
      const newAvgPrice =
        (existingAmount * existingAvgPrice + amount * stockPrice) / newAmount;
      await pool.query(
        "UPDATE portfolios SET amount = $1, average_price = $2 WHERE user_id = $3 AND symbol = $4",
        [newAmount, newAvgPrice, userId, symbol],
      );
    } else {
      await pool.query(
        "INSERT INTO portfolios (user_id, symbol, amount, average_price) VALUES ($1, $2, $3, $4)",
        [userId, symbol, amount, stockPrice],
      );
    }
    await pool.query(
      "INSERT INTO purchases (user_id, symbol, amount, price) VALUES ($1, $2, $3, $4)",
      [userId, symbol, amount, stockPrice],
    );
    res.status(200).json({ message: "Investment successful" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to process investment" });
  }
});

app.get("/api/balance", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query("SELECT balance FROM users WHERE id = $1", [
      userId,
    ]);
    if (result.rows.length > 0) {
      const balance = parseFloat(result.rows[0].balance);
      res.status(200).json({ balance });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

app.get("/api/portfolio", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      "SELECT symbol, amount, average_price FROM portfolios WHERE user_id = $1",
      [userId],
    );
    res.status(200).json({ portfolio: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

// Handle stock transactions (both buy and sell)
app.post("/api/transaction", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { symbol, amount, type } = req.body; // type will be either 'buy' or 'sell'

  if (!symbol || !amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid symbol or amount" });
  }

  try {
    // Fetch current stock price
    const response = await axios.get("https://www.alphavantage.co/query", {
      params: {
        function: "GLOBAL_QUOTE",
        symbol: symbol,
        apikey: apiKey,
      },
    });

    let globalQuote = response.data["Global Quote"];
    if (!globalQuote || !globalQuote["05. price"]) {
      //simulate price because of API call limits
      globalQuote = {};
      globalQuote["05. price"] = Math.random() * 200;
    }

    const stockPrice = parseFloat(globalQuote["05. price"]);
    const totalAmount = amount * stockPrice;

    // Get user's current balance
    const userResult = await pool.query(
      "SELECT balance FROM users WHERE id = $1",
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    let userBalance = parseFloat(userResult.rows[0].balance);

    if (type === "buy") {
      // Check if user has enough balance
      if (userBalance < totalAmount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      userBalance -= totalAmount;

      // Update portfolio
      const portfolioResult = await pool.query(
        "SELECT * FROM portfolios WHERE user_id = $1 AND symbol = $2",
        [userId, symbol],
      );

      if (portfolioResult.rows.length > 0) {
        const existingAmount = parseInt(portfolioResult.rows[0].amount);
        const existingAvgPrice = parseFloat(
          portfolioResult.rows[0].average_price,
        );
        const newAmount = existingAmount + amount;
        const newAvgPrice =
          (existingAmount * existingAvgPrice + amount * stockPrice) / newAmount;

        await pool.query(
          "UPDATE portfolios SET amount = $1, average_price = $2 WHERE user_id = $3 AND symbol = $4",
          [newAmount, newAvgPrice, userId, symbol],
        );
      } else {
        await pool.query(
          "INSERT INTO portfolios (user_id, symbol, amount, average_price) VALUES ($1, $2, $3, $4)",
          [userId, symbol, amount, stockPrice],
        );
      }

      // Record purchase
      await pool.query(
        "INSERT INTO purchases (user_id, symbol, amount, price) VALUES ($1, $2, $3, $4)",
        [userId, symbol, amount, stockPrice],
      );
    } else if (type === "sell") {
      // Check if user has enough stocks to sell
      const portfolioResult = await pool.query(
        "SELECT * FROM portfolios WHERE user_id = $1 AND symbol = $2",
        [userId, symbol],
      );

      if (
        portfolioResult.rows.length === 0 ||
        portfolioResult.rows[0].amount < amount
      ) {
        return res.status(400).json({ error: "Insufficient stocks to sell" });
      }

      const existingAmount = parseInt(portfolioResult.rows[0].amount);
      const newAmount = existingAmount - amount;
      userBalance += totalAmount;

      if (newAmount === 0) {
        await pool.query(
          "DELETE FROM portfolios WHERE user_id = $1 AND symbol = $2",
          [userId, symbol],
        );
      } else {
        await pool.query(
          "UPDATE portfolios SET amount = $1 WHERE user_id = $2 AND symbol = $3",
          [newAmount, userId, symbol],
        );
      }

      // Record sell as a negative purchase
      await pool.query(
        "INSERT INTO purchases (user_id, symbol, amount, price) VALUES ($1, $2, $3, $4)",
        [userId, symbol, -amount, stockPrice],
      );
    }

    // Update user balance
    await pool.query("UPDATE users SET balance = $1 WHERE id = $2", [
      userBalance,
      userId,
    ]);

    res
      .status(200)
      .json({ message: `${type.toUpperCase()} transaction successful` });
  } catch (error) {
    console.error("Transaction error:", error);
    res.status(500).json({ error: "Failed to process transaction" });
  }
});

// Modify your existing purchase history endpoint to handle both buys and sells
app.get("/api/transaction-history", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      "SELECT symbol, amount, price, timestamp FROM purchases WHERE user_id = $1 ORDER BY timestamp DESC",
      [userId],
    );

    // Transform the data to include transaction type
    const history = result.rows.map((row) => ({
      ...row,
      type: row.amount > 0 ? "BUY" : "SELL",
      amount: Math.abs(row.amount), // Convert negative amounts back to positive for display
    }));

    res.status(200).json({ history });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch transaction history" });
  }
});

app.get("/api/purchase-history", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      "SELECT symbol, amount, price, timestamp FROM purchases WHERE user_id = $1 ORDER BY timestamp DESC",
      [userId],
    );
    res.status(200).json({ history: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch purchase history" });
  }
});

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
      [username, hashedPassword],
    );
    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    if (err.code === "23505") {
      res.status(409).json({ message: "User already exists" });
    } else {
      res
        .status(500)
        .json({ message: "Error creating user", error: err.message });
    }
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        const token = jwt.sign(
          { userId: user.id, username: user.username },
          env.JWT_SECRET,
          { expiresIn: "7d" },
        );
        res.cookie("token", token, {
          httpOnly: true,
          maxAge: 1000 * 60 * 60 * 24 * 7,
        });
        return res.status(200).json({ message: "Login successful" });
      } else {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    } else {
      res.status(401).json({ message: "User not found" });
    }
  } catch (err) {
    console.error("Error logging in:", err);
    res.status(500).json({ message: "Error logging in" });
  }
});

app.post("/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized: Please log in" });
  }

  const username = req.session.user.username;

  if (!newPassword) {
    return res.status(400).json({ message: "New password is required" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        const token = jwt.sign(
          { userId: user.id, username: user.username },
          env.JWT_SECRET,
          { expiresIn: "7d" },
        );
        res.cookie("token", token, {
          httpOnly: true,
          maxAge: 1000 * 60 * 60 * 24 * 7,
        });
        return res.status(200).json({ message: "Login successful" });
      } else {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    } else {
      res.status(401).json({ message: "User not found" });
    }
  } catch (err) {
    console.error("Error logging in:", err);
    res.status(500).json({ message: "Error logging in" });
  }
});

app.post("/changepassword", authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ message: "New password is required" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      req.user.username,
    ]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        return res
          .status(401)
          .json({ message: "Current password is incorrect" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query("UPDATE users SET password = $1 WHERE username = $2", [
        hashedPassword,
        req.user.username,
      ]);

      res.status(200).json({ message: "Password changed successfully" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    console.error("Error changing password:", err);
    res.status(500).json({ message: "Error changing password" });
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out successfully" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
