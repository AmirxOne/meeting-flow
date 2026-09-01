/** Split a stored full name into given name + family name (first token / rest). */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const i = trimmed.search(/\s+/);
  if (i === -1) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, i).trim(),
    lastName: trimmed.slice(i).trim(),
  };
}

/** Join given + family name back into the stored fullName. */
export function joinFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}
