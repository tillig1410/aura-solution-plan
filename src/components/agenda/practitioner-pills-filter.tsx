"use client";

import type { Practitioner } from "@/types/supabase";

interface Props {
  practitioners: Practitioner[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Label affiché à gauche du bandeau (ex: "VUE SEMAINE DE", "VUE 3 JOURS DE") */
  label: string;
}

const getInitials = (name: string): string =>
  name.split(/\s+/).map((w) => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();

const PractitionerPillsFilter = ({ practitioners, selected, onChange, label }: Props) => {
  const active = practitioners.filter((p) => p.is_active);
  if (active.length === 0) return null;

  const allActive = selected.length === 0;
  const isSelected = (id: string) => allActive || selected.includes(id);

  const handleToggle = (id: string) => {
    if (allActive) {
      // Click depuis "tous actifs" → exclusif sur ce praticien
      onChange([id]);
      return;
    }
    if (selected.includes(id)) {
      // Click sur un praticien déjà sélectionné
      if (selected.length === 1) {
        // C'est le seul → retour à "tous"
        onChange([]);
      } else {
        onChange(selected.filter((x) => x !== id));
      }
    } else {
      // Ajoute à la sélection
      const next = [...selected, id];
      // Si on couvre tous les praticiens → normaliser à []
      onChange(next.length === active.length ? [] : next);
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-[22px] py-2 flex-wrap"
      style={{
        background: "var(--agenda-surface)",
        borderBottom: "1px solid var(--agenda-border)",
      }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.08em] mr-1"
        style={{ color: "var(--agenda-fg-subtle)" }}
      >
        {label}
      </span>
      {active.map((p) => {
        const on = isSelected(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => handleToggle(p.id)}
            className="inline-flex items-center gap-1.5 h-8 pl-1 pr-3 rounded-full transition-all"
            style={{
              background: on ? `color-mix(in oklch, ${p.color} 14%, white)` : "var(--agenda-surface)",
              border: `1px solid ${on ? p.color : "var(--agenda-border)"}`,
              color: on ? "var(--agenda-fg)" : "var(--agenda-fg-subtle)",
              opacity: on ? 1 : 0.6,
            }}
          >
            <span
              className="rounded-full flex items-center justify-center text-white text-[10px] font-bold"
              style={{
                background: p.color,
                width: 22,
                height: 22,
                opacity: on ? 1 : 0.6,
              }}
            >
              {getInitials(p.name)}
            </span>
            <span className="text-[12px] font-medium">{p.name}</span>
          </button>
        );
      })}
    </div>
  );
};

export default PractitionerPillsFilter;
