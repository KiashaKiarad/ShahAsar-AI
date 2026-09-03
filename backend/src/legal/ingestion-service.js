const { fetchOfficialSource, ingestEvidence } = require("./ingestor");
const { attachChunks } = require("./chunker");
const { isKnownIranSourceType } = require("./iran-source-taxonomy");

function buildEvidenceFromFetchedSource({ fetched, metadata = {} }) {
  const sourceType = String(metadata.sourceType || "").trim().toLowerCase();
  if (!isKnownIranSourceType(sourceType)) {
    throw new Error("SOURCE_TYPE_NOT_SUPPORTED");
  }

  return ingestEvidence({
    id: metadata.id,
    jurisdiction: "IR",
    sourceType,
    authority: metadata.authority,
    title: metadata.title,
    citation: metadata.citation,
    article: metadata.article,
    paragraph: metadata.paragraph,
    text: fetched.text,
    sourceUrl: fetched.url,
    publishedOn: metadata.publishedOn,
    effectiveFrom: metadata.effectiveFrom,
    effectiveTo: metadata.effectiveTo,
    status: metadata.status || "unknown",
    retrievedAt: metadata.retrievedAt
  });
}

async function ingestOfficialUrl({ url, metadata, chunkOptions } = {}) {
  const fetched = await fetchOfficialSource(url);
  const evidence = buildEvidenceFromFetchedSource({ fetched, metadata });
  const chunks = attachChunks(evidence, chunkOptions);

  return {
    evidence,
    chunks,
    fetch: {
      url: fetched.url,
      contentType: fetched.contentType,
      status: fetched.status,
      contentHash: fetched.contentHash,
      characterCount: fetched.text.length
    }
  };
}

module.exports = {
  buildEvidenceFromFetchedSource,
  ingestOfficialUrl
};
