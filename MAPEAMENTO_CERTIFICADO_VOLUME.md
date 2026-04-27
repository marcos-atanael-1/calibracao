# Mapeamento da Planilha POC

Arquivo-base da POC:
`Planilhas/Copy of Certificado de Volume-CVM-VOL-001 Rev.73.xlsm`

## Visão Geral

- Aba principal de entrada: `Dados`
- Abas de resultados: `Resultados - 1` até `Resultados - 12`
- Aba final para exportação: `Certificado`
- Abas auxiliares: `Incerteza - R1..R12`, `Incerteza (Par)`, `CMC`, `Tol. 8655-2`, `Tol. 8655-3`, `Materiais`, `Unidades de medida`, `Técnicos`, `Controle dos padrões`
- O certificado final é montado por fórmulas na aba `Certificado`
- As macros principais não calculam tudo do zero; elas principalmente navegam, ocultam linhas e formatam o resultado final

## Fluxo Operacional da Planilha

1. O técnico preenche os campos editáveis na aba `Dados`
2. A planilha libera e alimenta as abas `Resultados - n` conforme quantidade de canais/seringas e pontos
3. As abas auxiliares fazem lookup, tolerância, incerteza e composição de textos
4. A macro `Formcert` formata a aba `Certificado`
5. O Excel exporta a aba `Certificado` para PDF

## Abas Relevantes

| Aba | Papel |
|---|---|
| `Dados` | Entrada principal do formulário |
| `Resultados - 1..12` | Registro dos pontos e medições |
| `Certificado` | Saída final para PDF |
| `Controle dos padrões` | Base de padrões e lookups |
| `Técnicos` | Lista de técnicos |
| `Unidades de medida` | Lista e símbolos de unidade |
| `Materiais` | Lista de materiais |
| `CMC` | Referências de capacidade/metodologia |

## Campos Principais da Aba `Dados`

| Campo lógico | Célula/range | Observação |
|---|---|---|
| Empresa | `F2:I2` | Lista |
| Tipo da calibração | `N2:Q2` | Lista; influencia comportamento da planilha |
| Número do certificado | `V2:X2` | Campo usado pelo certificado final |
| Número do orçamento | `W3:X3` | Complementa identificação |
| Contratante | `F4:X4` | Texto livre |
| Endereço do contratante | `F5:X5` | Texto livre |
| Interessado | `F6:X6` | Pode ser `O mesmo` |
| Endereço do interessado | `F7:X7` | Pode ser `O mesmo` |
| Instrumento | `F9:L9` | Lista |
| Escopo | `R9:X9` | Lista; altera lógica interna |
| Fabricante | `F11:L11` | Texto |
| Modelo | `F12:L12` | Texto |
| Capacidade/faixa | `R12:X12` / `W12:X12` | Depende do tipo de instrumento |
| Identificação | `F13:L13` | Texto |
| Menor divisão | `R13:S13` | Só em alguns casos |
| Número de série | `F14:L14` | Texto |
| Método | `R14:X14` | Lista |
| Quantidade de canais/seringas | `R15:S15` | Inteiro |
| Pontos por canal | `W15:X15` | Inteiro; controla estrutura dos resultados |
| Local da calibração | `R16:X16` | Lista |
| Data da calibração | `F18:G18` | Data |
| Data da emissão | `K18:L18` | Data |
| Próxima calibração | `P18:R18` | Data |
| Técnico | `V18:X18` | Lista |
| Padrão de temperatura | `F21:G21` | Lista |
| Padrão de umidade | `N21:O21` | Lista |
| Padrão de pressão | `V21:W21` | Lista |
| Temperatura inicial/final | `F22:G22`, `F23:G23` | Numérico |
| Umidade inicial/final | `N22:O22`, `N23:O23` | Numérico |
| Pressão inicial/final | `V22:W22`, `V23:W23` | Numérico |
| Observações gerais | `B27:X28` | Texto livre |

## Listas Suspensas Detectadas

| Range | Origem |
|---|---|
| `N2:Q2` | Tipo de calibração |
| `F9` | Instrumento |
| `R9:X9` | Escopo |
| `F15:L15` | Tipo de indicação |
| `W12:X12` | Unidade |
| `F16:L16` | Material |
| `R14:X14` | Método |
| `R15:S15` | Qtde de canais/seringas |
| `W15:X15` | Pontos por canal |
| `R16:X16` | Local da calibração |
| `F21:G21` | Padrão de temperatura |
| `N21:O21` | Padrão de umidade |
| `V21:W21` | Padrão de pressão |

## Estrutura da Aba `Resultados - n`

- A aba `Resultados - 1` é o molde das demais
- `A2` indica o índice da aba de resultado
- `AA1` aponta para a próxima aba ou para `Certificado`
- `AB1` aponta para a aba anterior
- `AC1` aponta para a aba de incerteza correspondente
- `CI2` deriva da quantidade de canais/seringas e controla até onde o fluxo vai

### Campos operacionais relevantes

| Campo | Célula | Observação |
|---|---|---|
| Porta COM | `S14` | Usada pelas macros de captura |
| Status de conexão | `S15` | `Conectado`, `Desconectado` etc. |
| Leitura instantânea | `Q7` | Preenchida por macro serial |
| Identificação canal/seringa | `G4:I4` | Entrada |
| Faixa/observação | `S4:T4`, `S7:T7` | Seleções auxiliares |

### Blocos de medição

Os blocos repetem a cada 21 linhas, começando nas linhas:

- `17`
- `38`
- `59`
- `80`
- `101`
- `122`
- `143`

Cada bloco contém:

- padrão utilizado
- configuração de ponto
- massa aparente / medições
- erro + incerteza
- resultados calculados por fórmula

As macros de captura serial gravam nas células `I...` desses blocos.

## Aba `Certificado`

- Não deve receber preenchimento direto pelo worker
- É uma aba derivada por fórmulas
- Print area detectada: `A1:V256`
- A macro `Formcert` oculta linhas com base na coluna `W` para montar o layout final

### Exemplos de vínculo

| Célula em `Certificado` | Origem |
|---|---|
| `O7` | `Dados!V2` + `Dados!W2` |
| `G11` | `Dados!F4` |
| `G12` | `Dados!F5` |
| `G16` | `Dados!F9` |
| `G17` | `Dados!F11` |
| `G18` | `Dados!F12` |
| `G19` | `Dados!F13` |
| `G20` | `Dados!F14` |
| `G22` | `Dados!F18` |
| `G24` | `Dados!K18` |
| `G25` | `Dados!R16` ou local derivado |
| `A83` | `Dados!V18` |

## Macros VBA Encontradas

### Navegação e formatação

- `Formcert`
- `Formori`
- `FormResult`
- `Próximo`
- `Anterior`
- `Incerteza`
- `Certif`
- `Dados`
- `FormOriResul`
- `QuebrarVínculos`

### Captura serial

- `connect`
- `disconnect`
- `catchT`
- `catch1` até `catch10`
- `catch2_1` até `catch7_10`

Essas macros capturam dados pela porta serial e gravam leituras nas células `I...` dos blocos de resultado.

### Teste/preenchimento auxiliar

- `copy1` até `copy7`

Essas macros geram valores de teste para alguns blocos.

## Diretrizes Para o Worker

- Abrir o arquivo `.xlsm` preservando macros
- Preencher a aba `Dados`, não a primeira aba do workbook
- Não escrever diretamente na aba `Certificado`
- Recalcular o workbook após o preenchimento
- Rodar a macro `Formcert` antes da exportação, se disponível
- Exportar apenas a aba `Certificado`
- Matar processos `EXCEL.EXE` órfãos antes de iniciar uma nova execução

## Observações Para Modelagem no Sistema

- O campo `excel_cell_ref` precisa aceitar referências qualificadas por aba, por exemplo `Dados!F2`
- Para esta POC, o template deve ter pelo menos:
  - `input_sheet = Dados`
  - `output_sheet = Certificado`
  - `post_fill_macros = ["Formcert"]`
- O preenchimento dos blocos `Resultados - n` vai precisar de uma camada própria de mapeamento, diferente do modelo genérico de `B/C/D/E + row_ref`
