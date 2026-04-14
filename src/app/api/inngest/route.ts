import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { executeResearch } from "@/lib/inngest/functions/execute-research";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [executeResearch],
});
