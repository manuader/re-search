import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { executeResearch } from "@/lib/inngest/functions/execute-research";
import { processBatch } from "@/lib/inngest/functions/process-batch";
import { healthCheck } from "@/lib/inngest/functions/health-check";
import { generateReport } from "@/lib/inngest/functions/generate-report";
import { refundOrder } from "@/lib/inngest/functions/refund-order";
import { expireOrders } from "@/lib/inngest/functions/expire-orders";
import { refreshAdminViews } from "@/lib/inngest/functions/refresh-admin-views";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    executeResearch,
    processBatch,
    healthCheck,
    generateReport,
    refundOrder,
    expireOrders,
    refreshAdminViews,
  ],
});
