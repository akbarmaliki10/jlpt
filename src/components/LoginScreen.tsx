import { useState } from "react";
import { login } from "../api/storage";

interface LoginScreenProps {
  onSuccess: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await login(password);
      if (ok) {
        onSuccess();
      } else {
        setError("Wrong password. Try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell" style={{ justifyContent: "center" }}>
      <div className="panel" style={{ maxWidth: 420, width: "100%", margin: "0 auto", padding: 28 }}>
        <div className="brand" style={{ marginBottom: 8 }}>
          <span className="brand-badge">N4</span>
          <span>JLPT N4 Daily SRS</span>
        </div>
        <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>
          Enter your password to unlock your study deck.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className={`answer-box ${error ? "wrong" : ""}`}>
            <input
              type="password"
              className="answer-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Password..."
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="pill pill-red" style={{ alignSelf: "flex-start" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!password || submitting}
          >
            {submitting ? "Checking..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
