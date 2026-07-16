import { createAuthClient } from "better-auth/react";

// NEXT_PUBLIC_* инлайнятся на этапе next build. В Docker-сборке
// NEXT_PUBLIC_APP_URL не передаётся как build-arg, поэтому если её нет —
// НЕ хардкодим localhost, а даём better-auth использовать текущий origin
// (тот же домен, откуда открыта страница). Иначе браузер шлёт запросы на
// http://localhost:3000 и регистрация падает с "Something went wrong".
export const authClient = createAuthClient({
  ...(process.env.NEXT_PUBLIC_APP_URL
    ? { baseURL: process.env.NEXT_PUBLIC_APP_URL }
    : {}),
});

export const { useSession, signIn, signOut, signUp } = authClient;
