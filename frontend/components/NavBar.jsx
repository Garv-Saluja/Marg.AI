"use client";
import Link from "next/link";

export default function NavBar() {
  return (
    <nav style={{ display: "flex", gap: 16, padding: "16px 24px", background: "#fff", borderBottom: "1px solid #eee" }}>
      <Link href="/dashboard"><strong>Marg.ai</strong></Link>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/learn/mode">Learn</Link>
      <Link href="/progress">Progress</Link>
    </nav>
  );
}
