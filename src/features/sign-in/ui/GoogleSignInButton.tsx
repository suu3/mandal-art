import { useState } from "react";
import { authClient } from "../../../entities/session";
export function GoogleSignInButton() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        className="button google-sign-in"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { error } = await authClient.signIn.social({
              provider: "google",
              callbackURL: location.origin + "/boards",
            });
            if (error) throw error;
          } catch {
            setError("Google 로그인을 시작하지 못했습니다.");
            setBusy(false);
          }
        }}
      >
        <span className="google-letter" aria-hidden="true">
          G
        </span>
        {busy ? "연결 중…" : "Google로 계속하기"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
