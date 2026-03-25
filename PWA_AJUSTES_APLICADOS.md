# Ajustes PWA aplicados

## O que foi alinhado

- Removido o registro duplicado do Service Worker no `App.tsx`
- Centralizado o registro do Service Worker em `client/src/lib/pwa-register.ts`
- `main.tsx` agora usa somente o registrador central
- `push.ts` passa a reutilizar o registrador central, evitando nova lógica paralela de registro
- Mantido o fluxo de UX do PWA com `beforeinstallprompt`, botão interno de instalação e orientação ao usuário
- Mantidos `manifest.json`, `sw.js`, backend, banco, uploads, S3, Drizzle e restante da estrutura sem alterações funcionais

## Arquivos alterados

- `client/src/main.tsx`
- `client/src/App.tsx`
- `client/src/lib/pwa-register.ts`
- `client/src/lib/push.ts`

## Objetivo

Deixar o PWA com um único ponto de verdade para o ciclo do Service Worker, evitando conflito de registro, mantendo push e instalação do app sem quebrar o restante do sistema.
