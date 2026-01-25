import React from "react";

type ProblemBannerProps = {
  message: string;
};

export function ProblemBanner({ message }: ProblemBannerProps) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      {message}
    </div>
  );
}
