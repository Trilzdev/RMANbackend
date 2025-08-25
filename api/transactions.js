// api/transactions.js
import fs from "fs";
import path from "path";

function getTransactions() {
  const dataPath = path.join(process.cwd(), "merged.json");
  if (!fs.existsSync(dataPath)) return [];
  return JSON.parse(fs.readFileSync(dataPath, "utf-8"));
}

export default function handler(req, res) {
  const transactions = getTransactions();
  const { method, url } = req;

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (method === "OPTIONS") return res.status(200).end();

  if (method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Remove /api/transactions prefix and trailing slash
  const pathPart = url.replace(/^\/api\/transactions\/?/, "").replace(/\/$/, "");
  const parts = pathPart.split("/"); // ["code", "123"] or ["range", "2025-08-01", "2025-08-24"]

  if (!parts[0] || parts[0] === "") {
    // GET /api/transactions → all
    return res.status(200).json(transactions);
  }

  const type = parts[0];
  const param1 = parts[1];
  const param2 = parts[2];

  switch (type) {
    case "code":
      if (!param1) return res.status(400).json({ message: "Missing code" });
      const byCode = transactions.find(t => t.unqcode === param1);
      return byCode
        ? res.status(200).json(byCode)
        : res.status(404).json({ message: "Transaction not found" });

    case "date":
      if (!param1) return res.status(400).json({ message: "Missing date" });
      const byDate = transactions.filter(t => {
        const tDate = new Date(t.date);
        const paramDate = new Date(param1);
        return tDate.toISOString().slice(0, 10) === paramDate.toISOString().slice(0, 10);
      });
      return byDate.length
        ? res.status(200).json(byDate)
        : res.status(404).json({ message: "No transactions found for this date" });

    case "range":
      if (!param1 || !param2)
        return res.status(400).json({ message: "Missing start or end date" });
      const start = new Date(param1);
      const end = new Date(param2);
      const inRange = transactions.filter(t => {
        const tDate = new Date(t.date);
        const tDay = new Date(tDate.toISOString().slice(0, 10));
        return tDay >= start && tDay <= end;
      });
      return inRange.length
        ? res.status(200).json(inRange)
        : res.status(404).json({ message: "No transactions found in this date range" });

    case "customer":
      if (!param1) return res.status(400).json({ message: "Missing customer name" });
      const name = param1.toLowerCase().trim();
      const byCustomer = transactions.filter(t =>
        t.customer.toLowerCase().includes(name)
      );
      return byCustomer.length
        ? res.status(200).json(byCustomer)
        : res.status(404).json({ message: "No transactions found for this customer" });

    default:
      return res.status(404).json({ message: "Endpoint not found" });
  }
}
