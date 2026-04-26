"use client";

import type { ColorBy } from "@/lib/agenda/colors";

interface Props {
  colorBy: ColorBy;
}

interface LegendItem {
  color: string;
  label: string;
  variant?: "solid" | "dashed" | "strike" | "hatch";
}

const SERVICE_ITEMS: LegendItem[] = [
  { color: "#8b5cf6", label: "Coupe & brushing" },
  { color: "#c084fc", label: "Couleur" },
  { color: "#f59e0b", label: "Mèches" },
  { color: "#fb923c", label: "Barbe" },
  { color: "#10b981", label: "Soin" },
  { color: "#64748b", label: "Autre" },
];

const STATE_ITEMS: LegendItem[] = [
  { color: "#10b981", label: "Confirmé" },
  { color: "#f59e0b", label: "En attente", variant: "dashed" },
  { color: "#3b82f6", label: "En cours" },
  { color: "#475569", label: "Terminé" },
  { color: "#94a3b8", label: "Annulé", variant: "strike" },
  { color: "#ef4444", label: "Absent" },
];

const ColorLegend = ({ colorBy }: Props) => {
  if (colorBy === "practitioner") return null;

  const items = colorBy === "service" ? SERVICE_ITEMS : STATE_ITEMS;

  return (
    <div
      className="flex items-center gap-3.5 flex-wrap px-[22px] py-2"
      style={{
        background: "var(--agenda-surface)",
        borderBottom: "1px solid var(--agenda-border)",
        minHeight: 36,
        fontSize: "11.5px",
      }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.06em]"
        style={{ color: "var(--agenda-fg-subtle)" }}
      >
        Légende
      </span>
      <div className="w-px h-3.5" style={{ background: "var(--agenda-border)" }} />
      {items.map((item) => {
        const lightBg = `color-mix(in oklch, ${item.color} 14%, white)`;
        return (
          <span
            key={item.label}
            className="inline-flex items-center gap-1.5"
            style={{ color: "var(--agenda-fg-muted)" }}
          >
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: 22,
                height: 14,
                borderRadius: 4,
                background: item.variant === "hatch" ? "var(--agenda-surface-3)" : lightBg,
                borderLeft: `${item.variant === "dashed" ? "3px dashed" : "3px solid"} ${item.color}`,
                borderTop: `1px solid color-mix(in oklch, ${item.color} 25%, white)`,
                borderRight: `1px solid color-mix(in oklch, ${item.color} 18%, white)`,
                borderBottom: `1px solid color-mix(in oklch, ${item.color} 30%, white)`,
                position: "relative",
              }}
            >
              {item.variant === "strike" && (
                <span
                  style={{
                    width: "70%",
                    height: 1.5,
                    background: item.color,
                    transform: "rotate(-8deg)",
                  }}
                />
              )}
            </span>
            <span style={{ fontWeight: 500, color: "var(--agenda-fg)" }}>{item.label}</span>
          </span>
        );
      })}
    </div>
  );
};

export default ColorLegend;
