# Arquitetura — ServicoFeitoMobile

> Documentação técnica de referência para desenvolvimento assistido por IA (Claude Code).
> Define a arquitetura, organização de código e convenções do app mobile do "Serviço Feito".

---

## 1. Decisões de Arquitetura

| Decisão | Valor |
|---|---|
| Framework | React Native |
| Toolchain | Expo (managed workflow) |
| Linguagem | TypeScript |
| Organização de código | Feature-based (espelha os módulos da API) |
| Navegação | Expo Router (file-based routing) |
| Estado de dados de servidor | TanStack Query (React Query) |
| Estado de cliente | Zustand |
| Cliente HTTP | Tipado, gerado a partir do OpenAPI da `ServicoFeitoApi` |
| Componentes visuais | Atomic Design, dentro de `shared/components` |
| Armazenamento seguro (token) | `expo-secure-store` |
| Debug/build local | Expo Orbit (ferramenta de workflow, não altera a arquitetura) |

---

## 2. Estrutura do Projeto

```
ServicoFeitoMobile/
├── app/                              → rotas (Expo Router)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── registrar.tsx
│   ├── (tabs)/
│   │   ├── pedidos/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx
│   │   ├── buscar.tsx
│   │   └── perfil.tsx
│   └── _layout.tsx
│
├── src/
│   ├── features/
│   │   ├── pedidos/
│   │   │   ├── screens/
│   │   │   │   ├── PedidosListScreen.tsx
│   │   │   │   └── PedidoDetailScreen.tsx
│   │   │   ├── components/
│   │   │   │   └── PedidoCard.tsx
│   │   │   ├── hooks/
│   │   │   │   └── usePedidos.ts
│   │   │   ├── services/
│   │   │   │   └── pedidosApi.ts
│   │   │   └── types/
│   │   │       └── pedido.types.ts
│   │   ├── usuarios/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types/
│   │   ├── pagamentos/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types/
│   │   └── avaliacoes/
│   │       ├── screens/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/
│   │       └── types/
│   │
│   └── shared/
│       ├── api/
│       │   ├── client.ts             → instância do cliente HTTP (baseURL, token)
│       │   └── generated/            → tipos gerados a partir do OpenAPI
│       ├── components/               → Atomic Design
│       │   ├── atoms/
│       │   ├── molecules/
│       │   └── organisms/
│       ├── store/
│       │   └── authStore.ts          → usuário logado, token, role
│       └── hooks/
│
├── app.json
├── eas.json
└── tsconfig.json
```

### 2.1 Regra de separação `app/` vs `src/`

- `app/` contém **apenas rotas** (exigência do Expo Router). Cada arquivo em `app/` importa e renderiza uma screen de `src/features/{modulo}/screens`.
- `src/features/` contém a lógica de cada módulo de negócio (screens, componentes, hooks, chamadas de API, tipos).
- `src/shared/` contém tudo que é transversal a mais de um módulo (cliente HTTP, componentes de UI reutilizáveis, estado de autenticação).

```typescript
// app/(tabs)/pedidos/index.tsx
import { PedidosListScreen } from '@/features/pedidos/screens/PedidosListScreen';

export default function PedidosRoute() {
  return <PedidosListScreen />;
}
```

---

## 3. Módulo de Feature — exemplo (Pedidos)

```typescript
// src/features/pedidos/types/pedido.types.ts
export interface Pedido {
  id: string;
  status: 'AguardandoPagamentoInicial' | 'Contratado' | 'EmExecucao' | 'Concluido' | 'Cancelado';
  valorTotal: number;
  prestadorId: string;
  clienteId: string;
}
```

```typescript
// src/features/pedidos/services/pedidosApi.ts
import { apiClient } from '@/shared/api/client';
import type { Pedido } from '../types/pedido.types';

export const pedidosApi = {
  listar: () => apiClient.get<Pedido[]>('/api/v1/pedidos'),
  obterPorId: (id: string) => apiClient.get<Pedido>(`/api/v1/pedidos/${id}`),
  criar: (dto: { prestadorId: string; valorTotal: number }) =>
    apiClient.post<Pedido>('/api/v1/pedidos', dto),
  confirmarExecucao: (id: string) =>
    apiClient.put(`/api/v1/pedidos/${id}/confirmar-execucao`),
};
```

```typescript
// src/features/pedidos/hooks/usePedidos.ts
import { useQuery } from '@tanstack/react-query';
import { pedidosApi } from '../services/pedidosApi';

export function usePedidos() {
  return useQuery({
    queryKey: ['pedidos'],
    queryFn: () => pedidosApi.listar(),
  });
}
```

```typescript
// src/features/pedidos/screens/PedidosListScreen.tsx
import { View, FlatList } from 'react-native';
import { usePedidos } from '../hooks/usePedidos';
import { PedidoCard } from '../components/PedidoCard';

export function PedidosListScreen() {
  const { data: pedidos, isLoading } = usePedidos();

  if (isLoading) return null; // tratar loading com componente próprio

  return (
    <View>
      <FlatList
        data={pedidos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PedidoCard pedido={item} />}
      />
    </View>
  );
}
```

Regra: screens não chamam `apiClient` diretamente — sempre via hook (`usePedidos`), que por sua vez usa o `service` (`pedidosApi`).

---

## 4. Camada de Dados de Servidor — TanStack Query

- Toda leitura/escrita de dado vindo da API passa por hook baseado em `useQuery`/`useMutation`.
- Cache, loading, erro e revalidação são gerenciados pela lib — não implementar manualmente com `useState`/`useEffect`.

```typescript
// src/features/pedidos/hooks/useCriarPedido.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pedidosApi } from '../services/pedidosApi';

export function useCriarPedido() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pedidosApi.criar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    },
  });
}
```

---

## 5. Estado de Cliente — Zustand

Reservado para estado que **não vem do servidor**: sessão do usuário, token, role, preferências locais.

```typescript
// src/shared/store/authStore.ts
import { create } from 'zustand';

interface AuthState {
  token: string | null;
  role: 'Cliente' | 'Prestador' | 'Admin' | null;
  setAuth: (token: string, role: AuthState['role']) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  role: null,
  setAuth: (token, role) => set({ token, role }),
  logout: () => set({ token: null, role: null }),
}));
```

Regra: dado que vem da API vive no TanStack Query. Estado de sessão/UI local vive no Zustand. Não duplicar dado de servidor dentro do Zustand.

---

## 6. Cliente HTTP e DTOs (Tipos Gerados)

```typescript
// src/shared/api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/shared/store/authStore';

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

- Os DTOs de request/response (o contrato HTTP) são os tipos em `src/shared/api/generated/`, gerados a partir do OpenAPI exposto pela `ServicoFeitoApi` (via `openapi-typescript` ou similar) — refletem `...Dto`/`...ResponseDto` como definidos na API. Não escrever manualmente o DTO de um endpoint que já existe no contrato.
- DTO (contrato da API) é diferente do tipo de domínio em `features/{modulo}/types/*.types.ts` (usado dentro do módulo/UI): o `service` (`pedidosApi.ts`) fala com a API usando o DTO gerado; se o módulo precisar de um formato próprio para a tela, a conversão DTO → tipo de domínio acontece no `service`, não na screen.
- `EXPO_PUBLIC_API_URL` fica em variável de ambiente (`.env`), nunca hardcoded — facilita trocar de ambiente (dev local, produção) sem alterar código.

---

## 7. Autenticação e Rotas Protegidas

- Token JWT retornado pela API é armazenado via `expo-secure-store` (nunca `AsyncStorage` puro).
- `authStore` (Zustand) mantém o token e a role em memória durante a sessão do app, sincronizado com o secure storage na inicialização.
- Grupos de rota do Expo Router redirecionam conforme autenticação/role:

```typescript
// app/_layout.tsx (simplificado)
export default function RootLayout() {
  const { token } = useAuthStore();

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Slot />;
}
```

- Telas exclusivas de um papel (ex.: painel do prestador) ficam em grupo de rota próprio, com verificação de `role` no layout do grupo antes de renderizar.
- Toda validação de permissão real (o que o usuário pode ou não fazer sobre um recurso) é responsabilidade da API — o controle de rota no mobile é proteção de UX, não de segurança.

---

## 8. Componentes Visuais — Atomic Design

Aplicado dentro de `src/shared/components`, para elementos reutilizáveis entre módulos:

```
shared/components/
├── atoms/        → Button, Input, Text, Badge
├── molecules/     → SearchBar, StatusTag
└── organisms/      → PedidoCard (se usado em mais de uma feature), ProfileHeader
```

Componentes específicos de um único módulo (ex.: `PedidoCard` usado só em Pedidos) ficam em `features/pedidos/components`, não em `shared`. Só sobe para `shared/components` quando reutilizado por mais de uma feature.

---

## 9. Convenções de Nomenclatura

| Elemento | Convenção |
|---|---|
| Pastas de feature | Nome do domínio, minúsculo, plural — `pedidos`, `usuarios` |
| Screens | Sufixo `Screen` — `PedidosListScreen`, `PedidoDetailScreen` |
| Hooks de dado | Prefixo `use`, nome do recurso — `usePedidos`, `useCriarPedido` |
| Services de API | Sufixo `Api` — `pedidosApi` |
| Tipos de domínio | Sufixo `.types.ts` no arquivo, interface com nome direto — `Pedido`, `Prestador` |
| DTOs (request/response) | Gerados em `shared/api/generated/` a partir do OpenAPI da API — nome conforme o contrato (`...Dto`/`...ResponseDto`), nunca escrito à mão |
| Rotas (Expo Router) | Arquivo reflete a URL — `app/(tabs)/pedidos/[id].tsx` |
| Store (Zustand) | Sufixo `Store` — `authStore` |
| Variáveis de ambiente | Prefixo `EXPO_PUBLIC_` quando acessadas no client — `EXPO_PUBLIC_API_URL` |

---

## 10. Testes

- **Ferramenta:** Jest com preset `jest-expo` (padrão do Expo) + `@testing-library/react-native`
  para o que precisar renderizar.
- **Prioridade obrigatória:** hook (`useXxx`) e service (`xxxApi`) de cada feature —
  é onde vive a lógica testável isolada de UI, equivalente ao `Application.Tests` do
  backend. Mock do `apiClient`/DTO gerado (`shared/api/generated`), nunca chamada real
  à API.
- Teste de screen é opcional — só quando a tela tem lógica condicional própria (branch,
  cálculo, validação), não quando é só composição de hook + JSX.
- Hook ou service novo/alterado sem teste correspondente não é considerado pronto.

---

## 11. Regras Gerais para Geração de Código

1. Rotas em `app/` só importam e renderizam screens de `src/features` — nunca contêm lógica.
2. Screens nunca chamam `apiClient` diretamente — sempre via hook, que usa o `service` do módulo.
3. Dado vindo da API sempre via TanStack Query — nunca `useState`/`useEffect` manual para chamada HTTP.
4. Estado de sessão/local sempre via Zustand — nunca duplicar dado de servidor aqui.
5. Novo módulo de negócio segue a mesma estrutura de pastas (`screens`, `components`, `hooks`, `services`, `types`) espelhando o módulo correspondente da API.
6. Componente só sobe para `shared/components` quando usado por mais de uma feature.
7. Token sempre em `expo-secure-store`, nunca em `AsyncStorage` puro.
8. Toda URL/segredo de ambiente via variável de ambiente (`EXPO_PUBLIC_*`), nunca hardcoded.
9. Controle de rota por role no mobile é proteção de UX — a validação de permissão real é sempre responsabilidade da API.
10. DTO de request/response é o gerado em `shared/api/generated/` a partir do OpenAPI — nunca escrever à mão nem usar o tipo de domínio (`types/*.types.ts`) como se fosse o contrato da API.
11. Hook ou service novo/alterado sem teste unitário correspondente (Jest) não é considerado pronto.
