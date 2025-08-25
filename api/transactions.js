import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import serverless from "serverless-http";

const app = express();
app.use(cors());

// Load JSON
const dataPath = path.join(process.cwd(), "merged.json");
const transactions = fs.existsSync(dataPath)
  ? JSON.parse(fs.readFileSync(dataPath, "utf-8"))
  : [];

// Routes
app.get("/api/transactions", (req, res) => {
  res.json(transactions);
});

app.get("/api/transactions/code/:unqcode", (req, res) => {
  const result = transactions.find(t => t.unqcode === req.params.unqcode);
  result ? res.json(result) : res.status(404).json({ message: "Transaction not found" });
});

app.get("/api/transactions/date/:date", (req, res) => {
  const dateParam = req.params.date;
  const result = transactions.filter(t => t.date.startsWith(dateParam)); // works if date includes timestamp
  result.length ? res.json(result) : res.status(404).json({ message: "No transactions found for this date" });
});

app.get("/api/transactions/range/:start/:end", (req, res) => {
  const { start, end } = req.params;
  const startDate = new Date(start);
  const endDate = new Date(end);

  const result = transactions.filter(t => {
    const tDate = new Date(t.date);
    const day = new Date(tDate.toISOString().slice(0, 10));
    return day >= startDate && day <= endDate;
  });

  result.length ? res.json(result) : res.status(404).json({ message: "No transactions found in this date range" });
});

app.get("/api/transactions/customer/:name", (req, res) => {
  const name = req.params.name.toLowerCase();
  const result = transactions.filter(t => t.customer.toLowerCase().includes(name));
  result.length ? res.json(result) : res.status(404).json({ message: "No transactions found for this customer" });
});

// Export handler for Vercel
export const handler = serverless(app);
