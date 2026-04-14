import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { executeResearch } from "@/lib/inngest/functions/execute-research";
import { processBatch } from "@/lib/inngest/functions/process-batch";
import { healthCheck } from "@/lib/inngest/functions/health-check";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [executeResearch, processBatch, healthCheck],
});
