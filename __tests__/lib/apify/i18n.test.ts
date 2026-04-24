import { describe, it, expect } from "vitest";
import { toolCatalog } from "@/lib/apify/catalog";
import { getToolSchema } from "@/lib/apify/schemas";
import { getAllParams } from "@/lib/apify/tool-schema";

/**
 * i18n completeness test: ensures every schema param label, description,
 * enum option label, group label, and clarifying question has translations
 * for all required locales. Fails CI if a new param is added without
 * complete translations.
 */

const REQUIRED_LOCALES = ["en", "es", "pt", "fr", "de"];

describe("i18n completeness — all locales present", () => {
  for (const tool of toolCatalog) {
    const schema = getToolSchema(tool.id);
    if (!schema) continue;

    describe(`${tool.id}`, () => {
      it("every param label has all 5 locales", () => {
        for (const param of getAllParams(schema)) {
          for (const loc of REQUIRED_LOCALES) {
            expect(
              param.label[loc],
              `${tool.id}.${param.id}.label missing locale "${loc}"`
            ).toBeTruthy();
          }
        }
      });

      it("every param description has all 5 locales", () => {
        for (const param of getAllParams(schema)) {
          for (const loc of REQUIRED_LOCALES) {
            expect(
              param.description[loc],
              `${tool.id}.${param.id}.description missing locale "${loc}"`
            ).toBeTruthy();
          }
        }
      });

      it("every param group label has all 5 locales", () => {
        for (const group of schema.paramGroups) {
          for (const loc of REQUIRED_LOCALES) {
            expect(
              group.label[loc],
              `${tool.id} group "${group.id}" label missing locale "${loc}"`
            ).toBeTruthy();
          }
        }
      });

      it("every enum option label has all 5 locales", () => {
        for (const param of getAllParams(schema)) {
          if (!param.options) continue;
          for (const opt of param.options) {
            for (const loc of REQUIRED_LOCALES) {
              expect(
                opt.label[loc],
                `${tool.id}.${param.id} option "${opt.value}" label missing locale "${loc}"`
              ).toBeTruthy();
            }
          }
        }
      });

      it("every clarifying question has all 5 locales", () => {
        for (const q of schema.clarifyingQuestions) {
          for (const loc of REQUIRED_LOCALES) {
            expect(
              q.question[loc],
              `${tool.id} question "${q.id}" missing locale "${loc}"`
            ).toBeTruthy();
          }
        }
      });
    });
  }
});
