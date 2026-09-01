import { describe, it, expect } from "vitest";
import { legalDocuments, privacyDocument, termsDocument, dataRetentionDocument } from "@/lib/legal-content";

describe("legal content", () => {
  it("exports three public documents", () => {
    expect(Object.keys(legalDocuments).sort()).toEqual(["data-retention", "privacy", "terms"]);
  });

  it("each document has sections with Persian titles", () => {
    for (const doc of [privacyDocument, termsDocument, dataRetentionDocument]) {
      expect(doc.title.length).toBeGreaterThan(2);
      expect(doc.sections.length).toBeGreaterThan(2);
      expect(doc.sections.every((s) => s.title.length > 0)).toBe(true);
    }
  });

  it("privacy covers audit and SMS", () => {
    const text = privacyDocument.sections.flatMap((s) => [...s.paragraphs, ...(s.bullets ?? [])]).join(" ");
    expect(text).toMatch(/ممیزی|Audit/);
    expect(text).toMatch(/پیامک|SMS/);
  });
});
