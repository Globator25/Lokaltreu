"use client";

type SwUpdateBannerProps = {
  visible: boolean;
  onUpdate: () => void;
};

export function SwUpdateBanner({ visible, onUpdate }: SwUpdateBannerProps) {
  if (!visible) return null;

  return (
    <div className="w-full border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4">
        <span>Neue Version verfuegbar.</span>
        <button
          type="button"
          onClick={onUpdate}
          className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Aktualisieren
        </button>
      </div>
    </div>
  );
}
