# Arquitetura da Solucao

Este desenho usa o nome **Agente** no lugar de `worker` ou `RPA`.

## Visao Geral

```mermaid
flowchart LR
    U[Usuario<br/>Tecnico Admin Super Admin]

    subgraph FE[Frontend Web - React + Vite]
        UI[Dashboard<br/>Certificados<br/>Agente<br/>Templates<br/>Configuracoes<br/>Notificacoes]
    end

    subgraph BE[Backend API - FastAPI]
        AUTH[Auth e Perfis]
        CERT[Certificados]
        TPL[Templates]
        CFG[Configuracoes]
        QUEUE[Fila de Processamento]
        NOTI[Notificacoes]
        PDF[Upload e Download de PDF]
    end

    subgraph DB[PostgreSQL]
        USERS[users]
        CERTDB[certificates]
        POINTS[certificate_points]
        QDB[processing_queue]
        TEMPDB[templates<br/>template_fields]
        SETDB[settings<br/>instrument_types]
        NDB[notifications]
    end

    subgraph AG[Agente de Processamento - Windows + Excel]
        POLL[Busca item na fila]
        LOAD[Carrega certificado e template]
        EXCEL[Preenche Excel<br/>executa macros<br/>gera PDF]
        SEND[Envia PDF para API]
    end

    subgraph FILES[Arquivos e Artefatos]
        XLSM[Templates Excel .xlsm]
        PRESETS[Preset de mapeamento<br/>template_presets]
        STORAGE[Storage de PDFs]
    end

    U --> UI
    UI <--> AUTH
    UI <--> CERT
    UI <--> TPL
    UI <--> CFG
    UI <--> QUEUE
    UI <--> NOTI

    AUTH <--> USERS
    CERT <--> CERTDB
    CERT <--> POINTS
    CERT <--> TEMPDB
    TPL <--> TEMPDB
    CFG <--> SETDB
    QUEUE <--> QDB
    NOTI <--> NDB
    PDF <--> STORAGE

    AG <--> QDB
    AG <--> CERTDB
    AG <--> POINTS
    AG <--> TEMPDB
    AG <--> XLSM
    AG <--> PRESETS
    AG --> SEND
    SEND --> PDF
```

## Fluxo Principal

```mermaid
sequenceDiagram
    participant Usuario
    participant Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant Agente
    participant Excel
    participant Storage as Storage PDFs

    Usuario->>Frontend: Preenche formulario do certificado
    Frontend->>API: POST/PUT certificado
    API->>DB: Salva certificado, pontos e metadados

    Usuario->>Frontend: Enviar para processamento
    Frontend->>API: POST /certificates/{id}/queue
    API->>DB: Cria item em processing_queue

    Agente->>DB: Busca proximo item pendente
    DB-->>Agente: certificate_id e queue_id

    Agente->>DB: Carrega certificado, pontos e template
    DB-->>Agente: Dados completos

    Agente->>Excel: Abre template .xlsm
    Agente->>Excel: Atualiza vinculos e aguarda calculos
    Agente->>Excel: Preenche aba Dados
    Agente->>Excel: Navega para Resultados
    Agente->>Excel: Preenche pontos e executa macros
    Agente->>Excel: Gera PDF final

    Agente->>API: Upload do PDF gerado
    API->>Storage: Salva arquivo
    API->>DB: Atualiza status e cria notificacao

    Frontend->>API: Consulta lista, fila e notificacoes
    API->>DB: Leitura dos dados atualizados
    DB-->>API: Status final e PDF disponivel
    API-->>Frontend: Resposta
    Frontend-->>Usuario: Certificado concluido
```

## Fluxo Simplificado

Um jeito mais leve de explicar a solucao para usuarios nao tecnicos:

```mermaid
flowchart LR
    A[Usuario preenche<br/>os dados no sistema]
    B[Sistema organiza<br/>e valida as informacoes]
    C[Agente prepara<br/>o certificado no Excel]
    D[Sistema gera<br/>o PDF final]
    E[Usuario acompanha<br/>o status e baixa o arquivo]

    A --> B --> C --> D --> E
```

### Como contar essa historia

1. O usuario preenche os dados do certificado em um formulario simples no sistema.
2. O sistema organiza essas informacoes e envia tudo para o Agente.
3. O Agente abre o modelo oficial do certificado e faz o preenchimento automaticamente.
4. O certificado e montado em PDF, pronto para consulta e download.
5. O usuario acompanha tudo pela tela, incluindo fila, notificacoes e resultado final.

## Versao Bem Ludica

Se quiser apresentar de forma ainda mais amigavel, pode usar esta leitura:

- **Pessoa**: informa os dados da calibracao no sistema.
- **Sistema**: junta, organiza e encaminha tudo.
- **Agente**: atua nos bastidores preparando o certificado automaticamente.
- **Resultado**: o PDF fica pronto e volta para a plataforma.
- **Acompanhamento**: o usuario recebe retorno visual do andamento e do documento final.

## Camadas

- **Frontend Web**: interface usada pelos perfis do sistema para cadastrar, acompanhar fila, baixar PDF e consultar notificacoes.
- **Backend API**: concentra autenticacao, regras de negocio, controle de acesso, fila, templates, configuracoes e persistencia.
- **Banco PostgreSQL**: guarda usuarios, certificados, pontos, fila, templates, configuracoes, instrumentos e notificacoes.
- **Agente**: processo Python executado em maquina Windows com Excel instalado, responsavel por transformar os dados do sistema em certificado PDF.
- **Excel e Templates**: planilhas `.xlsm` com macros e regras metrologicas usadas pelo Agente.
- **Storage de PDFs**: destino final dos certificados gerados para download no sistema.

## Nome sugerido para apresentar

Se quiser apresentar isso de forma mais comercial, eu sugiro este nome para o bloco do processamento:

- **Agente Inteligente de Emissao de Certificados**

Ou, mais curto:

- **Agente de Processamento**
