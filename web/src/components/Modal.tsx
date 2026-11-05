"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:pt-[8vh]" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        className={`enter relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[16px] border border-[var(--line)] bg-card pb-[env(safe-area-inset-bottom)] sm:rounded-[16px] ${wide ? "sm:max-w-[600px]" : "sm:max-w-[440px]"}`}
      >
        <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-[var(--line)] bg-card/95 px-4 backdrop-blur">
          <button className="btn btn-quiet btn-sm w-8 px-0" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={1.5} />
          </button>
          <h2 className="text-[17px] font-medium">{title}</h2>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
