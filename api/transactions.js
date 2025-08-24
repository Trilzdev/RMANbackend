// api/transactions.js
export default function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Sample transaction data
  const transactions = [
    { unqcode: "TX1001", customer: "Alice", date: "2025-08-24", amount: 1000 },
    { unqcode: "TX1002", customer: "Bob", date: "2025-08-24", amount: 500 },
    { unqcode: "TX1003", customer: "Alice", date: "2025-08-23", amount: 200 }
  ];

  const urlPath = req.url.replace(/^\/api\/transactions\/?/, "").replace(/\/$/, "");
  const parts = urlPath.split("/"); // e.g., ["code","TX1001"]

  if (!parts[0] || parts[0] === "") {
    return res.status(200).json(transactions);
  }

  const type = parts[0];
  const param1 = parts[1];
  const param2 = parts[2];

  switch (type) {
    case "code":
      const byCode = transactions.find(t => t.unqcode === param1);
      return byCode
        ? res.status(200).json(byCode)
        : res.status(404).json({ message: "Transaction not found" });

    case "date":
      const byDate = transactions.filter(t => t.date === param1);
      return byDate.length
        ? res.status(200).json(byDate)
        : res.status(404).json({ message: "No transactions found for this date" });

    case "range":
      const start = new Date(param1);
      const end = new Date(param2);
      const inRange = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= start && tDate <= end;
      });
      return inRange.length
        ? res.status(200).json(inRange)
        : res.status(404).json({ message: "No transactions found in this date range" });

    case "customer":
      const name = param1.toLowerCase();
      const byCustomer = transactions.filter(t =>
        t.customer.toLowerCase() === name
      );
      return byCustomer.length
        ? res.status(200).json(byCustomer)
        : res.status(404).json({ message: "No transactions found for this customer" });

    default:
      return res.status(404).json({ message: "Endpoint not found" });
  }
}
