import { createHash } from "crypto";

/**
 * Deterministic A/B variant assignment.
 * Hash-based so the same user always gets the same variant for a given experiment.
 * No experiments are active in MVP — infrastructure only.
 */
export function getExperimentVariant(
  userId: string,
  experiment: string
): "A" | "B" {
  const hash = createHash("sha256")
    .update(`${userId}:${experiment}`)
    .digest();

  return hash[0] % 2 === 0 ? "A" : "B";
}
