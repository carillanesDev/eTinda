/**
 * Product management domain utilities
 * Handles duplicate naming and catalog helpers.
 */

/**
 * Generates a duplicated product name by appending " (2)" to the product name.
 * If the product name already ends in an enumeration like " (2)", it increments it (e.g. " (3)").
 * If the resulting candidate name already exists in the catalog, it increments until an unused name is found,
 * preventing unique constraint violations (@@unique([storeId, name])).
 */
export function generateDuplicateProductName(
  currentName: string,
  existingNames: string[] = []
): string {
  const trimmed = currentName.trim();
  if (!trimmed) {
    return "Product (2)";
  }

  const lowerExisting = new Set(
    existingNames.map((n) => n.trim().toLowerCase())
  );

  const match = trimmed.match(/^(.*?)(?:\s*\((\d+)\))$/);
  let baseName = trimmed;
  let startNum = 2;

  if (match && match[1]) {
    baseName = match[1].trim();
    startNum = parseInt(match[2], 10) + 1;
  }

  let counter = startNum;
  let candidate = match ? `${baseName} (${counter})` : `${trimmed} (2)`;

  while (lowerExisting.has(candidate.toLowerCase())) {
    counter++;
    candidate = `${baseName} (${counter})`;
  }

  return candidate;
}

