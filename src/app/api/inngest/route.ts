import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";

// Functions will be added in Phase 3
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
});
