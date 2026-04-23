export type AdminAuditAction =
  | "view_user_detail"
  | "view_order_detail"
  | "view_order_costs"
  | "view_audit_log"
  | "export_orders_csv"
  | "export_users_csv"
  | "acknowledge_alert";

export class AdminError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code);
    this.name = "AdminError";
  }
}
