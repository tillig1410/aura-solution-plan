"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Users,
  MessageSquare,
  Scissors,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
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
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside
      className="flex h-full w-60 flex-col"
      style={{ background: "var(--agenda-surface)", borderRight: "1px solid var(--agenda-border)" }}
    >
      {/* Brand — proto Claude Design */}
      <Link
        href="/agenda"
        className="flex items-center gap-2.5 px-4 py-4"
        style={{ borderBottom: "1px solid var(--agenda-border)" }}
      >
        <div
          className="flex items-center justify-center overflow-hidden shrink-0"
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: "radial-gradient(circle at 35% 30%, oklch(0.97 0.02 80), oklch(0.92 0.04 75))",
            border: "1px solid oklch(0.85 0.05 75)",
          }}
        >
          <img
            src="/logo-aura.png"
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: "30% 65%", transform: "scale(1.6)", filter: "saturate(1.15) contrast(1.05)" }}
          />
        </div>
        <div className="flex flex-col">
          <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.1, letterSpacing: "0.04em", color: "var(--agenda-fg)" }}>
            Resa app
          </span>
          <span style={{ fontSize: 10.5, color: "var(--agenda-fg-subtle)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            par AURA Solutions
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col min-h-0">
        <nav className="space-y-1 px-2 py-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
                  isActive ? "font-semibold" : "font-normal",
                )}
                style={{
                  background: isActive ? "var(--agenda-surface-3)" : "transparent",
                  color: "var(--agenda-fg)",
                }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <SidebarMiniCalendar />

        <SidebarNotifications />

        {/* Bouton Déconnexion — bas de sidebar (proto place actions secondaires en bas) */}
        <div className="mt-auto p-3" style={{ borderTop: "1px solid var(--agenda-border)" }}>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors"
            style={{ color: "var(--agenda-fg-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--agenda-surface-3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
