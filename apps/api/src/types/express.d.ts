import "express";
declare module "express-serve-static-core" {
  interface Response {
    locals: {
      routeId?: string;
      tenantId?: string;        // pseudonym
      correlationId?: string;   // kommt aus Header oder wird generiert
      [key: string]: unknown;
    };
  }
}
