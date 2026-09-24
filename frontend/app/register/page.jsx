"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "../../lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await authApi.register(email, password, fullName);
      window.localStorage.setItem("margai_token", token);
      router.push("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.error || "Registration failed");
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto" }}>
      <h1>Create your Marg.ai account</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit">Register</button>
      </form>
    </main>
  );
}
