import "express";
declare module "express-serve-static-core" {
  interface Response {
    locals: {
      routeId?: string;
      tenantId?: string; // pseudonym
      correlationId?: string; // kommt aus Header oder wird generiert
      correlation_id?: string;
      [key: string]: unknown;
    };
  }
}
