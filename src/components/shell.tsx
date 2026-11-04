"use client";
import {
  BookOpen,
  LayoutDashboard,
  Layers,
  Palette,
  GraduationCap,
  ArrowUpRight,
  Menu,
  LogOut,
  ChevronRight,
  CircleHelp,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Breadcrumbs, Drawer, IconButton } from "./ui";
export function Sidebar({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (v: string) => void;
}) {
  return (
    <>
      <Link className="brand" href="/" aria-label="Coursecraft home">
        <span className="brand-icon">
          <Layers />
        </span>
        <span>
          coursecraft<small>LEARNING STUDIO</small>
        </span>
      </Link>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav">
        <button
          className={active === "courses" ? "active" : ""}
          onClick={() => onNavigate("courses")}
        >
          <LayoutDashboard />
          Course dashboard
        </button>
        <button
          className={active === "themes" ? "active" : ""}
          onClick={() => onNavigate("themes")}
        >
          <Palette />
          Theme library<span className="tiny">2</span>
        </button>
        <button
          className={active === "guide" ? "active" : ""}
          onClick={() => onNavigate("guide")}
        >
          <BookOpen />
          Getting started
          <ArrowUpRight className="nav-end" />
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="tip">
          <span className="tip-icon">
            <GraduationCap />
          </span>
          <strong>Big ideas. Better learning.</strong>
          <p>Turn your expertise into experiences that make a difference.</p>
          <button onClick={() => onNavigate("guide")}>
            Explore the guide <ChevronRight />
          </button>
        </div>
        <div className="workspace-foot">
          <span className="avatar">OC</span>
          <div>
            OCiEx workspace<small>Administrator workspace</small>
          </div>
          <span className="online" />
        </div>
      </div>
    </>
  );
}
export function Topbar({
  email,
  onMenu,
  onLogout,
}: {
  email: string;
  onMenu: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="topbar">
      <div>
        <IconButton
          label="Open navigation"
          className="mobile-menu"
          onClick={onMenu}
        >
          <Menu />
        </IconButton>
        <span className="workspace-dot" />
        Your learning workspace
      </div>
      <div>
        <span className="top-tag">PHASE 1 · STUDIO</span>
        <span className="top-separator" />
        <span className="user-email">{email}</span>
        <IconButton label="Sign out" onClick={onLogout}>
          <LogOut />
        </IconButton>
      </div>
    </header>
  );
}
export function AppShell({
  children,
  email,
  active,
  onNavigate,
  onLogout,
  crumb,
}: {
  children: ReactNode;
  email: string;
  active: string;
  onNavigate: (v: string) => void;
  onLogout: () => void;
  crumb?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Sidebar active={active} onNavigate={onNavigate} />
      </aside>
      <Drawer open={open} onOpenChange={setOpen}>
        <Sidebar
          active={active}
          onNavigate={(v) => {
            onNavigate(v);
            setOpen(false);
          }}
        />
      </Drawer>
      <div className="workspace">
        <Topbar
          email={email}
          onMenu={() => setOpen(true)}
          onLogout={onLogout}
        />
        <main>
          <Breadcrumbs>
            <span>Workspace</span>
            <ChevronRight />
            <button onClick={() => onNavigate("courses")}>Courses</button>
            {crumb && (
              <>
                <ChevronRight />
                <span>{crumb}</span>
              </>
            )}
          </Breadcrumbs>
          {children}
        </main>
        <footer>
          <span>
            Coursecraft Studio <span className="footer-dot">·</span> Create with
            purpose.
          </span>
          <span>
            <CircleHelp /> Phase 1 MVP
          </span>
        </footer>
      </div>
    </div>
  );
}
