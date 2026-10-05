import { NavLink, Outlet } from "react-router-dom";
import {
  FileSpreadsheet,
  FileCheck2,
  Settings2,
  ChevronRight,
  FileText,       // <-- nouveau
  Cog,            // <-- nouveau (ou Sliders pour la config)
} from "lucide-react";

import logomL from "../assets/logomL.png";
import videopin from "../assets/From KlickPin.mp4";

function SidebarItem({ to, icon: Icon, children, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `
        group flex items-center gap-3 rounded-xl px-3 py-2.5
        text-sm font-medium transition-all
        ${isActive
          ? "bg-[#7B0503] text-white shadow-sm"
          : "text-[#646a6b] hover:bg-[#f0f1f0] hover:text-[#252728]"
        }
        `
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            strokeWidth={isActive ? 2.2 : 1.8}
            className="shrink-0"
          />

          <span className="flex-1">{children}</span>

          {isActive && <ChevronRight size={15} className="opacity-70" />}
        </>
      )}
    </NavLink>
  );
}

function MainLayout() {
  return (
    <div className="app-shell">
      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className="
          fixed inset-y-0 left-0 z-40
          hidden w-[250px]
          flex-col
          border-r border-[#e3e5e4]
          bg-white
          lg:flex
        "
      >
        {/* Logo */}

        <div className="flex h-[88px] items-center px-7">
          <img
            src={logomL}
            alt="M Logo"
            className="h-auto w-[145px] object-contain"
          />
        </div>

        {/* Application name */}

        <div className="px-5 pb-5">
          <div
            className="
              rounded-xl
              border border-[#eceeed]
              bg-[#f7f7f6]
              px-4 py-3
            "
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8f90]">
              Application
            </p>

            <p className="mt-1 text-sm font-semibold text-[#252728]">
              Génération des attestations
            </p>
          </div>
        </div>

        {/* Navigation */}

        <nav className="flex-1 px-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9e9f]">
            Workflow Excel
          </p>

          <div className="space-y-1">
            <SidebarItem to="/" end icon={FileSpreadsheet}>
              Import Excel
            </SidebarItem>

            <SidebarItem to="/selection" icon={FileCheck2}>
              Entreprises sélectionnées
            </SidebarItem>
          </div>

          <div className="my-6 border-t border-[#eceeed]" />

          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9e9f]">
            Workflow Déclaration
          </p>

          <div className="space-y-1">
            <SidebarItem to="/declaration" icon={FileText}>
              Import Déclaration
            </SidebarItem>
          </div>

          <div className="my-6 border-t border-[#eceeed]" />

          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9e9f]">
            Configuration
          </p>

          <div className="space-y-1">
            <SidebarItem to="/configuration" icon={Cog}>
              Cabinet mLExperts
            </SidebarItem>

            <SidebarItem to="/word" icon={Settings2}>
              Modèles Word
            </SidebarItem>
          </div>
        </nav>

        {/* Bottom */}

        <div className="border-t border-[#eceeed] p-4">
          <div className="rounded-xl bg-[#f7f7f6] px-4 py-3">
            <p className="text-xs font-medium text-[#6f7476]">
              Attestation Generator
            </p>

            <p className="mt-1 text-[11px] text-[#9a9e9f]">Version 2.0</p>
          </div>
        </div>
      </aside>

      {/* =================================================
          MAIN
      ================================================= */}

      <div className="app-main lg:ml-[250px]">
        {/* TOP BAR */}

        <header
          className="
            sticky top-0 z-30
            flex h-[72px]
            items-center justify-between
            border-b border-[#e3e5e4]
            bg-white/95
            px-6
            backdrop-blur
            lg:px-8
          "
        >
          <div>
            <p className="text-xs font-medium text-[#929697]">
              Plateforme interne
            </p>

            <p className="mt-0.5 text-sm font-semibold text-[#252728]">
              Génération des attestations
            </p>
          </div>

          <div className="w-20 overflow-hidden rounded-full">
            <video
              src={videopin}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full scale-170 object-cover"
            />
          </div>
        </header>

        {/* CONTENT */}

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
