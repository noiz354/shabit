/**
 * HabitWealth search indexer worker — AUD-WORK-01 + AUD-SEARCH-01
 * APIs 131,59,137,138,139,173: Web Workers, MessageChannel, Structured Clone, scheduler.postTask, requestIdleCallback, hardwareConcurrency
 * - Token lowercase per field (split spasi + edge-ngram prefix max 8 char untuk judul/nama; angka dinormalisasi tanpa titik)
 * - Update incremental tiap mutasi + rebuild penuh setelah sync; batasi ~2000 dokumen terbaru
 */

self.onmessage = (e) => {
  const { type, payload, id } = e.data || {};

  if (type === "index") {
    // payload: {docs: [{id, type, title, note, category, amount, ...}]}
    try {
      const docs = payload.docs || [];
      const index = buildIndex(docs);
      self.postMessage({ id, type: "indexed", index, count: docs.length });
    } catch (err) {
      self.postMessage({ id, type: "error", error: String(err) });
    }
  } else if (type === "search") {
    // payload: {q, index}
    try {
      const results = search(payload.q, payload.index);
      self.postMessage({ id, type: "results", results, q: payload.q });
    } catch (err) {
      self.postMessage({ id, type: "error", error: String(err) });
    }
  }
};

function tokenize(text) {
  if (!text) return [];
  const lower = String(text).toLowerCase();
  // split spasi + normalize angka tanpa titik
  const normalized = lower.replace(/\./g, "").replace(/rp/g, "").trim();
  const tokens = normalized.split(/[\s,;]+/).filter(Boolean);
  // edge-ngram prefix max 8 char untuk judul/nama
  const ngrams = [];
  for (const token of tokens) {
    ngrams.push(token);
    // prefix up to 8
    for (let i = 1; i <= Math.min(8, token.length - 1); i++) {
      ngrams.push(token.slice(0, i));
    }
  }
  return [...new Set(ngrams)];
}

function buildIndex(docs) {
  // docs: array of {id, type, title, note, category, amount, etc}
  // index: {tokens: Map token->Set id, docs: Map id->doc}
  const tokenMap = {};
  const docMap = {};

  const limited = docs.slice(0, 2000); // batasi ~2000 terbaru

  for (const doc of limited) {
    const id = doc.id;
    docMap[id] = doc;

    const fields = [
      doc.title,
      doc.note,
      doc.category,
      doc.amount ? String(doc.amount).replace(/\./g, "") : "",
      doc.source,
      doc.merchant,
    ].filter(Boolean).join(" ");

    const tokens = tokenize(fields);
    for (const token of tokens) {
      if (!tokenMap[token]) tokenMap[token] = [];
      if (!tokenMap[token].includes(id)) tokenMap[token].push(id);
    }
  }

  return { tokens: tokenMap, docs: docMap };
}


// Kualitas kecocokan per token query (spec 19: exact > prefix > substring), dihitung dari teks dokumen —
// bukan dari akumulasi n-gram (yang membuat "kopitiam" mengalahkan "kopi").
function docText(doc) {
  return [doc.title, doc.note, doc.category, doc.amount ? String(doc.amount).replace(/\./g, "") : "", doc.source, doc.merchant]
    .filter(Boolean).join(" ").toLowerCase().replace(/\./g, "");
}
function matchQuality(doc, qt) {
  const text = docText(doc);
  if (!text) return 0;
  const words = text.split(/[\s,;]+/).filter(Boolean);
  if (words.includes(qt)) return 3;
  if (words.some((w) => w.startsWith(qt))) return 2;
  if (text.includes(qt)) return 1;
  return 0;
}
function scoreCandidates(queryTokens, index) {
  const { tokens, docs } = index;
  const candidates = new Set();
  for (const qt of queryTokens) {
    for (const [token, ids] of Object.entries(tokens)) {
      if (token === qt || token.startsWith(qt) || token.includes(qt)) ids.forEach((id) => candidates.add(id));
    }
  }
  const results = [];
  for (const id of candidates) {
    const doc = docs[id];
    if (!doc) continue;
    let score = 0;
    for (const qt of queryTokens) score += matchQuality(doc, qt);
    if (score > 0) results.push({ id, score, doc, updatedAt: doc.updatedAt || 0 });
  }
  return results.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
}

function search(q, index) {
  if (!q || q.trim().length < 2) return [];
  const queryTokens = String(q).toLowerCase().replace(/\./g, "").replace(/rp/g, "").trim().split(/[\s,;]+/).filter(Boolean);
  if (!queryTokens.length) return [];
  return scoreCandidates(queryTokens, index).slice(0, 50);
}
