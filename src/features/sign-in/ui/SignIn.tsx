import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Github } from "lucide-react";
import { request } from "../../../shared/api/client";
import { authClient } from "../../../entities/session";
import { GoogleSignInButton } from "./GoogleSignInButton";
export function SignIn() {
  const { data } = useQuery({
    queryKey: ["login-providers"],
    queryFn: () =>
      request(
        "/api/config",
        z.object({ googleLogin: z.boolean(), githubLogin: z.boolean() }),
      ),
    staleTime: 60000,
  });
  return (
    <div className="sign-in-options">
      {data?.googleLogin && <GoogleSignInButton />}
      {data?.githubLogin && (
        <button
          className="button github-sign-in"
          onClick={() => {
            void authClient.signIn.social({
              provider: "github",
              callbackURL: location.origin + "/boards",
            });
          }}
        >
          <Github size={16} />
          GitHub로 계속하기
        </button>
      )}
      {data && !data.googleLogin && (
        <small className="muted">Google 로그인은 연결 준비 중입니다.</small>
      )}
    </div>
  );
}
