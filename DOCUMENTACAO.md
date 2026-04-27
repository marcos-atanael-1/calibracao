# Documentação Técnica — Sistema de Certificados de Calibração

> **Projeto Elus** — Sistema web para substituir planilhas Excel com macros na geração de certificados de calibração.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Estrutura de Pastas](#3-estrutura-de-pastas)
4. [Backend (FastAPI)](#4-backend-fastapi)
5. [Frontend (React)](#5-frontend-react)
6. [Worker RPA](#6-worker-rpa)
7. [Banco de Dados](#7-banco-de-dados)
8. [Fluxo Completo](#8-fluxo-completo)
9. [Como o Mapeamento Excel Funciona](#9-como-o-mapeamento-excel-funciona)
10. [API — Endpoints](#10-api--endpoints)
11. [Como Rodar o Projeto](#11-como-rodar-o-projeto)
12. [O Que Falta Implementar](#12-o-que-falta-implementar)
13. [Decisões Técnicas](#13-decisões-técnicas)

---

## 1. Visão Geral

### O Problema
Hoje os certificados de calibração são gerados manualmente:
1. Técnico preenche dados em uma planilha Excel com macros
2. Macros fazem os cálculos de erro/incerteza
3. Planilha é exportada manualmente para PDF

### A Solução
Um sistema web com 3 componentes:
- **Frontend** → Interface web para preenchimento dos dados
- **Backend** → API REST que gerencia dados e lógica de negócio
- **Worker RPA** → Processo que automatiza o preenchimento do Excel e geração do PDF

### Fluxo Resumido
```
Técnico preenche formulário no frontend
        ↓
Dados são salvos via API no PostgreSQL
        ↓
Certificado entra na fila de processamento
        ↓
Worker RPA pega da fila, abre o Excel, preenche, gera PDF
        ↓
Técnico faz download do PDF pelo frontend
```

---

## 2. Arquitetura

```
┌─────────────────┐     HTTP/REST      ┌──────────────────┐     SQL      ┌────────────┐
│                 │ ←──────────────────→ │                  │ ←──────────→ │            │
│    Frontend     │    localhost:5173    │     Backend      │              │ PostgreSQL │
│  React + Vite   │    (proxy /api →    │    FastAPI       │              │            │
│                 │     localhost:8000)  │                  │              │            │
└─────────────────┘                     └──────────────────┘              └────────────┘
                                               ↑
                                               │ HTTP polling
                                               │ (GET /queue/next)
                                        ┌──────┴──────────┐
                                        │                 │
                                        │   Worker RPA    │
                                        │ Python+win32com │
                                        │                 │
                                        └─────────────────┘
                                               │
                                               ↓
                                        ┌─────────────────┐
                                        │  Excel + PDF    │
                                        │  (via COM)      │
                                        └─────────────────┘
```

**Comunicação:**
- Frontend ↔ Backend: HTTP REST (Axios → FastAPI), frontend roda na porta 5173 com proxy para 8000
- Worker → Backend: HTTP polling a cada 5 segundos (`GET /api/v1/queue/next`)
- Backend → PostgreSQL: SQLAlchemy ORM
- Worker → Excel: win32com (COM automation, só funciona no Windows com Excel instalado)

---

## 3. Estrutura de Pastas

```
Projeto Elus/
│
├── backend/                        # API FastAPI
│   ├── .env                        # Credenciais do banco (placeholder)
│   ├── requirements.txt            # Dependências Python
│   ├── alembic.ini                 # Configuração do Alembic
│   ├── migrations/
│   │   ├── env.py                  # Alembic env (carrega models automaticamente)
│   │   ├── script.py.mako          # Template de migration
│   │   └── versions/               # Arquivos de migration gerados
│   └── app/
│       ├── main.py                 # Entrypoint — FastAPI app + auto-migration
│       ├── config.py               # Settings (lê .env via pydantic-settings)
│       ├── database.py             # Engine SQLAlchemy + SessionLocal
│       ├── dependencies.py         # get_db() para injeção de dependência
│       ├── models/                 # SQLAlchemy models (tabelas)
│       │   ├── __init__.py         # Importa todos os models
│       │   ├── user.py             # Tabela users
│       │   ├── template.py         # Tabelas templates + template_fields
│       │   ├── certificate.py      # Tabelas certificates + certificate_points
│       │   └── processing_queue.py # Tabela processing_queue
│       ├── schemas/                # Pydantic schemas (validação request/response)
│       │   ├── user.py
│       │   ├── template.py
│       │   ├── certificate.py
│       │   ├── queue.py
│       │   └── common.py           # APIResponse padrão
│       ├── services/               # Lógica de negócio
│       │   ├── template_service.py
│       │   ├── certificate_service.py
│       │   └── queue_service.py
│       ├── routers/                # Endpoints REST
│       │   ├── auth.py             # Login + JWT
│       │   ├── templates.py        # CRUD templates + fields
│       │   ├── certificates.py     # CRUD certificados + fila + PDF
│       │   └── queue.py            # Fila de processamento
│       └── utils/
│           └── security.py         # Hash senha, JWT
│
├── frontend/                       # React + Vite + Tailwind v4
│   ├── index.html
│   ├── vite.config.js              # Proxy /api → localhost:8000
│   ├── package.json
│   └── src/
│       ├── main.jsx                # Entrypoint React
│       ├── App.jsx                 # Rotas + AuthProvider
│       ├── index.css               # Tailwind v4 + design tokens (#002868)
│       ├── api/
│       │   └── client.js           # Axios com interceptors JWT
│       ├── context/
│       │   └── AuthContext.jsx     # Estado de autenticação
│       ├── components/
│       │   └── layout/
│       │       ├── AppLayout.jsx   # Sidebar + Header + <Outlet>
│       │       ├── Sidebar.jsx     # Menu lateral com navegação
│       │       └── Header.jsx      # Header com título dinâmico
│       └── pages/
│           ├── Login.jsx           # Tela de login (caixa centralizada)
│           ├── Dashboard.jsx       # Cards de estatísticas + recentes
│           ├── Certificates.jsx    # Lista de certificados + ações
│           ├── CertificateForm.jsx # Formulário dinâmico + pontos
│           ├── Templates.jsx       # Gestão de templates + campos
│           └── Queue.jsx           # Fila de processamento
│
├── worker_rpa/                     # Worker Python que automatiza Excel
│   ├── .env                        # Config do worker
│   ├── requirements.txt
│   ├── config.py                   # Lê variáveis de ambiente
│   ├── main.py                     # Loop principal (polling)
│   ├── api_client.py               # HTTP client para o backend
│   └── excel_handler.py            # Automação Excel via win32com
│
├── PDD_Calibracao.docx             # Documento de definição do processo
├── SDD_Calibracao.docx             # Documento de arquitetura técnica
└── DOCUMENTACAO.md                 # Este arquivo
```

---

## 4. Backend (FastAPI)

### 4.1 Configuração (`app/config.py`)
Usa `pydantic-settings` para carregar variáveis do `.env`:
- `DATABASE_URL` — conexão PostgreSQL
- `SECRET_KEY` — chave JWT
- `CORS_ORIGINS` — origens permitidas (frontend)
- `PDF_STORAGE_PATH` — onde salvar PDFs

### 4.2 Banco de Dados (`app/database.py`)
- SQLAlchemy 2.0 com `DeclarativeBase`
- Connection pool: `pool_size=10`, `max_overflow=20`
- `SessionLocal` para criar sessões por request

### 4.3 Auto-Migration (`app/main.py`)
**Importante:** Quando o backend inicia, ele roda automaticamente todas as migrations pendentes do Alembic:
```python
def run_migrations():
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
```
Isso significa que basta ter o banco criado e configurado no `.env` — as tabelas são criadas automaticamente.

### 4.4 Models (Tabelas)

| Model | Tabela | Descrição |
|-------|--------|-----------|
| `User` | `users` | Usuários com roles (super_admin, admin, tecnico) |
| `Template` | `templates` | Templates de calibração (referencia o Excel) |
| `TemplateField` | `template_fields` | Campos do template com `excel_cell_ref` |
| `Certificate` | `certificates` | Certificados com dados + status |
| `CertificatePoint` | `certificate_points` | Pontos de calibração (nominal, medido, erro, incerteza) |
| `ProcessingQueue` | `processing_queue` | Fila de processamento para o worker |

### 4.5 Camadas

```
Router (HTTP) → Service (Lógica) → Model (Banco)
   ↕                                    ↕
Schema (Validação)              SQLAlchemy ORM
```

- **Router**: Recebe HTTP request, valida com Schema, chama Service
- **Service**: Contém a lógica de negócio (queries, validações, regras)
- **Model**: Representação das tabelas no banco
- **Schema**: Validação de entrada (Create, Update) e formatação de saída (Response)

### 4.6 Autenticação (POC)
Na POC, o login cria automaticamente um usuário admin se o banco estiver vazio:
- **Email**: admin@calibracao.com
- **Senha**: admin123
- Usa JWT com `python-jose`
- Senha hasheada com `bcrypt`

---

## 5. Frontend (React)

### 5.1 Stack
- **React 19** + **Vite** (bundler)
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **React Router v7** (rotas)
- **Axios** (HTTP client)
- **Lucide React** (ícones)

### 5.2 Design System (`index.css`)
- **Cor primária**: `#002868` (azul navy) — usada SOMENTE em botões e elementos de ação
- **Fundo**: Branco/cinza claro (#f8f9fb, #ffffff)
- **Tipografia**: Inter (via Google Fonts) para o app, DM Sans na tela de login
- **Sombras**: 3 níveis (card, elevated, modal)
- **Animações**: fadeIn e slideIn para transições suaves

### 5.3 Páginas

| Página | Rota | O que faz |
|--------|------|-----------|
| `Login.jsx` | `/login` | Caixa de login centralizada, design clean branco |
| `Dashboard.jsx` | `/` | Cards com estatísticas + lista de certificados recentes |
| `Certificates.jsx` | `/certificates` | Tabela de certificados com busca, status badges, ações (processar, baixar PDF, excluir) |
| `CertificateForm.jsx` | `/certificates/new` | Formulário com 3 seções: template, dados fixos, campos dinâmicos do template, tabela de pontos de calibração |
| `Templates.jsx` | `/templates` | Lista de templates à esquerda, detalhes + campos à direita. Permite criar templates e adicionar campos com `excel_cell_ref` |
| `Queue.jsx` | `/queue` | Tabela da fila de processamento com status, tentativas, erros e botão de reprocessar |

### 5.4 Autenticação
- `AuthContext.jsx` gerencia estado do usuário
- Token JWT salvo no `localStorage`
- `ProtectedRoute` redireciona para `/login` se não autenticado
- Interceptor do Axios redireciona para login em 401

### 5.5 Proxy
O `vite.config.js` configura proxy de `/api` para `localhost:8000`, então o frontend nunca precisa saber a URL do backend.

---

## 6. Worker RPA

### 6.1 Como Funciona
O worker é um processo Python que roda em uma **máquina Windows com Excel instalado**. Ele:

1. **Faz polling** na API a cada 5 segundos: `GET /api/v1/queue/next`
2. Se há item pendente, a API muda o status para `processing` e retorna os dados
3. Worker **busca o certificado** completo: `GET /api/v1/certificates/{id}`
4. Worker **busca o template** com mapeamentos: `GET /api/v1/templates/{id}`
5. Worker **abre o Excel** via win32com, preenche as células, exporta PDF
6. Worker **atualiza o status**: `PATCH /api/v1/queue/{id}` → `done` ou `error`

### 6.2 Tratamento de Erros
- **Retry**: Se falha, incrementa `retry_count` (máximo 3)
- **Backoff exponencial**: Erros consecutivos aumentam o tempo de espera
- **Cleanup**: Sempre fecha Excel e mata processos órfãos
- **Logging**: Arquivo de log diário em `worker_rpa/logs/`

### 6.3 Requisitos
- Windows com Microsoft Excel instalado
- Python 3.12+ com pacote `pywin32`
- Acesso HTTP ao backend

---

## 7. Banco de Dados

### 7.1 Diagrama de Relacionamentos

```
users ──────────┐
                │ 1:N (created_by)
                ↓
templates ──→ certificates ──→ certificate_points
   │ 1:N          │ 1:N              (pontos de calibração)
   ↓              │
template_fields   │ 1:1
   (mapeamento    ↓
    campo→célula) processing_queue
                  (fila de processamento)
```

### 7.2 Campos Importantes

**template_fields.excel_cell_ref** — Este é o campo CHAVE que conecta tudo. Cada campo do formulário tem uma referência à célula Excel onde o dado deve ser preenchido:
```
field_key: "manufacturer"  →  excel_cell_ref: "C8"
field_key: "model"         →  excel_cell_ref: "C9"
field_key: "local"         →  excel_cell_ref: "B15"
```

**certificates.extra_fields (JSONB)** — Campos dinâmicos que vêm do template. Os campos fixos (manufacturer, model, etc.) ficam em colunas próprias para facilitar queries. Campos adicionais definidos no template ficam neste JSON.

**certificates.status** — Ciclo de vida:
```
draft → queued → processing → done
                      ↓
                    error (pode ser reprocessado)
```

### 7.3 Alembic (Migrations)
- Config em `alembic.ini` e `migrations/env.py`
- Migrations são geradas com: `alembic revision --autogenerate -m "descricao"`
- São aplicadas automaticamente ao iniciar o backend
- URL do banco é lida do `.env` (não hardcoded no alembic.ini)

---

## 8. Fluxo Completo (Passo a Passo)

### 1. Admin configura um Template
```
Admin acessa /templates
  → Cria template "Pressão" com caminho do Excel: C:\templates\pressao.xlsx
  → Adiciona campos:
     - "local" (texto) → célula B15
     - "responsavel" (texto) → célula B16
     - "condicoes_ambientais" (textarea) → célula B20
```

### 2. Técnico cria um Certificado
```
Técnico acessa /certificates/new
  → Seleciona template "Pressão"
  → Preenche dados fixos: número, fabricante, modelo, série, faixa, unidade
  → Preenche campos dinâmicos do template: local, responsável, condições
  → Adiciona pontos de calibração: nominal, medido, erro, incerteza
  → Salva (status = draft)
```

### 3. Técnico envia para processamento
```
Na lista de certificados, clica no botão "Enviar para fila" (ícone ✈️)
  → API cria item na processing_queue (status = pending)
  → Certificado muda status para "queued"
```

### 4. Worker processa
```
Worker faz polling → encontra item pending
  → Busca dados do certificado + template
  → Abre Excel template (C:\templates\pressao.xlsx)
  → Preenche: C8 = fabricante, C9 = modelo, B15 = local, etc.
  → Preenche pontos de calibração nas linhas correspondentes
  → Exporta PDF
  → Atualiza fila: status = done, pdf_path = caminho do PDF
```

### 5. Técnico baixa o PDF
```
Na lista de certificados, certificado aparece como "Concluído"
  → Clica no botão de download → API retorna o arquivo PDF
```

---

## 9. Como o Mapeamento Excel Funciona

Este é o mecanismo central do sistema. Ele conecta o **formulário web** ao **Excel**.

### Na configuração do template (admin):
```
Template: "Calibração de Pressão"
Excel: C:\templates\pressao.xlsx

Campos:
┌─────────────────────┬──────────┬───────────────┬────────────┐
│ field_key           │ label    │ excel_cell_ref│ field_type │
├─────────────────────┼──────────┼───────────────┼────────────┤
│ certificate_number  │ Nº Cert  │ C5            │ text       │
│ manufacturer        │ Fabric.  │ C8            │ text       │
│ model               │ Modelo   │ C9            │ text       │
│ serial_number       │ Nº Série │ C10           │ text       │
│ local               │ Local    │ B15           │ text       │
│ responsavel         │ Resp.    │ B16           │ text       │
└─────────────────────┴──────────┴───────────────┴────────────┘
```

### No formulário (técnico preenche):
```
Nº Cert:  CAL-2026-001
Fabric.:  SMAR
Modelo:   LD301
Local:    Sala de calibração
```

### No Worker (preenche Excel):
```python
# O worker lê o mapeamento e faz:
sheet.Range("C5").Value = "CAL-2026-001"   # certificate_number → C5
sheet.Range("C8").Value = "SMAR"           # manufacturer → C8
sheet.Range("C9").Value = "LD301"          # model → C9
sheet.Range("B15").Value = "Sala de calib" # local (extra_field) → B15
```

### Pontos de calibração:
```
Cada ponto tem um excel_row_ref (ex: "25", "26", "27")
O worker preenche: B25 = nominal, C25 = medido, D25 = erro, E25 = incerteza
```

---

## 10. API — Endpoints

### Base URL: `/api/v1`

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/auth/login` | Login → retorna JWT + dados do usuário |

### Templates
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/templates` | Lista templates (filtro: active_only) |
| `GET` | `/templates/{id}` | Template completo com campos |
| `POST` | `/templates` | Cria template (pode incluir campos) |
| `PUT` | `/templates/{id}` | Atualiza template |
| `POST` | `/templates/{id}/fields` | Adiciona campo ao template |
| `PUT` | `/templates/{id}/fields/{fid}` | Atualiza campo |
| `DELETE` | `/templates/{id}/fields/{fid}` | Remove campo |

### Certificates
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/certificates` | Lista com paginação e filtros |
| `GET` | `/certificates/{id}` | Certificado completo com pontos |
| `POST` | `/certificates` | Cria certificado + pontos |
| `PUT` | `/certificates/{id}` | Atualiza (somente status draft) |
| `DELETE` | `/certificates/{id}` | Exclui (draft ou error) |
| `POST` | `/certificates/{id}/queue` | Envia para processamento |
| `GET` | `/certificates/{id}/pdf` | Download do PDF gerado |

### Queue
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/queue` | Lista fila (dashboard admin) |
| `GET` | `/queue/next` | Próximo pendente (usado pelo worker) |
| `PATCH` | `/queue/{id}` | Atualiza status (worker informa done/error) |
| `POST` | `/queue/{id}/retry` | Reprocessar item com erro |

### Padrão de Resposta
```json
{
  "data": { ... },
  "message": "Sucesso",
  "meta": { "page": 1, "per_page": 20, "total": 100, "total_pages": 5 }
}
```

---

## 11. Como Rodar o Projeto

### Pré-requisitos
- Python 3.12+
- Node.js 18+
- PostgreSQL 15+
- Microsoft Excel (para o worker)

### 1. Banco de Dados
```sql
CREATE DATABASE calibracao_db;
```
Editar `backend/.env` com as credenciais:
```
DATABASE_URL=postgresql://usuario:senha@localhost:5432/calibracao_db
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt

# Gerar migration inicial (primeira vez)
alembic revision --autogenerate -m "initial_tables"

# Rodar (migrations são aplicadas automaticamente)
uvicorn app.main:app --reload --port 8000
```
Acesse a documentação da API em: http://localhost:8000/docs

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Acesse: http://localhost:5173

### 4. Worker RPA
```bash
cd worker_rpa
pip install -r requirements.txt
python main.py
```

---

## 12. O Que Falta Implementar

### Fase 2 — MVP
- [ ] Autenticação JWT real com middleware de roles (hoje é mock na POC)
- [ ] CRUD de usuários
- [ ] Upload do arquivo Excel template (hoje é caminho manual)
- [ ] Validação mais robusta no formulário dinâmico
- [ ] Dashboard com gráficos reais (contagens vêm da API)
- [ ] IA: sugestão de campos (GPT-4o-mini)
- [ ] IA: validação de dados de calibração
- [ ] Testes automatizados (pytest)
- [ ] Dark mode

### Fase 3 — Escala
- [ ] Redis + Celery substituindo polling HTTP
- [ ] Cloud storage para PDFs (S3/MinIO)
- [ ] IA: resumo técnico automático
- [ ] IA: OCR de certificados antigos (PDF → dados)
- [ ] IA: busca semântica com embeddings (pgvector)
- [ ] Auditoria (log de ações)
- [ ] Notificações (email/webhook)
- [ ] Multi-tenant
- [ ] Monitoramento (Prometheus/Grafana)
- [ ] CI/CD

---

## 13. Decisões Técnicas

| Decisão | Por quê |
|---------|---------|
| **UUID como PK** | Segurança (não expõe sequência), preparado para distribuição |
| **extra_fields como JSONB** | Flexibilidade para campos dinâmicos do template sem alterar schema. Campos fixos (manufacturer, etc.) ficam em colunas para indexação |
| **excel_cell_ref no template_fields** | Permite que o admin configure o mapeamento sem precisar de código. O worker lê esses mapeamentos dinamicamente |
| **Polling HTTP (não WebSocket/Redis)** | Simplicidade na POC. Migrar para Redis+Celery na Fase 3 |
| **Alembic auto-migrate** | Facilita deploy — basta iniciar o backend e as tabelas são criadas |
| **Proxy no Vite** | Frontend e backend em portas diferentes em dev, mas mesmo domínio em produção |
| **win32com (não openpyxl)** | Necessário para executar macros do Excel e manter formatação. openpyxl não executa macros |
| **1 worker por máquina** | win32com não é thread-safe, apenas uma instância Excel por vez |
| **Tailwind v4** | CSS moderno com design tokens via `@theme`, sem arquivo de config separado |

---

*Documento gerado em 24/04/2026. Última atualização: Fase 1 (POC) implementada.*
