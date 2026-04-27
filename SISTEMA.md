# Projeto Elus — Documentação do Sistema

## 1. O que é o sistema

O **Projeto Elus** é um sistema web de **gestão e emissão de certificados de calibração** para laboratórios de metrologia. Ele permite que técnicos preencham formulários de calibração no navegador, e no futuro o sistema gerará automaticamente os certificados em Excel/PDF usando automação (RPA) e validação via IA.

### Fase atual: POC (Prova de Conceito)
O sistema está em fase de POC, com foco em:
- Autenticação de usuários com controle de perfis
- Formulário web completo para entrada de dados de calibração
- Módulo de configurações para gerenciar listas de opções (selects)
- Gestão de templates de certificados com campos dinâmicos
- Fila de processamento (estrutura pronta, sem worker implementado)

### Próximas fases planejadas
- **Worker RPA**: Integrar com o Excel via fila (Redis/Celery) para preencher planilhas automaticamente
- **Camada de IA**: Validar dados antes de enviar ao RPA (OpenAI)
- **Esqueci minha senha**: Fluxo real de reset via e-mail

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite)                            │
│  http://localhost:5173                              │
│                                                     │
│  ┌─────────┐ ┌──────────┐ ┌───────────────────────┐ │
│  │ Login   │ │ Sidebar  │ │ Header (trocar senha) │ │
│  └─────────┘ └──────────┘ └───────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐│
│  │ Páginas: Dashboard | Certificados | Templates   ││
│  │          Fila | Usuários | Configurações         ││
│  └──────────────────────────────────────────────────┘│
│                      │ Axios (/api/v1)               │
└──────────────────────┼──────────────────────────────┘
                       │ Vite Proxy
┌──────────────────────┼──────────────────────────────┐
│  BACKEND (FastAPI + Python)                         │
│  http://localhost:8000                              │
│                                                     │
│  ┌──────────────────────────────────────────────────┐│
│  │ Routers: auth | users | templates | certificates ││
│  │          queue | settings                        ││
│  └──────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │ Services → Models → PostgreSQL                   ││
│  └──────────────────────────────────────────────────┘│
│  Alembic (migrations automáticas no startup)         │
└──────────────────────────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────┐
│  PostgreSQL                                         │
│  Host: 212.47.76.28:5432                            │
│  Banco: database | Usuário: elus                    │
└─────────────────────────────────────────────────────┘
```

---

## 3. Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React (JSX, não TypeScript) | Vite |
| Estilo | CSS vanilla + classes utilitárias | index.css |
| Ícones | lucide-react | — |
| HTTP Client | Axios | — |
| Backend | FastAPI (Python) | 3.12+ |
| ORM | SQLAlchemy 2.0 (Mapped) | — |
| Migrations | Alembic (auto no startup) | — |
| Auth | JWT (python-jose) + bcrypt direto | — |
| Banco de Dados | PostgreSQL | 15+ |
| Validação | Pydantic v2 | — |

---

## 4. Estrutura de Pastas

### Backend (`/backend`)
```
backend/
├── .env                          # Configurações (banco, JWT, CORS)
├── alembic.ini                   # Config do Alembic
├── migrations/
│   ├── env.py                    # Script de migration (com fix de %)
│   ├── script.py.mako            # Template de migrations (corrigido)
│   └── versions/                 # Arquivos de migration gerados
├── app/
│   ├── main.py                   # Entrypoint FastAPI (lifespan, CORS, routers)
│   ├── config.py                 # Settings via Pydantic (lê .env)
│   ├── database.py               # Engine e SessionLocal do SQLAlchemy
│   ├── dependencies.py           # get_db() dependency injection
│   ├── models/
│   │   ├── user.py               # User + UserRole (super_admin/admin/tecnico)
│   │   ├── template.py           # Template + TemplateField
│   │   ├── certificate.py        # Certificate + CertificatePoint
│   │   ├── processing_queue.py   # ProcessingQueue
│   │   └── setting.py            # Setting (listas de opções)
│   ├── schemas/                  # Pydantic schemas (request/response)
│   ├── services/                 # Lógica de negócio (CRUD)
│   ├── routers/                  # Endpoints FastAPI
│   │   ├── auth.py               # Login + change password + seed admin
│   │   ├── users.py              # CRUD de usuários
│   │   ├── templates.py          # CRUD de templates + campos
│   │   ├── certificates.py       # CRUD de certificados
│   │   ├── queue.py              # Fila de processamento
│   │   └── settings.py           # CRUD de configurações (listas)
│   └── utils/
│       └── security.py           # hash_password, verify_password, JWT
```

### Frontend (`/frontend`)
```
frontend/
├── public/
│   └── logo-sidebar.jpg          # Logo customizado da sidebar
├── src/
│   ├── main.jsx                  # Entrypoint React
│   ├── App.jsx                   # Rotas (BrowserRouter)
│   ├── index.css                 # Design system (CSS vanilla)
│   ├── api/
│   │   └── client.js             # Axios com interceptors (token, 401)
│   ├── context/
│   │   └── AuthContext.jsx       # Provider de autenticação (login/logout/user)
│   ├── components/layout/
│   │   ├── AppLayout.jsx         # Layout principal (sidebar + header + outlet)
│   │   ├── Sidebar.jsx           # Navegação lateral retrátil
│   │   └── Header.jsx            # Header com título, perfil, modal troca senha
│   └── pages/
│       ├── Login.jsx             # Tela de login
│       ├── ChangePassword.jsx    # Tela de troca obrigatória (1º login)
│       ├── Dashboard.jsx         # Dashboard com cards de resumo
│       ├── Certificates.jsx      # Lista de certificados
│       ├── CertificateForm.jsx   # Formulário completo de certificado (POC)
│       ├── Templates.jsx         # Gestão de templates + campos dinâmicos
│       ├── Queue.jsx             # Fila de processamento
│       ├── Users.jsx             # Gestão de usuários (admin only)
│       └── Settings.jsx          # Gestão de listas de opções (admin only)
```

---

## 5. Banco de Dados — Tabelas

| Tabela | Descrição |
|---|---|
| `users` | Usuários do sistema (name, email, password_hash, role, must_change_password) |
| `templates` | Templates de certificado (name, description, excel_template_path) |
| `template_fields` | Campos dinâmicos de cada template (field_key, label, field_type, excel_cell_ref) |
| `certificates` | Certificados criados (vincula template + user, dados do instrumento, extra_fields JSONB) |
| `certificate_points` | Pontos de calibração (nominal, medido, erro, incerteza) — usado na v1 genérica |
| `processing_queue` | Fila para processamento RPA (status, retry_count, worker_id) |
| `settings` | Listas de opções para campos SELECT (key, label, values JSONB) |
| `alembic_version` | Controle de versão das migrations |

### Roles de Usuário
- **super_admin** — acesso total (futuro: configuração de IA)
- **admin** — gestão de usuários, templates, configurações
- **tecnico** — criar/editar certificados

---

## 6. Autenticação

- **Login**: POST `/api/v1/auth/login` → retorna JWT + dados do user
- **Token**: Guardado em `localStorage`, enviado via header `Authorization: Bearer <token>`
- **Seed automático**: Se a tabela `users` estiver vazia, o primeiro login cria o admin padrão:
  - **Email**: `admin@calibracao.com`
  - **Senha**: `admin123`
- **Troca de senha**: Modal no Header (dropdown do avatar → "Trocar Senha")
- **Troca obrigatória**: Se `must_change_password = true`, redireciona para tela de troca antes de usar o sistema
- **Demo mode**: Se o backend estiver offline, o frontend simula login com usuário demo

---

## 7. Módulo de Configurações (Settings)

Gerencia as listas de opções que alimentam os campos SELECT do formulário de certificados.

### Configurações padrão (criadas no seed automático)
| Chave | Label | Valores iniciais |
|---|---|---|
| `calibration_types` | Tipos de Calibração | Acreditado Interno, Rastreado Interno, Rastreado Externo |
| `indication_types` | Tipos de Indicação | Digital, Analógico |
| `materials` | Materiais | Bronze, Aço Inox, Vidro, Polímero |
| `scopes` | Escopos | Microvolume |
| `methods` | Métodos | Gravimétrico |
| `temperature_standards` | Padrões de Temperatura | (vazio — cadastrar) |
| `humidity_standards` | Padrões de Umidade | (vazio — cadastrar) |
| `pressure_standards` | Padrões de Pressão | (vazio — cadastrar) |

### Endpoints
- `GET /api/v1/settings` — listar todas
- `GET /api/v1/settings/{key}` — buscar por chave
- `POST /api/v1/settings` — criar nova lista
- `PUT /api/v1/settings/{id}` — atualizar (label, values)
- `DELETE /api/v1/settings/{id}` — excluir

---

## 8. Formulário de Certificado — Seções

O formulário web (`CertificateForm.jsx`) tem 6 seções, mapeando todos os campos necessários da planilha Excel:

### Seção 1: Dados do Certificado
Empresa, Tipo da Calibração (SELECT), Nº Certificado, Nº Orçamento, Contratante, Endereço, Interessado, Endereço Interessado

### Seção 2: Instrumento
Instrumento, Fabricante, Modelo, Identificação, Nº Série, Tipo Indicação (SELECT), Material (SELECT), Escopo (SELECT), Faixa de Medição, Menor Divisão, Método (SELECT), Qtd Canais/Seringas, **Pontos por Canal** (1/2/3 — controla a seção 5)

### Seção 3: Datas
Data da Calibração, Data de Emissão, Próxima Calibração, Técnico

### Seção 4: Condições Ambientais
Padrão de Temperatura (SELECT), Temp Inicial, Temp Final, Padrão de Umidade (SELECT), Umidade Inicial, Umidade Final, Padrão de Pressão (SELECT), Pressão Inicial, Pressão Final

### Seção 5: Pontos de Calibração (DINÂMICO)
Aparece 1, 2 ou 3 blocos conforme o campo "Pontos por Canal". Cada bloco tem:
- Valor nominal, Menor divisão, Padrão utilizado, Temperatura do fluido
- 10 campos de Massa Aparente (M1 a M10)

### Seção 6: Observações
Textarea livre

### Como os dados são salvos
- Campos mapeáveis direto no model `Certificate` (certificate_number, manufacturer, etc.) → colunas fixas
- Todo o restante → campo `extra_fields` (JSONB), incluindo os pontos de calibração com as 10 medições

---

## 9. Como Rodar

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
# Configurar .env com DATABASE_URL
uvicorn app.main:app --reload --port 8000
```
> O servidor roda migrations automaticamente e cria as settings padrão no startup.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
> Acessa em http://localhost:5173. O Vite faz proxy de `/api` para `localhost:8000`.

---

## 10. UI/UX — Decisões de Design

- **Cor primária**: `#002868` (azul escuro corporativo)
- **Cards**: Background branco, border `#e5e7eb`, border-radius `12px`
- **Botões primários**: Classe `.btn-primary` (azul)
- **Inputs**: Classe `.input-field`, fundo `#eef0f4` no login
- **Sidebar**: Retrátil (68px colapsada / 256px aberta), logo customizado em `/public/logo-sidebar.jpg`
- **Header**: Exibe título da página atual, notificações, avatar do usuário com dropdown (Trocar Senha + Sair)
- **Trocar Senha**: Modal overlay, não navega para outra página
- **Animações**: Classe `.animate-fade-in` para transições suaves

---

## 11. Notas Técnicas Importantes

### Bug do Alembic com % na senha
A senha do banco contém `%`, que precisa ser URL-encoded como `%25` no `.env`. Além disso, o Alembic usa `configparser` que interpreta `%` como interpolação. Por isso:
- `main.py` → `settings.DATABASE_URL.replace("%", "%%")` antes de passar pro Alembic
- `migrations/env.py` → mesmo tratamento
- `migrations/script.py.mako` → corrigido para incluir `"""` no topo (o Alembic gerava sem)

### Bcrypt direto (sem passlib)
O `passlib` é incompatível com versões recentes do `bcrypt`. Usamos `bcrypt` diretamente em `utils/security.py`.

### Demo mode
Se o backend estiver offline, o frontend faz login com usuário demo fake para permitir desenvolvimento isolado do frontend.

### Vite proxy
O `vite.config.js` deve ter proxy configurado para `/api` → `http://localhost:8000`.

---

## 12. Endpoints da API (Resumo)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/auth/login` | Login (retorna JWT) |
| PUT | `/api/v1/auth/change-password/{id}` | Trocar senha |
| GET | `/api/v1/users` | Listar usuários |
| POST | `/api/v1/users` | Criar usuário |
| PUT | `/api/v1/users/{id}` | Atualizar usuário |
| DELETE | `/api/v1/users/{id}` | Excluir usuário |
| GET | `/api/v1/templates` | Listar templates |
| POST | `/api/v1/templates` | Criar template |
| GET | `/api/v1/templates/{id}` | Detalhe do template |
| PUT | `/api/v1/templates/{id}` | Atualizar template |
| POST | `/api/v1/templates/{id}/fields` | Adicionar campo |
| DELETE | `/api/v1/templates/{id}/fields/{fid}` | Remover campo |
| GET | `/api/v1/certificates` | Listar certificados |
| POST | `/api/v1/certificates` | Criar certificado |
| GET | `/api/v1/certificates/{id}` | Detalhe do certificado |
| GET | `/api/v1/queue` | Listar fila |
| GET | `/api/v1/settings` | Listar configurações |
| GET | `/api/v1/settings/{key}` | Buscar por chave |
| POST | `/api/v1/settings` | Criar configuração |
| PUT | `/api/v1/settings/{id}` | Atualizar configuração |
| DELETE | `/api/v1/settings/{id}` | Excluir configuração |
| GET | `/api/v1/health` | Health check |
