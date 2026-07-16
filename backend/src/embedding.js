const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";

// nomic-embed-text distinguishes documents from queries via a task prefix,
// not an input_type param like Voyage/OpenAI -- same idea, different mechanism.
function withPrefix(text, inputType) {
  const prefix = inputType === "query" ? "search_query: " : "search_document: ";
  return `${prefix}${text}`;
}

export async function embedTexts(texts, inputType) {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map((t) => withPrefix(t, inputType)),
    }),
  });
  if (!res.ok) throw new Error(`ollama embed failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.embeddings;
}