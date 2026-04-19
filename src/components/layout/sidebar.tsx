"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Users,
  MessageSquare,
  Scissors,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SidebarNotifications from "@/components/layout/sidebar-notifications";
import SidebarMiniCalendar from "@/components/layout/sidebar-mini-calendar";

const navItems = [
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/services", label: "Services", icon: Scissors },
  { href: "/stats", label: "Statistiques", icon: BarChart3 },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col bg-white">
      <div className="flex h-12 items-center px-4 gap-3 border-b">
        <Link href="/agenda" className="flex items-center gap-2.5">
          <img src="/logo-aura.png" alt="Logo" className="h-7 w-7 rounded-full object-cover" />
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-tight">Resa app</span>
            <span className="text-[8px] text-gray-400 leading-none">par AURA Solutions</span>
          </div>
        </Link>
      </div>

      <div className="flex flex-1 flex-col border-r min-h-0">
        <nav className="space-y-1 px-3 py-3">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <SidebarMiniCalendar />

        <SidebarNotifications />
      </div>
    </aside>
  );
};

export default Sidebar;
