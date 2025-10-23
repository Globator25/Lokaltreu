import type { Request, Response } from "express";

export function registerHealthRoute(app: import("express").Express) {
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });
}
