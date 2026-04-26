"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Practitioner } from "@/types/supabase";

interface Props {
  practitioners: Practitioner[];
  selected: string[];
  onChange: (next: string[]) => void;
}

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

const PractitionerFilterDropdown = ({ practitioners, selected, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const allSelected = selected.length === 0 || selected.length === practitioners.length;
  const label =
    allSelected
      ? "Tous les praticiens"
      : selected.length === 1
        ? practitioners.find((p) => p.id === selected[0])?.name ?? "1 praticien"
        : `${selected.length} praticiens`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 h-8 px-2.5 rounded-[8px] text-[12.5px] font-medium transition-colors"
        style={{
          background: "var(--agenda-surface)",
          border: "1px solid var(--agenda-border)",
          color: "var(--agenda-fg)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--agenda-surface-2)";
          e.currentTarget.style.borderColor = "var(--agenda-border-strong)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--agenda-surface)";
          e.currentTarget.style.borderColor = "var(--agenda-border)";
        }}
      >
        <div className="flex">
          {practitioners.slice(0, 4).map((p, i) => (
            <div
              key={p.id}
              className="rounded-full flex items-center justify-center text-white text-[9px] font-semibold border-2 border-white"
              style={{
                background: p.color,
                width: 18,
                height: 18,
                marginLeft: i === 0 ? 0 : -6,
              }}
            >
              {getInitials(p.name)}
            </div>
          ))}
        </div>
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 z-50 min-w-[260px] rounded-[10px] p-1"
          style={{
            background: "var(--agenda-surface)",
            border: "1px solid var(--agenda-border)",
            boxShadow:
              "0 4px 12px oklch(0.2 0.02 270 / 0.08), 0 1px 2px oklch(0.2 0.02 270 / 0.06)",
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: "1px solid var(--agenda-border)" }}
          >
            <span className="text-xs font-semibold" style={{ color: "var(--agenda-fg)" }}>
              Praticiens
            </span>
            <button
              type="button"
              onClick={() => onChange(allSelected ? [practitioners[0].id] : [])}
              className="text-xs font-semibold transition-colors"
              style={{ color: "var(--agenda-brand)" }}
            >
              {allSelected ? "Aucun" : "Tous"}
            </button>
          </div>
          <div className="py-1">
            {practitioners.map((p) => {
              const on = selected.length === 0 || selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    // Logique : selected=[] signifie "tous". Premier clic depuis "tous" → ne garder que ce praticien.
                    if (selected.length === 0) {
                      onChange(practitioners.filter((x) => x.id !== p.id).map((x) => x.id));
                    } else if (on) {
                      onChange(selected.filter((id) => id !== p.id));
                    } else {
                      onChange([...selected, p.id]);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors text-left"
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--agenda-surface-3)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div
                    className="flex items-center justify-center rounded-[4px] shrink-0"
                    style={{
                      width: 16,
                      height: 16,
                      background: on ? "var(--agenda-brand)" : "transparent",
                      border: `1.5px solid ${on ? "var(--agenda-brand)" : "var(--agenda-border-strong)"}`,
                    }}
                  >
                    {on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <div
                    className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
                    style={{ background: p.color, width: 22, height: 22, fontSize: 10 }}
                  >
                    {getInitials(p.name)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium truncate" style={{ color: "var(--agenda-fg)" }}>
                      {p.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PractitionerFilterDropdown;
