Objetivo: fazer a página `/tomados` voltar a carregar normalmente após o upload do ZIP e garantir que o processamento das notas tomadas finalize sem derrubar a rota.

1. Corrigir a quebra de importação
- Ajustar o módulo `src/lib/category-utils.ts` para garantir que o export `classificarServicoLocal` esteja disponível de forma consistente para todas as rotas que o importam.
- Revisar os imports relacionados em `/tomados` e `/categorias` para evitar incompatibilidade entre export nomeado e consumo do bundle.

2. Validar o fluxo do `/tomados`
- Revisar o processamento do upload em `src/routes/tomados.tsx`, especialmente o trecho que lê ZIP/XML e chama a classificação por categoria.
- Confirmar que a rota continua renderizando mesmo quando nenhum XML elegível é encontrado, exibindo aviso ao usuário sem cair na tela de erro.

3. Verificar efeitos colaterais na renderização
- Conferir se a correção elimina o erro de carregamento da página e também estabiliza a hidratação/layout dessa rota.
- Manter o comportamento atual do dashboard e dos filtros, alterando apenas o que estiver causando a falha.

4. Validar no preview
- Reabrir `/tomados` e confirmar que a tela carrega.
- Validar o cenário de upload para garantir que o erro não reaparece ao final do processamento.

Detalhes técnicos
- O sinal mais forte no momento é este erro de runtime: `The requested module '/src/lib/category-utils.ts' does not provide an export named 'classificarServicoLocal'`.
- Isso indica falha de módulo ES em tempo de execução: a rota quebra antes ou durante a re-renderização após o upload.
- A correção deve ficar restrita aos arquivos de classificação/rota afetados, sem mexer na lógica fiscal além do necessário para restaurar o fluxo.