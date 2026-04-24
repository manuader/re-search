import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getToolSchema } from "@/lib/apify/schemas";
import { getMapper, defaultMapper } from "@/lib/apify/mappers";
import { findToolById, estimateCost } from "@/lib/apify/catalog";
import { validateConfig } from "@/lib/apify/tool-schema";

/**
 * PATCH /api/projects/[id]/config
 *
 * Validates a tool config against its schema, runs it through the mapper,
 * and returns the effective result count + cost estimate. Does NOT persist
 * the config — persistence happens in executeResearch at checkout time.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from("research_projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { toolId, config } = body as {
    toolId: string;
    config: Record<string, unknown>;
  };

  if (!toolId || !config) {
    return NextResponse.json(
      { error: "toolId and config are required" },
      { status: 400 }
    );
  }

  const catalogEntry = findToolById(toolId);
  if (!catalogEntry) {
    return NextResponse.json(
      { error: `Tool "${toolId}" not found` },
      { status: 400 }
    );
  }

  // Validate against schema
  const schema = getToolSchema(toolId);
  if (schema) {
    const errors = validateConfig(schema, config);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }
  }

  // Run through mapper
  const mapper = getMapper(toolId) ?? defaultMapper;
  const result = mapper({
    locale: "en",
    userConfig: config,
    catalogDefaults: catalogEntry.inputSchema.defaults,
  });

  const estimate = estimateCost(toolId, result.effectiveResultCount);

  return NextResponse.json({
    toolId,
    effectiveResultCount: result.effectiveResultCount,
    estimate: estimate ?? { min: 0, max: 0, expected: 0, breakdown: "" },
    warnings: result.warnings,
  });
}
