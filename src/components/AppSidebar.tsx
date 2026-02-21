import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Shield, LayoutDashboard, Users, Upload, FileText, CreditCard, Megaphone, MessageSquare, Search as SearchIcon, LogOut, Vote, Building, AlertTriangle, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/", roles: ["admin", "operator"] },
  { title: "Search", icon: SearchIcon, path: "/search", roles: ["admin", "operator"] },
  { title: "Agent Directory", icon: Users, path: "/agents", roles: ["admin", "operator"] },
  { title: "Import Agents", icon: Upload, path: "/import", roles: ["admin"] },
  { title: "Reports", icon: FileText, path: "/reports", roles: ["admin", "operator"] },
  { title: "Payments", icon: CreditCard, path: "/payments", roles: ["admin"] },
  { title: "Broadcasts", icon: Megaphone, path: "/broadcasts", roles: ["admin"] },
  { title: "WhatsApp", icon: MessageSquare, path: "/whatsapp", roles: ["admin"] },
  { title: "Election Results", icon: Vote, path: "/election-results", roles: ["admin", "operator"] },
  { title: "Ward Portal", icon: Building, path: "/ward-portal", roles: ["admin", "operator"] },
  { title: "Situation Intake", icon: AlertTriangle, path: "/situation-intake", roles: ["admin", "operator"] },
  { title: "Emergency Result Entry", icon: AlertTriangle, path: "/emergency-result", roles: ["admin", "operator"] },
  { title: "Admin - Login as Agent", icon: UserCog, path: "/admin/impersonate-agent", roles: ["admin"] },
  { title: "Agent Portal", icon: Users, path: "/agent/login", roles: ["admin", "operator"] },
];

export function AppSidebar() {
  const { user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const filtered = role
    ? navItems.filter((item) => item.roles.includes(role))
    : navItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Shield className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground">AMAC Situation Room</p>
            <p className="text-xs text-sidebar-foreground/60">Election Day HQ</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filtered.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="mb-2 text-xs text-sidebar-foreground/60">
          <p className="font-medium text-sidebar-foreground">{profile?.full_name || "Public Access"}</p>
          <p className="capitalize">{role || "open mode"}</p>
        </div>
        {user && (
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/60" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
