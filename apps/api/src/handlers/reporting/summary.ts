import type { ServerResponse } from "node:http";
import type { AdminAuthRequest } from "../../mw/admin-auth.js";
import { problem, problemFromError, sendJson, sendProblem } from "../http-utils.js";
import type { createReportingService } from "../../modules/reporting/reporting.service.js";

type ReportingService = ReturnType<typeof createReportingService>;

export async function handleReportingSummary(
  req: AdminAuthRequest,
  res: ServerResponse,
  deps: { service: ReportingService },
) {
  const adminContext = req.context?.admin;
  if (!adminContext) {
    return sendProblem(
      res,
      problem(403, "Forbidden", "Missing admin context", req.url ?? "/admins/reporting/summary"),
    );
  }

  try {
    const payload = await deps.service.getSummary({ tenantId: adminContext.tenantId });
    return sendJson(res, 200, payload);
  } catch (error) {
    const payload = problemFromError({
      error,
      instance: req.url ?? "/admins/reporting/summary",
    });
    return sendProblem(res, payload);
  }
}
