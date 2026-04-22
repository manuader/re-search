import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { executeResearch } from "@/lib/inngest/functions/execute-research";
import { processBatch } from "@/lib/inngest/functions/process-batch";
import { healthCheck } from "@/lib/inngest/functions/health-check";
import { generateReport } from "@/lib/inngest/functions/generate-report";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [executeResearch, processBatch, healthCheck, generateReport],
});
