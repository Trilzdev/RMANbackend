import fs from "fs";
import path from "path";

export default function handler(req, res) {
  // ✅ Allow CORS for all origins (for development)
  res.setHeader("Access-Control-Allow-Origin", "*"); 
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const dataPath = path.join(process.cwd(), "merged.json");
  const rawData = fs.readFileSync(dataPath);
  const transactions = JSON.parse(rawData);

  const { code, date, start, end, customer } = req.query;

  // GET by unique code
  if (code) {
    const result = transactions.find((t) => t.unqcode === code);
    return result
      ? res.status(200).json(result)
      : res.status(404).json({ message: "Transaction not found" });
  }

  // GET by exact date
  if (date) {
    const result = transactions.filter((t) => t.date === date);
    return result.length > 0
      ? res.status(200).json(result)
      : res.status(404).json({ message: "No transactions found for this date" });
  }

  // GET by date range
  if (start && end) {
    const result = transactions.filter((t) => t.date >= start && t.date <= end);
    return result.length > 0
      ? res.status(200).json(result)
      : res.status(404).json({ message: "No transactions found in this date range" });
  }

  // GET by customer
  if (customer) {
    const name = customer.toLowerCase();
    const result = transactions.filter((t) =>
      t.customer.toLowerCase().includes(name)
    );
    return result.length > 0
      ? res.status(200).json(result)
      : res.status(404).json({ message: "No transactions found for this customer" });
  }

  // GET all transactions
  res.status(200).json(transactions);
}
