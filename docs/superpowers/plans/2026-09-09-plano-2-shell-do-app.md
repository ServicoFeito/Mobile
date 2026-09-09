# Plano 2 — Shell do app (Expo + auth + navegação) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o app React Native + Expo do Serviço Feito em `apps/mobile/` — cliente Supabase com sessão persistida, `authStore`/`uiModeStore`, telas de autenticação (login, registro, redefinição de senha, completar perfil), grupos de rota protegidos por sessão e um conjunto de tabs que troca conforme o modo "contratar"/"prestar" — com tema NativeWind portado do Compose. Sem features de negócio (Plano 3 em diante).

**Architecture:** Expo (managed) + Expo Router (file-based) + TypeScript strict, no workspace pnpm que já existe. `src/shared/api/supabaseClient.ts` cria o client `supabase-js` com um adapter `expo-secure-store` fatiado como storage de sessão. Estado de sessão e de modo vive em stores Zustand (`authStore` hidrata do secure-store no boot e assina `onAuthStateChange`; `uiModeStore` persiste em AsyncStorage). Rotas em `app/` só importam screens de `src/features/*/screens`; grupos `(auth)` / `(app)` redirecionam por sessão; `(tabs)/_layout.tsx` remonta o tab set conforme `uiModeStore.modo`. Nenhuma chamada de dados de negócio neste plano — o `QueryClientProvider` (TanStack Query) é montado no root layout para o Plano 3 consumir.

**Tech Stack:** Expo SDK 52 (managed), Expo Router 4, React Native 0.76, TypeScript 5 (strict), `@supabase/supabase-js` 2.x, `expo-secure-store`, `@react-native-async-storage/async-storage`, Zustand 5, `@tanstack/react-query` 5, NativeWind 4 + Tailwind 3, Jest (`jest-expo`) + `@testing-library/react-native`. Node 20 LTS (host de dev roda Node 18 — WARN de engine aceito), pnpm 9.

**Spec:** `docs/superpowers/specs/2026-09-08-migracao-react-native-supabase-design.md` (este plano implementa a seção 9, a parte de `apps/mobile/` da seção 4, os stores da seção 8 e a seção 13; a camada de repositories/hooks da seção 8 é o Plano 3).

## Global Constraints

- Node **20 LTS** (`engines` `>=20 <21`); **pnpm 9**. O app é o workspace `apps/mobile` (nome de pacote `@servico-feito/mobile`).
- TypeScript **strict**. `tsc --noEmit` limpo é gate de toda task que toca `.ts`/`.tsx`.
- **Expo Router file-based.** Arquivos em `app/` **só importam e renderizam** uma screen de `src/features/<modulo>/screens` (ou um layout). Nenhuma lógica em `app/`.
- **Screen nunca importa `supabase-js` nem um repository diretamente.** Neste plano as telas de auth chamam hooks (`useSignIn`, `useSignUp`, `useResetPassword`, `useCompletarPerfil`) que encapsulam `supabase.auth.*` / um único `.from('usuarios').update()`. A camada de repositories genérica é o Plano 3.
- **Token/sessão sempre em `expo-secure-store`**, nunca `AsyncStorage` puro. O modo (`uiModeStore`) — que não é sensível — vai em AsyncStorage.
- Segredos por env com prefixo `EXPO_PUBLIC_`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Nunca hardcoded. `.env` do app é git-ignored; `apps/mobile/.env.example` é o template.
- A `anon key` é pública por design; a segurança está na RLS (Plano 1). O app nunca usa `service_role`.
- **Conta unificada (RB01):** não há tela de "escolher papel". `authStore` guarda `session` + `usuarioId`; o modo contratar/prestar é estado de UI em `uiModeStore`, não role, não vai em token.
- Controle de rota por sessão é **proteção de UX**; a autorização real é RLS.
- Deep link scheme: **`servicofeito`** (`app.json`), usado no reset de senha (`servicofeito://auth/redefinir`).
- **Teste obrigatório** (Jest) para: `SecureStoreAdapter`, `authStore`, `uiModeStore`, e todo hook (`useXxx`). Store/hook novo ou alterado sem teste não é considerado pronto. Teste de screen só quando a tela tem lógica condicional própria.
- **Nomenclatura:** pastas de feature minúsculas plural (`auth`); screens sufixo `Screen` (`LoginScreen`); hooks prefixo `use`; store sufixo `Store`; tipos de domínio `*.types.ts`.
- Paleta (tokens NativeWind, portados de `docs/arquitetura-antiga/servico-feito/.../ui/theme/Color.kt`): primária `#4DAF50`, secundária `#70D173`, tint `#CBE8CC`, verde-escuro `#2E7D32` (modo prestador); texto `#333333` / body `#6B6B6B` / secundário `#9E9E9E`; favorito `#E02957`; fundo `#FAFAFA`, superfície `#FFFFFF`, superfície-variante `#F1F8F1`, contorno `#E0E0E0`; status amarelo `#FFA000` / azul `#1976D2` / verde `#388E3C` / vermelho `#D32F2F`.
- **Sem device/emulador nesta sessão.** Verificação de cada task = `tsc --noEmit` + Jest + (onde marcado) `pnpm --filter @servico-feito/mobile exec expo-doctor`. Rodar de verdade no dispositivo é passo do usuário / `/run` depois.
- Commits Conventional Commits. `git config user`: `VitorHugoVH` / `vhfraga007@gmail.com`.

---

## File Structure

Tudo novo sob `apps/mobile/` salvo indicação:

```
apps/mobile/
├── package.json                         # @servico-feito/mobile; scripts start/test/typecheck/lint
├── app.json                             # Expo config: scheme "servicofeito", plugins
├── tsconfig.json                        # extends expo/tsconfig.base, strict, paths @/* → src/*
├── babel.config.js                      # babel-preset-expo + nativewind/babel
├── metro.config.js                      # withNativeWind + workspace watchFolders
├── tailwind.config.js                   # tokens SF (Global Constraints)
├── global.css                           # @tailwind base/components/utilities
├── nativewind-env.d.ts                  # /// <reference types="nativewind/types" />
├── jest.config.js  jest.setup.ts        # jest-expo preset + mocks (secure-store, async-storage)
├── .env.example  .env(gitignored)       # EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY
├── .eslintrc.js
├── expo-env.d.ts
├── app/
│   ├── _layout.tsx                      # RootLayout: hidrata authStore, QueryClientProvider, GestureHandlerRootView, import "../global.css"
│   ├── index.tsx                        # Redirect condicional (rota raiz)
│   ├── (auth)/
│   │   ├── _layout.tsx                  # se session → <Redirect href="/(app)" />
│   │   ├── login.tsx                    # → LoginScreen
│   │   ├── registrar.tsx               # → RegistrarScreen
│   │   └── redefinir-senha.tsx          # → RedefinirSenhaScreen
│   └── (app)/
│       ├── _layout.tsx                  # se !session → <Redirect href="/(auth)/login" />; se usuarios.nome null → força completar-perfil
│       ├── completar-perfil.tsx         # → CompletarPerfilScreen
│       └── (tabs)/
│           ├── _layout.tsx              # <Tabs> com screenOptions; array de tabs por uiModeStore.modo
│           ├── index.tsx                # → InicioScreen
│           ├── buscar.tsx               # → BuscarScreen (modo contratar)
│           ├── vagas.tsx                # → VagasScreen (modo prestar)
│           ├── conversas.tsx            # → ConversasListScreen
│           ├── trabalhos.tsx            # → TrabalhosScreen (modo prestar)
│           └── perfil.tsx               # → PerfilScreen (tem o toggle de modo)
├── src/
│   ├── shared/
│   │   ├── api/
│   │   │   ├── secureStoreAdapter.ts    # SecureStoreAdapter (getItem/setItem/removeItem, fatiado)
│   │   │   ├── secureStoreAdapter.test.ts
│   │   │   ├── supabaseClient.ts        # createClient(...) — exporta `supabase`
│   │   │   └── supabaseClient.test.ts
│   │   ├── store/
│   │   │   ├── authStore.ts   authStore.test.ts
│   │   │   └── uiModeStore.ts uiModeStore.test.ts
│   │   ├── query/
│   │   │   └── queryClient.ts           # QueryClient + QueryCache onError (toast stub)
│   │   ├── theme/
│   │   │   └── tokens.ts                # export const cores = { ... } (espelha tailwind.config)
│   │   └── components/
│   │       ├── atoms/{Botao,CampoTexto,Texto}.tsx
│   │       └── molecules/{CarregandoEstado,ErroEstado,VazioEstado}.tsx
│   └── features/
│       ├── auth/
│       │   ├── screens/{LoginScreen,RegistrarScreen,RedefinirSenhaScreen}.tsx
│       │   ├── hooks/{useSignIn,useSignUp,useResetPassword}.ts  + *.test.ts
│       │   └── types/auth.types.ts
│       ├── perfil/
│       │   ├── screens/{CompletarPerfilScreen,PerfilScreen}.tsx
│       │   ├── hooks/{useCompletarPerfil,usePerfilAtual}.ts + *.test.ts
│       │   └── types/perfil.types.ts
│       └── shell/
│           └── screens/{InicioScreen,BuscarScreen,VagasScreen,ConversasListScreen,TrabalhosScreen}.tsx
├── packages/db-types/                   # (já existe — Plano 1) consumido por supabaseClient/hooks
└── .github/workflows/ci.yml             # (já existe — Plano 1) + job "mobile"
```

Fora de `apps/mobile/` (limpeza, Task 15):
- Consolidar `docs/arquitetura-antiga/servico-feito/` (remover `.git` aninhado, `build/`, `.gradle/`, `.idea/`, `.kotlin/`); remover a pasta `servico-feito/` da raiz e `env/`. `.gitignore` já bloqueia `/servico-feito/`, `/env/`, `/docs/arquitetura-antiga/`.

---

## Task 1: Scaffold do app Expo em `apps/mobile/`

**Files:**
- Create: `apps/mobile/package.json`, `apps/mobile/app.json`, `apps/mobile/tsconfig.json`, `apps/mobile/babel.config.js`, `apps/mobile/metro.config.js`, `apps/mobile/expo-env.d.ts`, `apps/mobile/.gitignore`
- Create: `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`
- Modify: `pnpm-workspace.yaml` (já tem `apps/*` — nada a fazer; confirmar)

**Interfaces:**
- Consumes: workspace pnpm da Fundação (`packages/*`, `apps/*`).
- Produces: app `@servico-feito/mobile` que `pnpm --filter @servico-feito/mobile exec tsc --noEmit` compila; `expo-router` como entry.

- [ ] **Step 1: Criar `apps/mobile/package.json`**

```json
{
  "name": "@servico-feito/mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "lint": "eslint .",
    "doctor": "expo-doctor"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "1.23.1",
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-query": "^5.51.0",
    "expo": "~52.0.0",
    "expo-constants": "~17.0.0",
    "expo-linking": "~7.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-status-bar": "~2.0.0",
    "nativewind": "^4.1.0",
    "react": "18.3.1",
    "react-native": "0.76.3",
    "react-native-gesture-handler": "~2.20.2",
    "react-native-reanimated": "~3.16.1",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.1.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@servico-feito/db-types": "workspace:*",
    "@testing-library/react-native": "^12.7.0",
    "@types/react": "~18.3.12",
    "eslint": "^8.57.0",
    "eslint-config-expo": "~8.0.0",
    "expo-doctor": "^1.12.0",
    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "react-test-renderer": "18.3.1",
    "tailwindcss": "^3.4.0",
    "typescript": "~5.6.0"
  }
}
```

- [ ] **Step 2: Criar `apps/mobile/app.json`**

```json
{
  "expo": {
    "name": "Serviço Feito",
    "slug": "servico-feito",
    "scheme": "servicofeito",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "assetBundlePatterns": ["**/*"],
    "ios": { "supportsTablet": false, "bundleIdentifier": "com.servicofeito.app" },
    "android": { "package": "com.servicofeito.app" },
    "plugins": ["expo-router", "expo-secure-store"],
    "experiments": { "typedRoutes": true }
  }
}
```

- [ ] **Step 3: Criar `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts", "nativewind-env.d.ts"]
}
```

- [ ] **Step 4: Criar `apps/mobile/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

- [ ] **Step 5: Criar `apps/mobile/metro.config.js`**

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 6: Criar `apps/mobile/expo-env.d.ts`**

```ts
/// <reference types="expo/types" />
```

- [ ] **Step 7: Criar `apps/mobile/.gitignore`**

```gitignore
.expo/
dist/
node_modules/
*.log
.env
.env.*
!.env.example
```

- [ ] **Step 8: Criar `apps/mobile/app/_layout.tsx` (mínimo — expandido na Task 9)**

```tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 9: Criar `apps/mobile/app/index.tsx` (placeholder — substituído na Task 9)**

```tsx
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Serviço Feito</Text>
    </View>
  );
}
```

- [ ] **Step 10: Instalar**

Run: `pnpm install`
Expected: resolve `@servico-feito/mobile`; sem erro de peer/version fatal (WARN de engine Node 18 aceito). `pnpm ls --filter @servico-feito/mobile expo` mostra `expo@52.x`.

- [ ] **Step 11: Typecheck**

Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit`
Expected: exit 0. (Se reclamar de `expo-router/entry` ou tipos de rota, rodar `pnpm --filter @servico-feito/mobile exec expo customize tsconfig.json` NÃO — em vez disso confirmar que `.expo/types` só existe após um `expo start`; nesse caso remover `".expo/types/**/*.ts"` do `include` até a Task 9 e anotar.)

- [ ] **Step 12: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): scaffold do app Expo + Expo Router"
```

---

## Task 2: NativeWind + tema (tokens SF)

**Files:**
- Create: `apps/mobile/tailwind.config.js`, `apps/mobile/global.css`, `apps/mobile/nativewind-env.d.ts`
- Create: `apps/mobile/src/shared/theme/tokens.ts`, `apps/mobile/src/shared/theme/tokens.test.ts`

**Interfaces:**
- Consumes: scaffold da Task 1.
- Produces: classes Tailwind `bg-sf-primary`, `text-sf-body`, etc.; `import { cores } from "@/shared/theme/tokens"` com as mesmas chaves.

- [ ] **Step 1: Escrever `apps/mobile/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        sf: {
          primary: "#4DAF50",
          secondary: "#70D173",
          tint: "#CBE8CC",
          "dark-green": "#2E7D32",
          text: "#333333",
          body: "#6B6B6B",
          muted: "#9E9E9E",
          favorite: "#E02957",
          bg: "#FAFAFA",
          surface: "#FFFFFF",
          "surface-variant": "#F1F8F1",
          outline: "#E0E0E0",
          "status-yellow": "#FFA000",
          "status-blue": "#1976D2",
          "status-green": "#388E3C",
          "status-red": "#D32F2F",
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Escrever `apps/mobile/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Escrever `apps/mobile/nativewind-env.d.ts`**

```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 4: Escrever `apps/mobile/src/shared/theme/tokens.ts`**

```ts
// Espelho JS dos tokens de cor (mesmas chaves de tailwind.config.js > theme.extend.colors.sf).
// Uso: quando um valor de cor precisa ir para uma prop RN nativa (ex.: statusBarColor,
// tabBarActiveTintColor) e não dá para usar className.
export const cores = {
  primary: "#4DAF50",
  secondary: "#70D173",
  tint: "#CBE8CC",
  darkGreen: "#2E7D32",
  text: "#333333",
  body: "#6B6B6B",
  muted: "#9E9E9E",
  favorite: "#E02957",
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  surfaceVariant: "#F1F8F1",
  outline: "#E0E0E0",
  statusYellow: "#FFA000",
  statusBlue: "#1976D2",
  statusGreen: "#388E3C",
  statusRed: "#D32F2F",
} as const;

export type CorSF = keyof typeof cores;
```

- [ ] **Step 5: Escrever o teste `apps/mobile/src/shared/theme/tokens.test.ts`**

```ts
import { cores } from "./tokens";

const tw = require("../../../tailwind.config.js").theme.extend.colors.sf;

describe("tokens de tema", () => {
  it("primary/body/dark-green batem com o tailwind.config", () => {
    expect(cores.primary).toBe(tw.primary);
    expect(cores.body).toBe(tw.body);
    expect(cores.darkGreen).toBe(tw["dark-green"]);
  });

  it("todo valor é um hex de 6 dígitos", () => {
    for (const v of Object.values(cores)) {
      expect(v).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
```

- [ ] **Step 6: Rodar (o teste falha — jest ainda não configurado)**

Run: `pnpm --filter @servico-feito/mobile test tokens`
Expected: FAIL — "jest is not configured" / "preset not found". (Jest é configurado na Task 3; deixar a task registrada e seguir — o commit desta task inclui o teste, que passa a verde após a Task 3. Anotar isto no relatório.)

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/tailwind.config.js apps/mobile/global.css apps/mobile/nativewind-env.d.ts apps/mobile/src/shared/theme
git commit -m "feat(mobile): NativeWind + tokens de tema portados do Compose"
```

---

## Task 3: Jest (`jest-expo`) + mocks

**Files:**
- Create: `apps/mobile/jest.config.js`, `apps/mobile/jest.setup.ts`, `apps/mobile/.eslintrc.js`

**Interfaces:**
- Consumes: deps da Task 1.
- Produces: `pnpm --filter @servico-feito/mobile test` roda; `expo-secure-store` e `async-storage` mockados globalmente.

- [ ] **Step 1: Escrever `apps/mobile/jest.config.js`**

```js
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@supabase/.*|nativewind|zustand))",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.test.{ts,tsx}"],
};
```

- [ ] **Step 2: Escrever `apps/mobile/jest.setup.ts`**

```ts
import "@testing-library/react-native/extend-expect";

// --- expo-secure-store: mock em memória ---
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    __store: store,
  };
});

// --- async-storage: mock oficial ---
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// --- variáveis EXPO_PUBLIC_* para os testes ---
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
```

- [ ] **Step 3: Escrever `apps/mobile/.eslintrc.js`**

```js
module.exports = {
  extends: ["expo"],
  ignorePatterns: ["/dist", "/.expo", "node_modules"],
};
```

- [ ] **Step 4: Rodar o teste de tokens da Task 2 (agora deve passar)**

Run: `pnpm --filter @servico-feito/mobile test tokens`
Expected: PASS — 2 testes.

- [ ] **Step 5: Rodar o lint**

Run: `pnpm --filter @servico-feito/mobile lint`
Expected: exit 0 (ou só warnings). Corrigir erros de lint introduzidos.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/jest.config.js apps/mobile/jest.setup.ts apps/mobile/.eslintrc.js
git commit -m "test(mobile): jest-expo + mocks de secure-store e async-storage"
```

---

## Task 4: `SecureStoreAdapter` (storage de sessão fatiado)

**Files:**
- Create: `apps/mobile/src/shared/api/secureStoreAdapter.ts`
- Create: `apps/mobile/src/shared/api/secureStoreAdapter.test.ts`

**Interfaces:**
- Consumes: `expo-secure-store` (`getItemAsync`, `setItemAsync`, `deleteItemAsync`).
- Produces: `export const secureStoreAdapter: { getItem(key): Promise<string | null>; setItem(key, value): Promise<void>; removeItem(key): Promise<void> }` — compatível com o campo `auth.storage` do `createClient`. Fatia valores > `TAMANHO_MAX_CHUNK` (2000 bytes) em `<key>.0`, `<key>.1`, … e grava `<key>.__chunks` com a contagem; `getItem` remonta; `removeItem` apaga todos os chunks.

- [ ] **Step 1: Escrever o teste `secureStoreAdapter.test.ts`**

```ts
import * as SecureStore from "expo-secure-store";
import { secureStoreAdapter } from "./secureStoreAdapter";

const raw = SecureStore as unknown as { __store: Map<string, string> };

beforeEach(() => raw.__store.clear());

describe("secureStoreAdapter", () => {
  it("round-trip de valor pequeno", async () => {
    await secureStoreAdapter.setItem("sess", "abc");
    expect(await secureStoreAdapter.getItem("sess")).toBe("abc");
  });

  it("getItem de chave inexistente devolve null", async () => {
    expect(await secureStoreAdapter.getItem("nada")).toBeNull();
  });

  it("fatia valor grande e remonta idêntico", async () => {
    const big = "x".repeat(5000);
    await secureStoreAdapter.setItem("sess", big);
    // gravou em chunks, não em "sess" direto
    expect(raw.__store.get("sess")).toBeUndefined();
    expect(raw.__store.get("sess.__chunks")).toBe("3");
    expect(await secureStoreAdapter.getItem("sess")).toBe(big);
  });

  it("regravar menor limpa os chunks antigos", async () => {
    await secureStoreAdapter.setItem("sess", "y".repeat(5000));
    await secureStoreAdapter.setItem("sess", "curto");
    expect(raw.__store.get("sess.__chunks")).toBeUndefined();
    expect(raw.__store.get("sess.2")).toBeUndefined();
    expect(await secureStoreAdapter.getItem("sess")).toBe("curto");
  });

  it("removeItem apaga valor e todos os chunks", async () => {
    await secureStoreAdapter.setItem("sess", "z".repeat(5000));
    await secureStoreAdapter.removeItem("sess");
    expect(await secureStoreAdapter.getItem("sess")).toBeNull();
    expect(raw.__store.get("sess.0")).toBeUndefined();
    expect(raw.__store.get("sess.__chunks")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar — FALHA**

Run: `pnpm --filter @servico-feito/mobile test secureStoreAdapter`
Expected: FAIL — "Cannot find module './secureStoreAdapter'".

- [ ] **Step 3: Escrever `secureStoreAdapter.ts`**

```ts
import * as SecureStore from "expo-secure-store";

const TAMANHO_MAX_CHUNK = 2000; // expo-secure-store: ~2 KB por entrada
const SUFIXO_CONTAGEM = ".__chunks";

async function limparChunks(key: string): Promise<void> {
  const contagem = await SecureStore.getItemAsync(key + SUFIXO_CONTAGEM);
  if (contagem == null) return;
  const n = Number.parseInt(contagem, 10);
  await SecureStore.deleteItemAsync(key + SUFIXO_CONTAGEM);
  for (let i = 0; i < n; i++) {
    await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
}

export const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const contagem = await SecureStore.getItemAsync(key + SUFIXO_CONTAGEM);
    if (contagem != null) {
      const n = Number.parseInt(contagem, 10);
      const partes: string[] = [];
      for (let i = 0; i < n; i++) {
        const parte = await SecureStore.getItemAsync(`${key}.${i}`);
        if (parte == null) return null; // chunk faltando → tratar como ausente
        partes.push(parte);
      }
      return partes.join("");
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await limparChunks(key);
    if (value.length <= TAMANHO_MAX_CHUNK) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    await SecureStore.deleteItemAsync(key);
    const n = Math.ceil(value.length / TAMANHO_MAX_CHUNK);
    for (let i = 0; i < n; i++) {
      const slice = value.slice(i * TAMANHO_MAX_CHUNK, (i + 1) * TAMANHO_MAX_CHUNK);
      await SecureStore.setItemAsync(`${key}.${i}`, slice);
    }
    await SecureStore.setItemAsync(key + SUFIXO_CONTAGEM, String(n));
  },

  async removeItem(key: string): Promise<void> {
    await limparChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};
```

- [ ] **Step 4: Rodar — PASSA**

Run: `pnpm --filter @servico-feito/mobile test secureStoreAdapter`
Expected: PASS — 5 testes.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → exit 0.

```bash
git add apps/mobile/src/shared/api/secureStoreAdapter.ts apps/mobile/src/shared/api/secureStoreAdapter.test.ts
git commit -m "feat(mobile): SecureStoreAdapter fatiado para sessão Supabase"
```

---

## Task 5: `supabaseClient.ts`

**Files:**
- Create: `apps/mobile/src/shared/api/supabaseClient.ts`
- Create: `apps/mobile/src/shared/api/supabaseClient.test.ts`
- Create: `apps/mobile/.env.example`

**Interfaces:**
- Consumes: `secureStoreAdapter` (Task 4); `@servico-feito/db-types` (`Database`); env `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Produces: `export const supabase: SupabaseClient<Database>` — singleton. `auth.storage = secureStoreAdapter`, `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: false`. `export function assertEnvSupabase(): void` lança se faltar env.

- [ ] **Step 1: Escrever `apps/mobile/.env.example`**

```dotenv
# Valores do projeto servico-feito-dev (Project Settings > API). anon key é pública.
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 2: Escrever o teste `supabaseClient.test.ts`**

```ts
describe("supabaseClient", () => {
  it("exporta um client com auth configurado", () => {
    const { supabase } = require("./supabaseClient");
    expect(typeof supabase.auth.getSession).toBe("function");
    expect(typeof supabase.from).toBe("function");
  });

  it("assertEnvSupabase não lança quando as env estão setadas", () => {
    const { assertEnvSupabase } = require("./supabaseClient");
    expect(() => assertEnvSupabase()).not.toThrow();
  });

  it("assertEnvSupabase lança quando falta a URL", () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    jest.resetModules();
    const { assertEnvSupabase } = require("./supabaseClient");
    expect(() => assertEnvSupabase()).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
    process.env.EXPO_PUBLIC_SUPABASE_URL = url;
    jest.resetModules();
  });
});
```

- [ ] **Step 3: Rodar — FALHA** (`Cannot find module './supabaseClient'`).

- [ ] **Step 4: Escrever `supabaseClient.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@servico-feito/db-types";
import { secureStoreAdapter } from "./secureStoreAdapter";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function assertEnvSupabase(): void {
  if (!URL) throw new Error("Falta EXPO_PUBLIC_SUPABASE_URL no .env do app");
  if (!ANON) throw new Error("Falta EXPO_PUBLIC_SUPABASE_ANON_KEY no .env do app");
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  URL ?? "http://invalid.local",
  ANON ?? "invalid",
  {
    auth: {
      storage: secureStoreAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
```

- [ ] **Step 5: Rodar — PASSA** (3 testes). Typecheck exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/shared/api/supabaseClient.ts apps/mobile/src/shared/api/supabaseClient.test.ts apps/mobile/.env.example
git commit -m "feat(mobile): cliente Supabase com storage seguro + guarda de env"
```

---

## Task 6: `authStore` (Zustand)

**Files:**
- Create: `apps/mobile/src/shared/store/authStore.ts`
- Create: `apps/mobile/src/shared/store/authStore.test.ts`

**Interfaces:**
- Consumes: `supabase` (Task 5).
- Produces:
  - `useAuthStore` (Zustand) com estado `{ session: Session | null; usuarioId: string | null; carregando: boolean }`.
  - Ações: `hidratar(): Promise<void>` (chama `supabase.auth.getSession()`, seta `session`/`usuarioId`, `carregando=false`), `definirSessao(session: Session | null): void`, `sair(): Promise<void>` (`supabase.auth.signOut()` + limpa estado).
  - `iniciarListenerAuth(): () => void` — assina `supabase.auth.onAuthStateChange` chamando `definirSessao`; devolve o unsubscribe.
  - `usuarioId` = `session?.user?.id ?? null`.

- [ ] **Step 1: Escrever o teste `authStore.test.ts`**

```ts
import { useAuthStore } from "./authStore";

const supa = require("../api/supabaseClient").supabase;

const fakeSession = (id: string) =>
  ({ user: { id }, access_token: "t", refresh_token: "r" }) as any;

beforeEach(() => {
  useAuthStore.setState({ session: null, usuarioId: null, carregando: true });
  jest.restoreAllMocks();
});

describe("authStore", () => {
  it("hidratar seta session/usuarioId e carregando=false", async () => {
    jest
      .spyOn(supa.auth, "getSession")
      .mockResolvedValue({ data: { session: fakeSession("u1") }, error: null });
    await useAuthStore.getState().hidratar();
    const s = useAuthStore.getState();
    expect(s.usuarioId).toBe("u1");
    expect(s.carregando).toBe(false);
  });

  it("hidratar sem sessão deixa usuarioId null e carregando false", async () => {
    jest.spyOn(supa.auth, "getSession").mockResolvedValue({ data: { session: null }, error: null });
    await useAuthStore.getState().hidratar();
    expect(useAuthStore.getState().usuarioId).toBeNull();
    expect(useAuthStore.getState().carregando).toBe(false);
  });

  it("definirSessao(null) limpa usuarioId", () => {
    useAuthStore.setState({ session: fakeSession("u1"), usuarioId: "u1" });
    useAuthStore.getState().definirSessao(null);
    expect(useAuthStore.getState().usuarioId).toBeNull();
  });

  it("sair chama supabase.auth.signOut e limpa estado", async () => {
    const signOut = jest.spyOn(supa.auth, "signOut").mockResolvedValue({ error: null });
    useAuthStore.setState({ session: fakeSession("u1"), usuarioId: "u1" });
    await useAuthStore.getState().sair();
    expect(signOut).toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("iniciarListenerAuth assina onAuthStateChange e devolve unsubscribe", () => {
    const unsub = jest.fn();
    jest
      .spyOn(supa.auth, "onAuthStateChange")
      .mockReturnValue({ data: { subscription: { unsubscribe: unsub } } });
    const stop = useAuthStore.getState().iniciarListenerAuth();
    stop();
    expect(unsub).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `authStore.ts`**

```ts
import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../api/supabaseClient";

interface AuthState {
  session: Session | null;
  usuarioId: string | null;
  carregando: boolean;
  hidratar: () => Promise<void>;
  definirSessao: (session: Session | null) => void;
  sair: () => Promise<void>;
  iniciarListenerAuth: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  usuarioId: null,
  carregando: true,

  hidratar: async () => {
    const { data } = await supabase.auth.getSession();
    set({
      session: data.session ?? null,
      usuarioId: data.session?.user?.id ?? null,
      carregando: false,
    });
  },

  definirSessao: (session) =>
    set({ session, usuarioId: session?.user?.id ?? null }),

  sair: async () => {
    await supabase.auth.signOut();
    set({ session: null, usuarioId: null });
  },

  iniciarListenerAuth: () => {
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      set({ session, usuarioId: session?.user?.id ?? null });
    });
    return () => data.subscription.unsubscribe();
  },
}));
```

- [ ] **Step 4: Rodar — PASSA (5 testes). Typecheck exit 0.**

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/shared/store/authStore.ts apps/mobile/src/shared/store/authStore.test.ts
git commit -m "feat(mobile): authStore (sessão Supabase + listener)"
```

---

## Task 7: `uiModeStore` (Zustand + AsyncStorage)

**Files:**
- Create: `apps/mobile/src/shared/store/uiModeStore.ts`
- Create: `apps/mobile/src/shared/store/uiModeStore.test.ts`

**Interfaces:**
- Consumes: `@react-native-async-storage/async-storage`.
- Produces:
  - `useUiModeStore` com `{ modo: "contratar" | "prestar"; carregado: boolean }`.
  - Ações: `carregar(): Promise<void>` (lê `@sf/modo` do AsyncStorage; default `"contratar"`; seta `carregado=true`), `definirModo(modo): Promise<void>` (seta + persiste), `alternar(): Promise<void>`.
  - Chave de persistência: `@sf/modo`.

- [ ] **Step 1: Escrever o teste `uiModeStore.test.ts`**

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUiModeStore } from "./uiModeStore";

beforeEach(async () => {
  await AsyncStorage.clear();
  useUiModeStore.setState({ modo: "contratar", carregado: false });
});

describe("uiModeStore", () => {
  it("carregar sem valor salvo usa 'contratar'", async () => {
    await useUiModeStore.getState().carregar();
    expect(useUiModeStore.getState().modo).toBe("contratar");
    expect(useUiModeStore.getState().carregado).toBe(true);
  });

  it("carregar lê o valor persistido", async () => {
    await AsyncStorage.setItem("@sf/modo", "prestar");
    await useUiModeStore.getState().carregar();
    expect(useUiModeStore.getState().modo).toBe("prestar");
  });

  it("definirModo persiste", async () => {
    await useUiModeStore.getState().definirModo("prestar");
    expect(await AsyncStorage.getItem("@sf/modo")).toBe("prestar");
    expect(useUiModeStore.getState().modo).toBe("prestar");
  });

  it("alternar troca contratar↔prestar e persiste", async () => {
    await useUiModeStore.getState().alternar();
    expect(useUiModeStore.getState().modo).toBe("prestar");
    await useUiModeStore.getState().alternar();
    expect(useUiModeStore.getState().modo).toBe("contratar");
    expect(await AsyncStorage.getItem("@sf/modo")).toBe("contratar");
  });
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `uiModeStore.ts`**

```ts
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Modo = "contratar" | "prestar";
const CHAVE = "@sf/modo";

interface UiModeState {
  modo: Modo;
  carregado: boolean;
  carregar: () => Promise<void>;
  definirModo: (modo: Modo) => Promise<void>;
  alternar: () => Promise<void>;
}

export const useUiModeStore = create<UiModeState>((set, get) => ({
  modo: "contratar",
  carregado: false,

  carregar: async () => {
    const salvo = await AsyncStorage.getItem(CHAVE);
    set({ modo: salvo === "prestar" ? "prestar" : "contratar", carregado: true });
  },

  definirModo: async (modo) => {
    await AsyncStorage.setItem(CHAVE, modo);
    set({ modo });
  },

  alternar: async () => {
    const proximo: Modo = get().modo === "contratar" ? "prestar" : "contratar";
    await get().definirModo(proximo);
  },
}));
```

- [ ] **Step 4: Rodar — PASSA (4 testes). Typecheck exit 0.**

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/shared/store/uiModeStore.ts apps/mobile/src/shared/store/uiModeStore.test.ts
git commit -m "feat(mobile): uiModeStore (contratar/prestar persistido)"
```

---

## Task 8: `QueryClient` compartilhado

**Files:**
- Create: `apps/mobile/src/shared/query/queryClient.ts`
- Create: `apps/mobile/src/shared/query/queryClient.test.ts`

**Interfaces:**
- Consumes: `@tanstack/react-query`.
- Produces: `export const queryClient: QueryClient` — `defaultOptions.queries = { retry: 2, staleTime: 30_000 }`; `QueryCache` com `onError` que chama `notificarErroGlobal(msg: string)` (stub exportado, substituível por toast real depois).
  - `export function notificarErroGlobal(msg: string): void` (default: `console.warn`).
  - `export function limparCacheQuery(): void` → `queryClient.clear()` (usado no `sair` do fluxo de logout).

- [ ] **Step 1: Escrever o teste `queryClient.test.ts`**

```ts
import { queryClient, limparCacheQuery } from "./queryClient";

describe("queryClient", () => {
  it("queries default: retry 2, staleTime 30s", () => {
    const q = queryClient.getDefaultOptions().queries!;
    expect(q.retry).toBe(2);
    expect(q.staleTime).toBe(30_000);
  });

  it("limparCacheQuery esvazia o cache", () => {
    queryClient.setQueryData(["x"], 1);
    expect(queryClient.getQueryData(["x"])).toBe(1);
    limparCacheQuery();
    expect(queryClient.getQueryData(["x"])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `queryClient.ts`**

```ts
import { QueryClient, QueryCache } from "@tanstack/react-query";

export function notificarErroGlobal(msg: string): void {
  // Substituído por um toast real numa task de UI futura.
  console.warn("[erro]", msg);
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
  queryCache: new QueryCache({
    onError: (erro) => {
      notificarErroGlobal(erro instanceof Error ? erro.message : "Erro inesperado");
    },
  }),
});

export function limparCacheQuery(): void {
  queryClient.clear();
}
```

- [ ] **Step 4: Rodar — PASSA (2 testes). Typecheck exit 0.**

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/shared/query
git commit -m "feat(mobile): QueryClient compartilhado + erro global"
```

---

## Task 9: Root layout + rota raiz + grupos protegidos

**Files:**
- Modify: `apps/mobile/app/_layout.tsx` (substitui o mínimo da Task 1)
- Modify: `apps/mobile/app/index.tsx` (substitui o placeholder)
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(app)/_layout.tsx`
- Create: `apps/mobile/src/features/perfil/hooks/usePerfilAtual.ts` + `usePerfilAtual.test.ts`
- Create: `apps/mobile/src/features/perfil/types/perfil.types.ts`

**Interfaces:**
- Consumes: `useAuthStore` (Task 6), `useUiModeStore` (Task 7), `queryClient` (Task 8), `supabase` (Task 5).
- Produces:
  - `RootLayout` — monta `<QueryClientProvider>`, `<GestureHandlerRootView>`, importa `../global.css`; num `useEffect` chama `useAuthStore.getState().hidratar()`, `useUiModeStore.getState().carregar()` e `useAuthStore.getState().iniciarListenerAuth()` (cleanup no unmount); enquanto `carregando` mostra `<CarregandoEstado />` (Task 13 — até lá, um `<ActivityIndicator />` inline).
  - `usePerfilAtual()` → `useQuery(['perfil','atual', usuarioId])` que faz `supabase.from('usuarios').select('id, nome, telefone, cidade').eq('id', usuarioId).single()`; retorna `{ data: PerfilAtual | undefined, isLoading, isError }`. `PerfilAtual = { id: string; nome: string | null; telefone: string | null; cidade: string | null }`.
  - `(auth)/_layout.tsx` — `if (session) return <Redirect href="/(app)/(tabs)" />; return <Stack .../>`.
  - `(app)/_layout.tsx` — `if (!session) return <Redirect href="/(auth)/login" />`; usa `usePerfilAtual()`; `if (perfil && !perfil.nome && pathname !== '/(app)/completar-perfil') return <Redirect href="/(app)/completar-perfil" />`; senão `<Stack .../>`.
  - `app/index.tsx` — `const { session, carregando } = useAuthStore(); if (carregando) return <ActivityIndicator/>; return <Redirect href={session ? "/(app)/(tabs)" : "/(auth)/login"} />`.

- [ ] **Step 1: Escrever `apps/mobile/src/features/perfil/types/perfil.types.ts`**

```ts
export interface PerfilAtual {
  id: string;
  nome: string | null;
  telefone: string | null;
  cidade: string | null;
}
```

- [ ] **Step 2: Escrever o teste `usePerfilAtual.test.ts`**

```ts
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePerfilAtual } from "./usePerfilAtual";

const supa = require("@/shared/api/supabaseClient").supabase;
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: any) => sel({ usuarioId: "u1" }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

it("busca a linha própria de usuarios", async () => {
  const single = jest.fn().mockResolvedValue({
    data: { id: "u1", nome: "Ana", telefone: null, cidade: "Floripa" },
    error: null,
  });
  jest.spyOn(supa, "from").mockReturnValue({
    select: () => ({ eq: () => ({ single }) }),
  } as any);

  const { result } = renderHook(() => usePerfilAtual(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data?.nome).toBe("Ana");
  expect(supa.from).toHaveBeenCalledWith("usuarios");
});
```

- [ ] **Step 3: Rodar — FALHA.**

- [ ] **Step 4: Escrever `apps/mobile/src/features/perfil/hooks/usePerfilAtual.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabaseClient";
import { useAuthStore } from "@/shared/store/authStore";
import type { PerfilAtual } from "../types/perfil.types";

export function usePerfilAtual() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useQuery<PerfilAtual | null>({
    queryKey: ["perfil", "atual", usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome, telefone, cidade")
        .eq("id", usuarioId!)
        .single();
      if (error) throw new Error(error.message);
      return data as PerfilAtual;
    },
  });
}
```

- [ ] **Step 5: Rodar — PASSA. Typecheck exit 0.**

- [ ] **Step 6: Escrever `apps/mobile/app/_layout.tsx`**

```tsx
import "../global.css";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "@/shared/store/authStore";
import { useUiModeStore } from "@/shared/store/uiModeStore";

export default function RootLayout() {
  const carregando = useAuthStore((s) => s.carregando);

  useEffect(() => {
    useAuthStore.getState().hidratar();
    useUiModeStore.getState().carregar();
    const parar = useAuthStore.getState().iniciarListenerAuth();
    return parar;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        {carregando ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <Stack screenOptions={{ headerShown: false }} />
        )}
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 7: Escrever `apps/mobile/app/index.tsx`**

```tsx
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";

export default function Index() {
  const { session, carregando } = useAuthStore((s) => ({ session: s.session, carregando: s.carregando }));
  if (carregando) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={session ? "/(app)/(tabs)" : "/(auth)/login"} />;
}
```

- [ ] **Step 8: Escrever `apps/mobile/app/(auth)/_layout.tsx`**

```tsx
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);
  if (session) return <Redirect href="/(app)/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 9: Escrever `apps/mobile/app/(app)/_layout.tsx`**

```tsx
import { Redirect, Stack, usePathname } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";
import { usePerfilAtual } from "@/features/perfil/hooks/usePerfilAtual";

export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  const pathname = usePathname();
  const { data: perfil } = usePerfilAtual();

  if (!session) return <Redirect href="/(auth)/login" />;
  if (perfil && !perfil.nome && pathname !== "/completar-perfil") {
    return <Redirect href="/(app)/completar-perfil" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 10: Typecheck + testes + commit**

Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → exit 0.
Run: `pnpm --filter @servico-feito/mobile test` → todos verdes.

```bash
git add apps/mobile/app apps/mobile/src/features/perfil
git commit -m "feat(mobile): root layout + grupos de rota protegidos por sessão"
```

---

## Task 10: Feature `auth` — hooks + telas de login/registro/redefinição

**Files:**
- Create: `apps/mobile/src/features/auth/types/auth.types.ts`
- Create: `apps/mobile/src/features/auth/hooks/{useSignIn,useSignUp,useResetPassword}.ts` + `.test.ts` de cada
- Create: `apps/mobile/src/features/auth/screens/{LoginScreen,RegistrarScreen,RedefinirSenhaScreen}.tsx`
- Create: `apps/mobile/app/(auth)/{login,registrar,redefinir-senha}.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 5), `useAuthStore` (Task 6), `Botao`/`CampoTexto`/`Texto` (Task 13 — até lá `TextInput`/`Pressable` nativos com className).
- Produces:
  - `useSignIn()` → `useMutation({ mutationFn: ({ email, senha }) => supabase.auth.signInWithPassword(...) })`, `onError` normaliza para mensagem PT; `onSuccess` nada (o listener do authStore cuida do redirect).
  - `useSignUp()` → `supabase.auth.signUp({ email, password })`.
  - `useResetPassword()` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: "servicofeito://auth/redefinir" })`.
  - `type CredenciaisLogin = { email: string; senha: string }`. `type MensagemErro = string`.
  - `traduzErroAuth(erro: unknown): string` — mapeia mensagens comuns do GoTrue (`Invalid login credentials` → "E-mail ou senha incorretos", `User already registered` → "E-mail já cadastrado", `over_email_send_rate_limit` → "Muitas tentativas, aguarde", default "Não foi possível concluir").

- [ ] **Step 1: Escrever `auth.types.ts`**

```ts
export interface CredenciaisLogin {
  email: string;
  senha: string;
}

export function traduzErroAuth(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String(erro ?? "");
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/user already registered|already been registered/i.test(msg)) return "E-mail já cadastrado.";
  if (/rate limit|over_email_send/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos.";
  if (/password should be at least/i.test(msg)) return "A senha precisa ter ao menos 6 caracteres.";
  if (/unable to validate email|invalid format/i.test(msg)) return "E-mail inválido.";
  return "Não foi possível concluir. Tente de novo.";
}
```

- [ ] **Step 2: Escrever `useSignIn.test.ts`**

```ts
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSignIn } from "./useSignIn";

const supa = require("@/shared/api/supabaseClient").supabase;
const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

it("sucesso chama signInWithPassword com email/senha", async () => {
  const spy = jest
    .spyOn(supa.auth, "signInWithPassword")
    .mockResolvedValue({ data: { session: {} }, error: null });
  const { result } = renderHook(() => useSignIn(), { wrapper });
  result.current.mutate({ email: "a@b.com", senha: "secret1" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(spy).toHaveBeenCalledWith({ email: "a@b.com", password: "secret1" });
});

it("erro do GoTrue vira mensagem PT", async () => {
  jest
    .spyOn(supa.auth, "signInWithPassword")
    .mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
  const { result } = renderHook(() => useSignIn(), { wrapper });
  result.current.mutate({ email: "a@b.com", senha: "x" });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect((result.current.error as Error).message).toBe("E-mail ou senha incorretos.");
});
```

- [ ] **Step 3: Rodar — FALHA.**

- [ ] **Step 4: Escrever `useSignIn.ts`**

```ts
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabaseClient";
import { traduzErroAuth, type CredenciaisLogin } from "../types/auth.types";

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, senha }: CredenciaisLogin) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error(traduzErroAuth(error));
    },
  });
}
```

- [ ] **Step 5: Escrever `useSignUp.ts` + `useSignUp.test.ts`** (mesma forma: `mutationFn` chama `supabase.auth.signUp({ email, password: senha })`, erro via `traduzErroAuth`; teste: sucesso chama `signUp` com `{ email, password }`, erro "User already registered" → "E-mail já cadastrado.").

```ts
// useSignUp.ts
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabaseClient";
import { traduzErroAuth, type CredenciaisLogin } from "../types/auth.types";

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ email, senha }: CredenciaisLogin) => {
      const { error } = await supabase.auth.signUp({ email, password: senha });
      if (error) throw new Error(traduzErroAuth(error));
    },
  });
}
```

```ts
// useSignUp.test.ts
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSignUp } from "./useSignUp";

const supa = require("@/shared/api/supabaseClient").supabase;
const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

it("sucesso chama signUp com email/password", async () => {
  const spy = jest.spyOn(supa.auth, "signUp").mockResolvedValue({ data: {}, error: null });
  const { result } = renderHook(() => useSignUp(), { wrapper });
  result.current.mutate({ email: "a@b.com", senha: "secret1" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(spy).toHaveBeenCalledWith({ email: "a@b.com", password: "secret1" });
});

it("e-mail já cadastrado vira mensagem PT", async () => {
  jest
    .spyOn(supa.auth, "signUp")
    .mockResolvedValue({ data: {}, error: { message: "User already registered" } });
  const { result } = renderHook(() => useSignUp(), { wrapper });
  result.current.mutate({ email: "a@b.com", senha: "secret1" });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect((result.current.error as Error).message).toBe("E-mail já cadastrado.");
});
```

- [ ] **Step 6: Escrever `useResetPassword.ts` + `useResetPassword.test.ts`**

```ts
// useResetPassword.ts
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabaseClient";
import { traduzErroAuth } from "../types/auth.types";

export function useResetPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "servicofeito://auth/redefinir",
      });
      if (error) throw new Error(traduzErroAuth(error));
    },
  });
}
```

```ts
// useResetPassword.test.ts
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useResetPassword } from "./useResetPassword";

const supa = require("@/shared/api/supabaseClient").supabase;
const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

it("chama resetPasswordForEmail com o deep link", async () => {
  const spy = jest
    .spyOn(supa.auth, "resetPasswordForEmail")
    .mockResolvedValue({ data: {}, error: null });
  const { result } = renderHook(() => useResetPassword(), { wrapper });
  result.current.mutate("a@b.com");
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(spy).toHaveBeenCalledWith("a@b.com", { redirectTo: "servicofeito://auth/redefinir" });
});
```

- [ ] **Step 7: Rodar os 3 testes de hook — todos PASSAM.**

- [ ] **Step 8: Escrever `LoginScreen.tsx`** (validação local mínima: email não-vazio + senha ≥ 6; erro da mutation exibido; links pra `registrar` e `redefinir-senha`)

```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useSignIn } from "../hooks/useSignIn";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const signIn = useSignIn();
  const podeEnviar = email.includes("@") && senha.length >= 6 && !signIn.isPending;

  return (
    <View className="flex-1 bg-sf-bg px-6 justify-center gap-3">
      <Text className="text-2xl font-bold text-sf-text mb-2">Entrar</Text>
      <TextInput
        className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text"
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text"
        placeholder="Senha"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
      />
      {signIn.isError ? (
        <Text className="text-sf-status-red">{(signIn.error as Error).message}</Text>
      ) : null}
      <Pressable
        disabled={!podeEnviar}
        onPress={() => signIn.mutate({ email, senha })}
        className={`rounded-lg py-3 items-center ${podeEnviar ? "bg-sf-primary" : "bg-sf-muted"}`}
      >
        {signIn.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Entrar</Text>}
      </Pressable>
      <View className="flex-row justify-between mt-2">
        <Link href="/(auth)/registrar" className="text-sf-primary">Criar conta</Link>
        <Link href="/(auth)/redefinir-senha" className="text-sf-body">Esqueci a senha</Link>
      </View>
    </View>
  );
}
```

- [ ] **Step 9: Escrever `RegistrarScreen.tsx`** (mesma estrutura: campos email/senha/confirmar; valida senha == confirmar e ≥ 6; usa `useSignUp`; ao `isSuccess` mostra "Verifique seu e-mail para confirmar" OU — se o projeto tiver confirmação de e-mail desligada — o listener já loga e o grupo `(auth)` redireciona; link "Já tenho conta" → `/(auth)/login`).

- [ ] **Step 10: Escrever `RedefinirSenhaScreen.tsx`** (um campo email; `useResetPassword`; ao `isSuccess` mostra "Enviamos um link para seu e-mail"; link voltar pro login).

- [ ] **Step 11: Escrever os 3 arquivos de rota**

```tsx
// apps/mobile/app/(auth)/login.tsx
import { LoginScreen } from "@/features/auth/screens/LoginScreen";
export default function LoginRoute() { return <LoginScreen />; }
```
```tsx
// apps/mobile/app/(auth)/registrar.tsx
import { RegistrarScreen } from "@/features/auth/screens/RegistrarScreen";
export default function RegistrarRoute() { return <RegistrarScreen />; }
```
```tsx
// apps/mobile/app/(auth)/redefinir-senha.tsx
import { RedefinirSenhaScreen } from "@/features/auth/screens/RedefinirSenhaScreen";
export default function RedefinirSenhaRoute() { return <RedefinirSenhaScreen />; }
```

- [ ] **Step 12: Typecheck + testes + commit**

Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → exit 0.
Run: `pnpm --filter @servico-feito/mobile test` → todos verdes.

```bash
git add apps/mobile/src/features/auth apps/mobile/app/\(auth\)
git commit -m "feat(mobile): telas e hooks de autenticação (login, registro, reset)"
```

---

## Task 11: `completar-perfil` — tela + hook

**Files:**
- Create: `apps/mobile/src/features/perfil/hooks/useCompletarPerfil.ts` + `useCompletarPerfil.test.ts`
- Create: `apps/mobile/src/features/perfil/screens/CompletarPerfilScreen.tsx`
- Create: `apps/mobile/app/(app)/completar-perfil.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 5), `useAuthStore` (Task 6), `queryClient` (Task 8), `PerfilAtual` (Task 9).
- Produces:
  - `useCompletarPerfil()` → `useMutation({ mutationFn: ({ nome, telefone, cidade }) => supabase.from('usuarios').update({ nome, telefone, cidade }).eq('id', usuarioId) })`; `onSuccess` → `queryClient.invalidateQueries({ queryKey: ['perfil','atual'] })`.
  - `type DadosPerfil = { nome: string; telefone: string; cidade: string }`.

- [ ] **Step 1: Escrever `useCompletarPerfil.test.ts`**

```ts
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCompletarPerfil } from "./useCompletarPerfil";

const supa = require("@/shared/api/supabaseClient").supabase;
jest.mock("@/shared/store/authStore", () => ({ useAuthStore: (s: any) => s({ usuarioId: "u1" }) }));

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

it("faz update em usuarios com id = usuarioId", async () => {
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq });
  jest.spyOn(supa, "from").mockReturnValue({ update } as any);

  const { result } = renderHook(() => useCompletarPerfil(), { wrapper });
  result.current.mutate({ nome: "Ana", telefone: "48999", cidade: "Floripa" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(supa.from).toHaveBeenCalledWith("usuarios");
  expect(update).toHaveBeenCalledWith({ nome: "Ana", telefone: "48999", cidade: "Floripa" });
  expect(eq).toHaveBeenCalledWith("id", "u1");
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `useCompletarPerfil.ts`**

```ts
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabaseClient";
import { useAuthStore } from "@/shared/store/authStore";
import { queryClient } from "@/shared/query/queryClient";

export interface DadosPerfil {
  nome: string;
  telefone: string;
  cidade: string;
}

export function useCompletarPerfil() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useMutation({
    mutationFn: async ({ nome, telefone, cidade }: DadosPerfil) => {
      const { error } = await supabase
        .from("usuarios")
        .update({ nome, telefone, cidade })
        .eq("id", usuarioId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["perfil", "atual"] });
    },
  });
}
```

- [ ] **Step 4: Rodar — PASSA. Typecheck exit 0.**

- [ ] **Step 5: Escrever `CompletarPerfilScreen.tsx`** (3 campos nome/telefone/cidade, todos obrigatórios não-vazios; `useCompletarPerfil`; ao `isSuccess` `router.replace("/(app)/(tabs)")`).

```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useCompletarPerfil } from "../hooks/useCompletarPerfil";

export function CompletarPerfilScreen() {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const m = useCompletarPerfil();
  const ok = nome.trim() && telefone.trim() && cidade.trim() && !m.isPending;

  if (m.isSuccess) {
    router.replace("/(app)/(tabs)");
  }

  return (
    <View className="flex-1 bg-sf-bg px-6 justify-center gap-3">
      <Text className="text-2xl font-bold text-sf-text mb-1">Complete seu perfil</Text>
      <Text className="text-sf-body mb-2">Falta pouco para começar.</Text>
      <TextInput className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text" placeholder="Nome completo" value={nome} onChangeText={setNome} />
      <TextInput className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text" placeholder="Telefone" keyboardType="phone-pad" value={telefone} onChangeText={setTelefone} />
      <TextInput className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text" placeholder="Cidade" value={cidade} onChangeText={setCidade} />
      {m.isError ? <Text className="text-sf-status-red">{(m.error as Error).message}</Text> : null}
      <Pressable disabled={!ok} onPress={() => m.mutate({ nome, telefone, cidade })} className={`rounded-lg py-3 items-center ${ok ? "bg-sf-primary" : "bg-sf-muted"}`}>
        {m.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Salvar</Text>}
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 6: Escrever `apps/mobile/app/(app)/completar-perfil.tsx`**

```tsx
import { CompletarPerfilScreen } from "@/features/perfil/screens/CompletarPerfilScreen";
export default function CompletarPerfilRoute() { return <CompletarPerfilScreen />; }
```

- [ ] **Step 7: Typecheck + testes + commit**

```bash
git add apps/mobile/src/features/perfil apps/mobile/app/\(app\)/completar-perfil.tsx
git commit -m "feat(mobile): tela completar-perfil + hook de update de usuarios"
```

---

## Task 12: `(tabs)` — layout por modo + telas stub

**Files:**
- Create: `apps/mobile/app/(app)/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/{index,buscar,vagas,conversas,trabalhos,perfil}.tsx`
- Create: `apps/mobile/src/features/shell/screens/{InicioScreen,BuscarScreen,VagasScreen,ConversasListScreen,TrabalhosScreen}.tsx`
- Create: `apps/mobile/src/features/perfil/screens/PerfilScreen.tsx`
- Create: `apps/mobile/app/(app)/(tabs)/_layout.test.tsx` (lógica condicional própria → teste de screen justificado)

**Interfaces:**
- Consumes: `useUiModeStore` (Task 7), `useAuthStore` (Task 6), `usePerfilAtual` (Task 9), `cores` (Task 2).
- Produces:
  - `(tabs)/_layout.tsx` — `<Tabs screenOptions={{ tabBarActiveTintColor: modo === 'prestar' ? cores.darkGreen : cores.primary, headerShown: true }}>` com `<Tabs.Screen>` para cada rota; a prop `href` de `buscar`/`vagas`/`trabalhos` é `null` (oculta) conforme o modo: modo `contratar` → mostra `index`, `buscar`, `conversas`, `perfil` (oculta `vagas`, `trabalhos`); modo `prestar` → mostra `index`, `vagas`, `trabalhos`, `conversas`, `perfil` (oculta `buscar`).
  - Cada `src/features/shell/screens/*` é um `<View className="flex-1 bg-sf-bg items-center justify-center"><Text className="text-sf-body">…</Text></View>` com o rótulo da tela (stub — conteúdo real nos Planos 3+).
  - `PerfilScreen` mostra o `nome`/`cidade` de `usePerfilAtual`, um `<Pressable>` "Alternar para modo prestar/contratar" que chama `useUiModeStore().alternar()`, e um "Sair" que chama `useAuthStore().sair()` + `limparCacheQuery()`.

- [ ] **Step 1: Escrever os 5 stubs `src/features/shell/screens/*.tsx`** (um por arquivo). Modelo (`InicioScreen.tsx`):

```tsx
import { View, Text } from "react-native";
import { useUiModeStore } from "@/shared/store/uiModeStore";

export function InicioScreen() {
  const modo = useUiModeStore((s) => s.modo);
  return (
    <View className="flex-1 bg-sf-bg items-center justify-center">
      <Text className="text-lg text-sf-text">Início — modo {modo === "prestar" ? "prestador" : "cliente"}</Text>
      <Text className="text-sf-muted mt-1">(conteúdo no Plano 3)</Text>
    </View>
  );
}
```
Repetir para `BuscarScreen` ("Buscar categorias"), `VagasScreen` ("Vagas / demandas abertas"), `ConversasListScreen` ("Mensagens"), `TrabalhosScreen` ("Meus trabalhos") — mesmo corpo, só o texto muda; nenhum lê `useUiModeStore` exceto `InicioScreen`.

- [ ] **Step 2: Escrever `PerfilScreen.tsx`**

```tsx
import { View, Text, Pressable } from "react-native";
import { usePerfilAtual } from "@/features/perfil/hooks/usePerfilAtual";
import { useUiModeStore } from "@/shared/store/uiModeStore";
import { useAuthStore } from "@/shared/store/authStore";
import { limparCacheQuery } from "@/shared/query/queryClient";

export function PerfilScreen() {
  const { data: perfil } = usePerfilAtual();
  const modo = useUiModeStore((s) => s.modo);

  return (
    <View className="flex-1 bg-sf-bg px-6 pt-6 gap-4">
      <Text className="text-2xl font-bold text-sf-text">{perfil?.nome ?? "Perfil"}</Text>
      <Text className="text-sf-body">{perfil?.cidade ?? ""}</Text>

      <Pressable
        onPress={() => useUiModeStore.getState().alternar()}
        className="bg-sf-surface-variant rounded-lg py-3 px-4"
      >
        <Text className="text-sf-dark-green font-medium">
          Alternar para modo {modo === "contratar" ? "prestar serviço" : "contratar"}
        </Text>
      </Pressable>

      <Pressable
        onPress={async () => {
          await useAuthStore.getState().sair();
          limparCacheQuery();
        }}
        className="mt-auto mb-8 border border-sf-status-red rounded-lg py-3 px-4"
      >
        <Text className="text-sf-status-red font-medium text-center">Sair</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Escrever `(tabs)/_layout.tsx`**

```tsx
import { Tabs } from "expo-router";
import { useUiModeStore } from "@/shared/store/uiModeStore";
import { cores } from "@/shared/theme/tokens";

export default function TabsLayout() {
  const modo = useUiModeStore((s) => s.modo);
  const prestar = modo === "prestar";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: prestar ? cores.darkGreen : cores.primary,
        headerShown: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Início" }} />
      <Tabs.Screen name="buscar" options={{ title: "Buscar", href: prestar ? null : "/(app)/(tabs)/buscar" }} />
      <Tabs.Screen name="vagas" options={{ title: "Vagas", href: prestar ? "/(app)/(tabs)/vagas" : null }} />
      <Tabs.Screen name="trabalhos" options={{ title: "Trabalhos", href: prestar ? "/(app)/(tabs)/trabalhos" : null }} />
      <Tabs.Screen name="conversas" options={{ title: "Mensagens" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
```

- [ ] **Step 4: Escrever os 6 arquivos de rota `(tabs)/*.tsx`** (cada um importa e renderiza a screen; `perfil.tsx` → `PerfilScreen`; `index.tsx` → `InicioScreen`; etc.).

```tsx
// apps/mobile/app/(app)/(tabs)/index.tsx
import { InicioScreen } from "@/features/shell/screens/InicioScreen";
export default function InicioRoute() { return <InicioScreen />; }
```
(análogo para `buscar`→`BuscarScreen`, `vagas`→`VagasScreen`, `conversas`→`ConversasListScreen`, `trabalhos`→`TrabalhosScreen`, `perfil`→`PerfilScreen`).

- [ ] **Step 5: Escrever `(tabs)/_layout.test.tsx`**

```tsx
import { render } from "@testing-library/react-native";
import { useUiModeStore } from "@/shared/store/uiModeStore";
import TabsLayout from "./_layout";

jest.mock("expo-router", () => ({
  Tabs: Object.assign(
    ({ children }: any) => <>{children}</>,
    { Screen: ({ name, options }: any) => <mock-screen data-name={name} data-href={String(options?.href)} /> },
  ),
}));

it("modo contratar oculta vagas e trabalhos", () => {
  useUiModeStore.setState({ modo: "contratar", carregado: true });
  const { UNSAFE_getAllByType } = render(<TabsLayout />);
  const screens = UNSAFE_getAllByType("mock-screen" as any);
  const byName = Object.fromEntries(screens.map((s: any) => [s.props["data-name"], s.props["data-href"]]));
  expect(byName.vagas).toBe("null");
  expect(byName.trabalhos).toBe("null");
  expect(byName.buscar).not.toBe("null");
});

it("modo prestar oculta buscar", () => {
  useUiModeStore.setState({ modo: "prestar", carregado: true });
  const { UNSAFE_getAllByType } = render(<TabsLayout />);
  const screens = UNSAFE_getAllByType("mock-screen" as any);
  const byName = Object.fromEntries(screens.map((s: any) => [s.props["data-name"], s.props["data-href"]]));
  expect(byName.buscar).toBe("null");
  expect(byName.vagas).not.toBe("null");
});
```

- [ ] **Step 6: Rodar — os 2 testes PASSAM. Typecheck exit 0. Suite inteira verde.**

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/\(app\)/\(tabs\) apps/mobile/src/features/shell apps/mobile/src/features/perfil/screens/PerfilScreen.tsx
git commit -m "feat(mobile): tabs por modo (contratar/prestar) + telas stub"
```

---

## Task 13: Componentes compartilhados (atoms + estados)

**Files:**
- Create: `apps/mobile/src/shared/components/atoms/{Botao,CampoTexto,Texto}.tsx`
- Create: `apps/mobile/src/shared/components/molecules/{CarregandoEstado,ErroEstado,VazioEstado}.tsx`
- Create: `apps/mobile/src/shared/components/atoms/Botao.test.tsx`, `apps/mobile/src/shared/components/molecules/ErroEstado.test.tsx`
- Modify: telas de auth/perfil da Task 10/11/12 para usar `Botao`/`CampoTexto` no lugar de `Pressable`/`TextInput` crus (refactor, comportamento igual).

**Interfaces:**
- Produces:
  - `Botao({ titulo, onPress, carregando?, desabilitado?, variante? }: { titulo: string; onPress: () => void; carregando?: boolean; desabilitado?: boolean; variante?: "primario" | "perigo" | "secundario" })`.
  - `CampoTexto` — wrapper de `TextInput` com o className padrão + prop `erro?: string`.
  - `Texto({ variante }: { variante?: "titulo" | "corpo" | "muted" })` — `<Text>` com className por variante.
  - `CarregandoEstado()` — centralizado com `<ActivityIndicator />`.
  - `ErroEstado({ mensagem, onRetry? })` — mensagem + botão "Tentar de novo".
  - `VazioEstado({ mensagem })`.

- [ ] **Step 1: Escrever `Botao.test.tsx`**

```tsx
import { render, fireEvent } from "@testing-library/react-native";
import { Botao } from "./Botao";

it("dispara onPress quando habilitado", () => {
  const fn = jest.fn();
  const { getByText } = render(<Botao titulo="OK" onPress={fn} />);
  fireEvent.press(getByText("OK"));
  expect(fn).toHaveBeenCalled();
});

it("não dispara quando desabilitado ou carregando", () => {
  const fn = jest.fn();
  const { getByText, rerender, queryByText } = render(<Botao titulo="OK" onPress={fn} desabilitado />);
  fireEvent.press(getByText("OK"));
  expect(fn).not.toHaveBeenCalled();
  rerender(<Botao titulo="OK" onPress={fn} carregando />);
  expect(queryByText("OK")).toBeNull(); // mostra spinner, não o título
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `Botao.tsx`**

```tsx
import { Pressable, Text, ActivityIndicator } from "react-native";

type Variante = "primario" | "perigo" | "secundario";

const fundo: Record<Variante, string> = {
  primario: "bg-sf-primary",
  perigo: "bg-sf-status-red",
  secundario: "bg-sf-surface-variant",
};
const textoCor: Record<Variante, string> = {
  primario: "text-white",
  perigo: "text-white",
  secundario: "text-sf-dark-green",
};

export function Botao({
  titulo,
  onPress,
  carregando = false,
  desabilitado = false,
  variante = "primario",
}: {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  desabilitado?: boolean;
  variante?: Variante;
}) {
  const inativo = desabilitado || carregando;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inativo}
      onPress={onPress}
      className={`rounded-lg py-3 items-center ${inativo ? "bg-sf-muted" : fundo[variante]}`}
    >
      {carregando ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className={`font-semibold ${textoCor[variante]}`}>{titulo}</Text>
      )}
    </Pressable>
  );
}
```

- [ ] **Step 4: Escrever `CampoTexto.tsx`, `Texto.tsx`, `CarregandoEstado.tsx`, `VazioEstado.tsx`** (curtos; sem lógica condicional → sem teste próprio) e `ErroEstado.tsx` + `ErroEstado.test.tsx`:

```tsx
// ErroEstado.tsx
import { View, Text, Pressable } from "react-native";

export function ErroEstado({ mensagem, onRetry }: { mensagem: string; onRetry?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-6 gap-3">
      <Text className="text-sf-status-red text-center">{mensagem}</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} className="bg-sf-primary rounded-lg py-2 px-4">
          <Text className="text-white">Tentar de novo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
```
```tsx
// ErroEstado.test.tsx
import { render, fireEvent } from "@testing-library/react-native";
import { ErroEstado } from "./ErroEstado";

it("mostra a mensagem e chama onRetry", () => {
  const fn = jest.fn();
  const { getByText } = render(<ErroEstado mensagem="Falhou" onRetry={fn} />);
  getByText("Falhou");
  fireEvent.press(getByText("Tentar de novo"));
  expect(fn).toHaveBeenCalled();
});

it("sem onRetry não renderiza o botão", () => {
  const { queryByText } = render(<ErroEstado mensagem="Falhou" />);
  expect(queryByText("Tentar de novo")).toBeNull();
});
```

- [ ] **Step 5: Refactor das telas** — em `LoginScreen`, `RegistrarScreen`, `RedefinirSenhaScreen`, `CompletarPerfilScreen`, `PerfilScreen`: trocar `<Pressable className="rounded-lg py-3…">` por `<Botao titulo=… onPress=… carregando=… desabilitado=… variante=… />` e os `<TextInput className="bg-sf-surface…">` por `<CampoTexto … />`. Comportamento e testes de hook inalterados.

- [ ] **Step 6: Typecheck + suite inteira + commit**

Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → exit 0.
Run: `pnpm --filter @servico-feito/mobile test` → verde.

```bash
git add apps/mobile/src
git commit -m "feat(mobile): componentes atoms/estados + refactor das telas"
```

---

## Task 14: `expo-doctor` + smoke de export

**Files:**
- (nenhum novo — task de verificação + eventuais ajustes de versão)

**Interfaces:**
- Consumes: todo o app.
- Produces: `pnpm --filter @servico-feito/mobile doctor` verde; `expo export` completa sem erro de resolução.

- [ ] **Step 1: Rodar `expo-doctor`**

Run: `pnpm --filter @servico-feito/mobile doctor`
Expected: "Didn't find any issues". Se apontar versões incompatíveis, rodar `pnpm --filter @servico-feito/mobile exec expo install --fix`, revisar o diff do `package.json`, `pnpm install`, e re-rodar. Anotar quaisquer bumps.

- [ ] **Step 2: Smoke de bundle**

Run: `set -a && . ./.env && set +a && pnpm --filter @servico-feito/mobile exec expo export --platform ios --output-dir /tmp/sf-export`
Expected: termina sem erro; `/tmp/sf-export/_expo/` contém bundles. (Só valida resolução de módulos / rotas — não é build nativo.) Apagar `/tmp/sf-export` depois.

- [ ] **Step 3: `tsc` com os tipos de rota gerados**

Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit`
Expected: exit 0 — agora com `.expo/types/router.d.ts` presente (gerado pelo `expo export`/`expo start`), os `href` tipados nas rotas resolvem. Se `include` do tsconfig teve `".expo/types/**/*.ts"` removido na Task 1, restaurar agora.

- [ ] **Step 4: Commit (se houve ajuste de versão / tsconfig)**

```bash
git add apps/mobile/package.json apps/mobile/tsconfig.json pnpm-lock.yaml
git commit -m "chore(mobile): expo-doctor + tipos de rota"
```

(Se nada mudou, pular o commit e anotar no relatório.)

---

## Task 15: Limpeza do repositório

**Files:**
- Delete: `servico-feito/` (raiz), `env/` (raiz)
- Modify: `docs/arquitetura-antiga/servico-feito/` — remover `.git` aninhado, `build/`, `.gradle/`, `.idea/`, `.kotlin/`, `app/build/`
- Modify: `.gitignore` (confirmar cobertura)

**Interfaces:**
- Consumes: nada.
- Produces: repo sem as pastas legadas soltas; `docs/arquitetura-antiga/` só com fonte Kotlin + docs (referência), sem `.git` aninhado. `git status` limpo.

- [ ] **Step 1: Conferir que nada em `servico-feito/` (raiz) e `env/` é único**

Run: `diff -rq servico-feito docs/arquitetura-antiga/servico-feito -x .git -x build -x .gradle -x .idea -x .kotlin 2>&1 | head -30`
Expected: sem diferenças relevantes (as duas cópias Kotlin são a mesma). Se `servico-feito/` da raiz tiver algo que `docs/arquitetura-antiga/` não tem, mover para lá antes de apagar. Anotar.

- [ ] **Step 2: Apagar as pastas soltas**

Run: `rm -rf servico-feito env`
(`env/` é virtualenv Python; `servico-feito/` é cópia duplicada do Kotlin.)

- [ ] **Step 3: Limpar a cópia de referência**

Run: `rm -rf docs/arquitetura-antiga/servico-feito/.git docs/arquitetura-antiga/servico-feito/build docs/arquitetura-antiga/servico-feito/.gradle docs/arquitetura-antiga/servico-feito/.idea docs/arquitetura-antiga/servico-feito/.kotlin docs/arquitetura-antiga/servico-feito/app/build`
Expected: resta o fonte (`app/src/`), `README.md`, `supabase/functions/efi-webhook/`, `.env.example` (com placeholders), `cleanup.sql`.

- [ ] **Step 4: Confirmar `.gitignore`**

`grep -E '/(env|servico-feito)/|/docs/arquitetura-antiga/' .gitignore` deve casar as 3 linhas (já adicionadas na Fundação). `git status --ignored --porcelain | grep -E 'arquitetura-antiga|^!! (env|servico-feito)'` confirma que estão ignoradas.

- [ ] **Step 5: Commit**

```bash
git add -A .gitignore docs/
git commit -m "chore: remove cópias Kotlin soltas; enxuga docs/arquitetura-antiga"
```

(As pastas `servico-feito/` e `env/` da raiz já eram git-ignored, então só o `.gitignore`/`docs` mudam de fato no índice — o `rm -rf` some do working tree.)

---

## Task 16: Job `mobile` no CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: o workflow da Fundação.
- Produces: job `mobile` (paralelo ao `db`) que roda `tsc --noEmit`, `jest` e `eslint` do app.

- [ ] **Step 1: Adicionar o job ao `.github/workflows/ci.yml`**

```yaml
  mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Typecheck
        run: pnpm --filter @servico-feito/mobile exec tsc --noEmit
      - name: Testes (Jest)
        run: pnpm --filter @servico-feito/mobile test -- --ci
      - name: Lint
        run: pnpm --filter @servico-feito/mobile lint
```

(Não roda `expo export` no CI — sem device, e o `tsc` já cobre resolução de rotas via `.expo/types` commitado? Não: `.expo/` é git-ignored. Se o `tsc` do CI falhar por falta de `.expo/types/router.d.ts`, adicionar um passo `pnpm --filter @servico-feito/mobile exec expo customize` NÃO — em vez disso `pnpm --filter @servico-feito/mobile exec expo export --platform web --output-dir /tmp/x` antes do typecheck, só para gerar os tipos. Anotar a decisão no relatório do implementer.)

- [ ] **Step 2: Validar o YAML**

Run: `pnpm -w exec node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); if(!y.includes('@servico-feito/mobile')||!y.match(/^\s+mobile:/m)) process.exit(1); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Rodar a sequência do job mobile localmente**

Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit && pnpm --filter @servico-feito/mobile test -- --ci && pnpm --filter @servico-feito/mobile lint`
Expected: os 3 verdes.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: job mobile (typecheck, jest, lint)"
```

---

## Self-Review

**1. Cobertura da spec:**

- Seção 4 (`apps/mobile/`): Task 1 (scaffold), estrutura `src/features` + `src/shared` nas Tasks 4–13. Consolidação Kotlin / remoção `env/`: Task 15. Coberto.
- Seção 8 (stores): `authStore` (Task 6), `uiModeStore` (Task 7), `queryClient` (Task 8). Repositories/hooks genéricos são explicitamente Plano 3 — fora de escopo, declarado no header. Coberto no que cabe ao shell.
- Seção 9 (auth + navegação): `supabaseClient` + `SecureStoreAdapter` (Tasks 4–5), fluxos `signUp`/`signInWithPassword`/`resetPasswordForEmail`/`signOut` (Tasks 10, 12), rotas `app/_layout` + `(auth)` + `(app)` + `(tabs)` com guardas por sessão e gate de `completar-perfil` (Tasks 9, 11, 12), toggle de modo remontando as tabs (Task 12), `app.json` scheme `servicofeito` (Task 1). Coberto.
- Seção 13 (portabilidade visual): tokens no `tailwind.config.js` + `tokens.ts` (Task 2). Layout de telas do Kotlin como referência — as telas reais são Plano 3+; aqui só shell/stub. Coberto no escopo.
- Global Constraints: Node 20/pnpm 9, TS strict + `tsc --noEmit` gate, Expo Router "app/ só importa screen", token em secure-store, `EXPO_PUBLIC_*`, conta unificada (modo em `uiModeStore`, sem tela de papel), scheme `servicofeito`, teste obrigatório de store/hook/adapter — todos aplicados e verificados por task.
- Seção 10–12 (pagamento, erros de Edge Function, testes de app além do shell): fora de escopo — Planos 5/6 e as features dos Planos 3–4.

**2. Varredura de placeholders:** sem "TBD"/"TODO" de plano. Onde telas repetem estrutura (`RegistrarScreen`/`RedefinirSenhaScreen` na Task 10; os 5 stubs e os 6 arquivos de rota na Task 12) o plano dá o modelo completo de um e descreve exatamente o que muda nos outros (texto, hook, import) — não "similar a X" vago. `LoginScreen`/`CompletarPerfilScreen`/`Botao`/`ErroEstado` têm código completo. O comentário sobre `.expo/types` no tsconfig (Task 1 Step 11 / Task 14 Step 3 / Task 16 Step 1) é uma contingência real de ambiente com a ação exata, não um vago "ajustar depois".

**3. Consistência de tipos/nomes:**

- `secureStoreAdapter` — assinatura `{ getItem, setItem, removeItem }` idêntica na Task 4 e no consumo da Task 5.
- `supabase` (singleton) — mesmo nome/local (`@/shared/api/supabaseClient`) nas Tasks 5, 6, 9, 10, 11.
- `useAuthStore` — estado `{ session, usuarioId, carregando }` + ações `hidratar`/`definirSessao`/`sair`/`iniciarListenerAuth` idênticos entre Task 6 (definição) e Tasks 9, 12 (uso).
- `useUiModeStore` — `{ modo, carregado }` + `carregar`/`definirModo`/`alternar`; `Modo = "contratar" | "prestar"`; consistente Tasks 7, 9, 12.
- `queryClient` / `limparCacheQuery` / `notificarErroGlobal` — Task 8 define, Tasks 9, 11, 12 usam com o mesmo nome.
- `usePerfilAtual` → `PerfilAtual { id, nome, telefone, cidade }` (nullable) — Task 9 define, Task 9 `(app)/_layout` e Task 12 `PerfilScreen` consomem os mesmos campos.
- `useSignIn`/`useSignUp` recebem `CredenciaisLogin { email, senha }`; `useResetPassword` recebe `string` (email); `useCompletarPerfil` recebe `DadosPerfil { nome, telefone, cidade }` — consistente entre hook e tela.
- `traduzErroAuth(erro: unknown): string` — Task 10 define em `auth.types.ts`, usado pelos 3 hooks de auth.
- `Botao({ titulo, onPress, carregando?, desabilitado?, variante? })` — Task 13 define, refactor na mesma task aplica em 5 telas com as props certas.
- Nomes de tabela nos hooks (`"usuarios"`) batem com o esquema do Plano 1; colunas `nome/telefone/cidade/id` existem em `public.usuarios` (Plano 1 Task 6).

Nenhuma inconsistência pendente.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-09-plano-2-shell-do-app.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
