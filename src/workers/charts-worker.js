/**
 * HabitWealth charts worker — AUD-WORK-01
 * - ECharts data crunch off main thread (spec 16)
 * - Structured clone + MessageChannel
 */

self.onmessage = (e) => {
  const { type, payload, id } = e.data || {};

  if (type === "crunch-cashflow") {
    try {
      const { transactions, range } = payload;
      const result = crunchCashflow(transactions, range);
      self.postMessage({ id, type: "crunched", result });
    } catch (err) {
      self.postMessage({ id, type: "error", error: String(err) });
    }
  } else if (type === "crunch-habit") {
    try {
      const { entries, range } = payload;
      const result = crunchHabit(entries, range);
      self.postMessage({ id, type: "crunched", result });
    } catch (err) {
      self.postMessage({ id, type: "error", error: String(err) });
    }
  }
};

function crunchCashflow(transactions, range) {
  // transactions: [{amount, kind, category, date}]
  // range: {from, to}
  const byCategory = {};
  let totalIn = 0;
  let totalOut = 0;

  for (const tx of transactions) {
    const cat = tx.category || "Lainnya";
    if (!byCategory[cat]) byCategory[cat] = 0;
    byCategory[cat] += tx.amount || 0;
    if (tx.kind === "income") totalIn += tx.amount || 0;
    else totalOut += tx.amount || 0;
  }

  const byCategoryArr = Object.entries(byCategory).map(([key, total]) => ({ key, total }));

  return { byCategory: byCategoryArr, totalIn, totalOut, count: transactions.length };
}

function crunchHabit(entries, range) {
  // entries: [{date, status}]
  const byDate = {};
  let done = 0;
  let total = entries.length;

  for (const e of entries) {
    const d = e.date;
    if (!byDate[d]) byDate[d] = { done: 0, total: 0 };
    byDate[d].total++;
    if (e.status === "done") {
      byDate[d].done++;
      done++;
    }
  }

  return { byDate, done, total, completionRate: total ? done / total : 0 };
}
