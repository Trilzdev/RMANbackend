import fs from "fs";
import path from "path";

function getTransactions() {
  const dataPath = path.join(process.cwd(), "merged.json");
  if (!fs.existsSync(dataPath)) return [];
  return JSON.parse(fs.readFileSync(dataPath, "utf-8"));
}

export default function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  const { type, params } = req.query;
  const transactions = getTransactions();

  if (type === "code" && params?.[0]) {
    const result = transactions.find(t => t.unqcode === params[0]);
    return result ? res.status(200).json(result) : res.status(404).json({ message: "Transaction not found" });
  }

  if (type === "date" && params?.[0]) {
    const result = transactions.filter(t => t.date === params[0]);
    return result.length ? res.status(200).json(result) : res.status(404).json({ message: "No transactions found for this date" });
  }

  if (type === "range" && params?.[0] && params?.[1]) {
    const startDate = new Date(params[0]);
    const endDate = new Date(params[1]);
    const result = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate >= startDate && tDate <= endDate;
    });
    return result.length ? res.status(200).json(result) : res.status(404).json({ message: "No transactions found in this date range" });
  }

  if (type === "customer" && params?.[0]) {
    const name = params[0].toLowerCase().trim();
    const result = transactions.filter(t => t.customer.toLowerCase().includes(name));
    return result.length ? res.status(200).json(result) : res.status(404).json({ message: "No transactions found for this customer" });
  }

  return res.status(404).json({ message: "Endpoint not found" });
}
