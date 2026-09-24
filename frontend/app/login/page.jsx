"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await authApi.login(email, password);
      window.localStorage.setItem("margai_token", token);
      router.push("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.error || "Login failed");
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto" }}>
      <h1>Marg.ai</h1>
      <p style={{ color: "#666" }}>Log in to continue your learning path.</p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit">Log in</button>
      </form>
      <p>
        No account? <a href="/register">Register</a>
      </p>
    </main>
  );
}
