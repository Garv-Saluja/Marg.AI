"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="marg-nav">
      <div className="marg-nav-inner">
        <Link href="/dashboard" className="marg-logo">
          <span className="marg-logo-mark" />
          Marg.ai
        </Link>

        <div className="marg-nav-links">
          <NavLink
            href="/dashboard"
            active={pathname === "/dashboard"}
          >
            Dashboard
          </NavLink>

          <NavLink
            href="/learn/mode"
            active={pathname.startsWith("/learn")}
          >
            Learn
          </NavLink>

          <NavLink
            href="/progress"
            active={pathname.startsWith("/progress")}
          >
            Progress
          </NavLink>
        </div>

        <Link
          href="/learn/mode"
          className="marg-btn marg-btn-primary"
          style={{
            minHeight: 38,
            padding: "0 14px",
          }}
        >
          Start learning
        </Link>
      </div>
    </nav>
  );
}

function NavLink({ href, active, children }) {
  return (
    <Link
      href={href}
      className="marg-nav-link"
      style={{
        color: active
          ? "var(--marg-ink)"
          : "var(--marg-muted)",
        fontWeight: active ? 600 : 500,
        position: "relative",
      }}
    >
      {children}

      {active && (
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -26,
            height: 2,
            background: "var(--marg-orange)",
          }}
        />
      )}
    </Link>
  );
}