import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Stethoscope, Users, CalendarDays, ClipboardList, Settings, LogOut, BarChart3, UserPlus
} from "lucide-react";

const receptionistLinks = [
  { to: "/dashboard", icon: CalendarDays, label: "Today's Queue" },
  { to: "/dashboard/patients", icon: UserPlus, label: "Patient Registration" },
  { to: "/dashboard/documents", icon: ClipboardList, label: "Documents" },
];

const doctorLinks = [
  { to: "/dashboard", icon: CalendarDays, label: "Queue & Consult" },
  { to: "/dashboard/patients", icon: Users, label: "Patients" },
];

const adminLinks = [
  { to: "/dashboard", icon: CalendarDays, label: "Queue" },
  { to: "/dashboard/patients", icon: Users, label: "Patients" },
  { to: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const role = profile?.role ?? "admin";

  const links = role === "receptionist" ? receptionistLinks :
                role === "doctor" ? doctorLinks : adminLinks;

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col gradient-sidebar md:flex">
        <div className="flex h-16 items-center gap-3 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary/20">
            <Stethoscope className="h-5 w-5 text-sidebar-primary" />
          </div>
          <span className="font-display text-lg font-bold text-sidebar-foreground">MediScribe</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/dashboard"}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-foreground">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{profile?.full_name}</p>
              <p className="truncate text-xs text-sidebar-foreground/50 capitalize">{role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
