"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fr } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";

const SidebarMiniCalendar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelected(date);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    sessionStorage.setItem("agenda_goto_date", dateStr);
    if (pathname === "/agenda") {
      window.dispatchEvent(new Event("agenda-goto-date"));
    } else {
      router.push("/agenda");
    }
  };

  return (
    <div className="border-t px-2 py-2">
      <div className="flex items-center gap-1.5 px-2 mb-1">
        <CalendarDays className="h-3.5 w-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Aller à
        </span>
      </div>
      <Calendar
        mode="single"
        selected={selected}
        onSelect={handleSelect}
        locale={fr}
        className="!p-1 [--cell-size:1.6rem] text-xs"
        weekStartsOn={1}
      />
    </div>
  );
};

export default SidebarMiniCalendar;
