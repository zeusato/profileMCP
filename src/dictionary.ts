import dictionary from '../config/sha-code-dictionary.json' with { type: 'json' };

// Static, operation-specific reference data only. Never derives labels from account
// data or substitutes a label for the original DTO value. Empty values mean unknown.
export function codeDictionaryFor(operation: string) {
  const entries = dictionary.entries.filter(entry => entry.operation === operation);
  if (!entries.length) return undefined;
  const sourceIds = new Set(entries.flatMap(entry => entry.sourceRefs.map(ref => ref.source)));
  return {
    version: dictionary.version,
    unknownPolicy: dictionary.unknownPolicy,
    evidenceLevels: dictionary.evidenceLevels,
    fields: entries.map(({ operation: _operation, ...entry }) => entry),
    provenance: {
      project: dictionary.sourceProject, commit: dictionary.sourceCommit,
      sources: Object.fromEntries(Object.entries(dictionary.sources).filter(([id]) => sourceIds.has(id))),
    },
  };
}
