export default function HomePage() {
  return (
    <main style={{ maxWidth: 480, margin: "120px auto", textAlign: "center" }}>
      <h1>Marg.ai</h1>
      <p style={{ color: "#666" }}>Find your path.</p>
      <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
        <a href="/login">Log in</a>
        <a href="/register">Register</a>
      </div>
    </main>
  );
}
