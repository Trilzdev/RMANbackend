// File: api/stockhistory.js
import { MongoClient } from "mongodb";

let client;
let clientPromise;

if (!clientPromise) {
  client = new MongoClient(process.env.MONGODB_URI);
  clientPromise = client.connect();
}

// Helper to normalize YYYY-MM (pads month)
function normalizeYYYYMM(str) {
  if (!str) return null;
  const [year, month] = str.split("-");
  const mm = month ? month.padStart(2, "0") : "01";
  return `${year}-${mm}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { period, startPeriod, endPeriod } = req.query;

    if (!period && !(startPeriod && endPeriod)) {
      return res.status(400).json({
        error:
          "Please provide either ?period=YYYY-MM or both ?startPeriod=YYYY-MM&endPeriod=YYYY-MM",
      });
    }

    // Build $match object
    let match = {};
    if (period) {
      match.PERIOD_ISO = normalizeYYYYMM(period);
    } else if (startPeriod && endPeriod) {
      match.PERIOD_ISO = {
        $gte: normalizeYYYYMM(startPeriod),
        $lte: normalizeYYYYMM(endPeriod),
      };
    }

    const conn = await clientPromise;
    const db = conn.db("rman"); // <-- replace with your DB name
    const collection = db.collection("stockhistory");

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          unitCost: {
            $cond: [
              { $eq: ["$QTY_BUY", 0] },
              0,
              { $divide: ["$BUY", "$QTY_BUY"] },
            ],
          },
          soldCost: {
            $cond: [
              { $eq: ["$QTY_BUY", 0] },
              0,
              { $multiply: ["$QTY_SOLD", { $divide: ["$BUY", "$QTY_BUY"] }] },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$GROUP_NAME",
          items: { $push: "$$ROOT" },
          totalQtySold: { $sum: "$QTY_SOLD" },
          totalQtyBuy: { $sum: "$QTY_BUY" },
          totalBuy: { $sum: "$BUY" },
          totalSold: { $sum: "$SOLD" },
          totalProfit: { $sum: { $subtract: ["$SOLD", "$soldCost"] } },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const data = await collection.aggregate(pipeline).toArray();

    // Compute grand totals
    const grandTotals = data.reduce(
      (acc, g) => {
        acc.qtySold += g.totalQtySold || 0;
        acc.qtyBuy += g.totalQtyBuy || 0;
        acc.totalBuy += g.totalBuy || 0;
        acc.totalSold += g.totalSold || 0;
        acc.totalProfit += g.totalProfit || 0;
        return acc;
      },
      { qtySold: 0, qtyBuy: 0, totalBuy: 0, totalSold: 0, totalProfit: 0 }
    );

    res.status(200).json({ groups: data, grandTotals });
  } catch (err) {
    console.error("Error fetching stock history:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
