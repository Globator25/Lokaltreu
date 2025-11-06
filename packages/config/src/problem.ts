export type Problem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  [k: string]: unknown;
};

export function problem(p: Problem): never;
export function problem(status: number, title: string, detail?: string): never;
export function problem(arg1: Problem | number, title?: string, detail?: string): never {
  let base: Problem;

  if (typeof arg1 === "number") {
    base = {
      type: "about:blank",
      title: title ?? "Problem",
      status: arg1,
      ...(detail ? { detail } : {}),
    };
  } else {
    base = { ...arg1 };
  }

  if (typeof base.status !== "number") {
    base.status = typeof arg1 === "number" ? arg1 : 500;
  }
  if (typeof base.title !== "string" || base.title.length === 0) {
    base.title = "Problem";
  }
  if (typeof base.type !== "string" || base.type.length === 0) {
    base.type = "about:blank";
  }

  const err = new Error(base.title || "Problem");
  Object.assign(err, base);
  (err as Error & { cause?: Problem }).cause = base;
  throw err;
}
