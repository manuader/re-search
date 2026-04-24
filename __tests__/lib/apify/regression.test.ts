import { describe, it, expect } from "vitest";
import { toolCatalog } from "@/lib/apify/catalog";
import { getToolSchema } from "@/lib/apify/schemas";
import { getMapper } from "@/lib/apify/mappers";
import { getAllParams } from "@/lib/apify/tool-schema";

/**
 * Regression guard: ensures every tool in the catalog has a matching schema,
 * mapper, and i18n coverage. If a new tool is added to the catalog without
 * its schema/mapper, this test fails — preventing incomplete deployments.
 */

const REQUIRED_LOCALES = ["en", "es"];

describe("regression guard — all tools covered", () => {
  for (const tool of toolCatalog) {
    describe(`${tool.id}`, () => {
      it("has a registered schema", () => {
        const schema = getToolSchema(tool.id);
        expect(schema).toBeDefined();
        expect(schema!.toolId).toBe(tool.id);
      });

      it("has a registered mapper", () => {
        const mapper = getMapper(tool.id);
        expect(mapper).toBeDefined();
      });

      it("has a schemaId in the catalog entry", () => {
        expect(tool.schemaId).toBeDefined();
        expect(typeof tool.schemaId).toBe("string");
      });

      it("schema has at least one param group", () => {
        const schema = getToolSchema(tool.id)!;
        expect(schema.paramGroups.length).toBeGreaterThanOrEqual(1);
      });

      it("every param has required locale labels", () => {
        const schema = getToolSchema(tool.id)!;
        for (const param of getAllParams(schema)) {
          for (const loc of REQUIRED_LOCALES) {
            expect(
              param.label[loc],
              `${tool.id}.${param.id} missing label for locale "${loc}"`
            ).toBeTruthy();
            expect(
              param.description[loc],
              `${tool.id}.${param.id} missing description for locale "${loc}"`
            ).toBeTruthy();
          }
        }
      });

      it("every param group has required locale labels", () => {
        const schema = getToolSchema(tool.id)!;
        for (const group of schema.paramGroups) {
          for (const loc of REQUIRED_LOCALES) {
            expect(
              group.label[loc],
              `${tool.id} group "${group.id}" missing label for locale "${loc}"`
            ).toBeTruthy();
          }
        }
      });

      it("every enum option has required locale labels", () => {
        const schema = getToolSchema(tool.id)!;
        for (const param of getAllParams(schema)) {
          if (param.options) {
            for (const opt of param.options) {
              for (const loc of REQUIRED_LOCALES) {
                expect(
                  opt.label[loc],
                  `${tool.id}.${param.id} option "${opt.value}" missing label for locale "${loc}"`
                ).toBeTruthy();
              }
            }
          }
        }
      });

      it("clarifying question paramIds reference existing params", () => {
        const schema = getToolSchema(tool.id)!;
        const paramIds = new Set(getAllParams(schema).map((p) => p.id));
        for (const q of schema.clarifyingQuestions) {
          for (const pid of q.paramIds) {
            expect(
              paramIds.has(pid),
              `${tool.id} question "${q.id}" references unknown param "${pid}"`
            ).toBe(true);
          }
        }
      });

      it("mapper produces valid output with schema defaults", () => {
        const schema = getToolSchema(tool.id)!;
        const mapper = getMapper(tool.id)!;
        const defaults: Record<string, unknown> = {};
        for (const param of getAllParams(schema)) {
          if (param.defaultValue !== undefined) {
            defaults[param.id] = param.defaultValue;
          }
        }
        const catalogEntry = toolCatalog.find((t) => t.id === tool.id)!;
        const result = mapper({
          locale: "en",
          userConfig: defaults,
          catalogDefaults: catalogEntry.inputSchema.defaults,
        });
        expect(result.actorInput).toBeDefined();
        expect(typeof result.effectiveResultCount).toBe("number");
        expect(result.effectiveResultCount).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(result.warnings)).toBe(true);
      });
    });
  }
});
