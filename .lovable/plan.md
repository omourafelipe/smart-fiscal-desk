## Causa raiz

Em `src/lib/data-access/SyncManager.ts`, o método `syncAll` envolve TODO o push + pull em um `Promise.race` com **timeout global de 30 segundos** (linha 30).

A função `fetchAllFromCloud` já está paginada corretamente (`.range(0,999)`, depois `.range(1000,1999)`, …), mas em um dispositivo novo o usuário precisa baixar centenas/milhares de NFs em sequência. Quando o total ultrapassa ~1000 registros, a segunda página ainda está em trânsito quando os 30 s expiram. O timeout aborta o `pullCloudToLocal` no meio, mas as 1000 primeiras notas (já gravadas via `bulkPut` antes do erro) permanecem no Dexie. Resultado: o usuário vê exatamente 1000 notas e a sincronização nunca mais é refeita automaticamente.

Secundariamente, mesmo se o timeout fosse maior, a UX fica ruim sem feedback de progresso.

## Mudanças propostas

**1. `src/lib/data-access/SyncManager.ts`**
- Remover o `Promise.race` com timeout global de 30 s em `syncAll`. Manter apenas o tratamento de erro `try/catch` que já existe.
- Em `fetchAllFromCloud`: adicionar um callback opcional `onProgress(count)` para emitir progresso a cada página baixada (1000 em 1000).
- Em `pullCloudToLocal`: ao baixar `nfse_documents` e `nfse_documents_tomadas`, atualizar o toast de loading com o progresso (`"Baixando notas… 2000/?"`).
- Aumentar o batch de upsert no push de 100 → 500 para acelerar dispositivos com muitas notas (mantém payload seguro <5 MB).
- Após o pull completo, comparar `count` no Supabase vs. `db.notas.count()` local e, se divergente, logar warning no console (defesa em profundidade).

**2. (Opcional, sem mudança de schema)** Verificar se há índices adequados em `nfse_documents(group_id, id)` / `nfse_documents_tomadas(group_id, id)` para paginação eficiente. Se não houver, sinalizar ao usuário — mas **não** alterar schema neste plano.

## Validação
- Login em dispositivo novo com >1000 NFs na nuvem → todas devem aparecer no Dashboard.
- Toast mostra progresso "Baixando notas… N/?".
- `db.notas.count()` no console iguala o total na tabela `nfse_documents` para o `group_id` ativo.

## Não faz parte deste plano
- Alterações de UI fora do toast.
- Mudanças em lógica de parsing/dashboard.
- Mudanças de schema/RLS.
