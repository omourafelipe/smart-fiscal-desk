# Ajustes no Dashboard de NFS-e Recebidas

## 1. Tabela "NFS-e Recebidas de Fornecedores"
- **Remover** a coluna **Tomador** (cabeçalho ~linha 3494 + célula ~linha 3526).
- **Adicionar** a coluna **Vlr. ISS** entre "Vlr. Líquido" e "ISS Retido?", exibindo `n.vlrIssRet` quando `issRetido === "Sim"`, `—` caso contrário (mesmo padrão das demais retenções).
- `colSpan` da linha vazia continua 14 (uma removida, uma adicionada).

## 2. Regra de "ISS Retido"
Em `src/lib/parseXml.ts`, função `getIssRetido()`:
- Retornar `"Sim"` **apenas** quando `tpRetISSQN ∈ {"1", "3"}`:
  - `1` → Retenção do ISSQN
  - `3` → Retenção Simples (Simples Nacional)
- Remover o fallback heurístico atual (`vISSRet > 0 → "Sim"`) e a checagem por `RT`. Sem `tpRetISSQN` explícito = "Não".
- A regra vale tanto para `parseNfseXml` (emitidas) quanto para `parseNfseXmlTomada` (recebidas).

Consequência: notas já gravadas no IndexedDB mantêm a marcação antiga até serem reimportadas — o usuário pode usar o botão "Limpar Base" e reprocessar os ZIPs.

## 3. Gráfico "Por Tipo de Serviço" (aba Recebidas)
Substituir o agrupamento por `codTribNacional` por **categorias gerais derivadas da descrição do serviço** (`n.servico` = `xDescServ`).

Helper `categorizarServico(desc)` — match case-insensitive, primeira regra vence:

| Categoria | Palavras-chave |
|---|---|
| Saúde / Hospitalar | hospital, médic, clínic, laboratóri, exame, enfermag, fisioterap, saúde |
| Locação / Aluguel | locaç, aluguel |
| Manutenção e Reparos | manutenç, reparo, conserto, assistência técnica |
| Limpeza e Conservação | limpeza, conservaç, higieniz |
| Segurança e Vigilância | seguranç, vigilânc, portaria |
| Transporte e Logística | transporte, frete, logístic, entrega |
| Consultoria e Assessoria | consultor, assessor, advoc, jurídic, contábil, auditoria |
| Tecnologia / TI | software, sistema, informátic, licença, hospedagem, cloud, suporte técnic |
| Treinamento e Educação | treinamento, curso, capacitaç, ensino, educação |
| Publicidade e Marketing | publicidade, marketing, propaganda, mídia |
| Engenharia e Construção | engenhar, obra, construç, projeto |
| Alimentação | alimentaç, refeiç, restaurante, lanche |
| Outros | (fallback) |

Aplicar como chave em `servicoMap` (linhas ~3204-3213). Atualizar subtítulo do card para "Distribuição por categoria de serviço".

## Arquivos afetados
- `src/lib/parseXml.ts` — endurecer `getIssRetido()`.
- `src/routes/index.tsx` — tabela tomadas (cabeçalho + célula) e cálculo do gráfico de serviços.

## Fora do escopo
- Recalcular `issRetido` retroativamente nas notas já persistidas. Se quiser um botão "Recalcular ISS" que reprocessa o `raw` salvo, me diga e incluo.
