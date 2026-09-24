"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    window.localStorage.removeItem("margai_token");
    router.push("/login");
  }

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

        <div className="marg-nav-actions">
          <Link
            href="/learn/mode"
            className="marg-btn marg-btn-primary marg-nav-start"
          >
            Start learning
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="marg-btn marg-btn-outline marg-logout"
          >
            Logout
          </button>
        </div>
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