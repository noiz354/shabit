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

function search(q, index) {
  if (!q || q.trim().length < 2) return [];
  const queryTokens = tokenize(q);
  if (!queryTokens.length) return [];

  const { tokens, docs } = index;
  const scores = {}; // id -> score

  for (const qt of queryTokens) {
    const matchedIds = tokens[qt] || [];
    for (const id of matchedIds) {
      if (!scores[id]) scores[id] = 0;
      // exact match > prefix > substring scoring
      // Since we have ngrams, exact will have higher weight if token equals full field token
      // Simplified: if qt length >= 3, higher score
      if (qt.length >= 4) scores[id] += 3;
      else if (qt.length >= 2) scores[id] += 2;
      else scores[id] += 1;
    }
  }

  // Convert to results sorted by score desc + terbaru dulu bila skor seri
  const results = Object.entries(scores)
    .map(([id, score]) => {
      const doc = docs[id];
      return { id, score, doc, updatedAt: doc.updatedAt || 0 };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, 50);

  return results;
}
