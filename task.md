# Task — Implementação Fase 1 (POC)

## Backend
- [x] Setup do projeto (requirements.txt, .env, estrutura)
- [x] Config e Database (config.py, database.py)
- [x] Models SQLAlchemy (user, template, certificate, queue)
- [x] Alembic setup + auto-migration no startup
- [x] Schemas Pydantic (request/response)
- [x] Services (template_service, certificate_service, queue_service)
- [x] Routers (auth, templates, certificates, queue)
- [x] main.py com CORS e startup
- [ ] Gerar migration inicial (precisa do banco rodando)
- [ ] Testar endpoints

## Frontend
- [x] Setup Vite + React + Tailwind v4
- [x] Design system (cores #002868, cinza, branco, Inter font)
- [x] Layout (Sidebar, Header, AppLayout)
- [x] Login page
- [x] Dashboard page
- [x] Certificates list page
- [x] Certificate form page (com campos dinâmicos + pontos)
- [x] Templates management page
- [x] Queue page
- [x] Auth context
- [x] API client (Axios)
- [x] Routing com proteção

## Worker RPA
- [x] Estrutura do worker
- [x] API client
- [x] Polling da fila
- [x] Manipulação Excel (excel_handler.py)
- [x] Geração de PDF
- [x] Tratamento de erros e retry
- [x] Logging estruturado

## Pendente (precisa do banco PostgreSQL)
- [ ] Rodar `alembic revision --autogenerate`
- [ ] Testar backend com `uvicorn app.main:app --reload`
- [ ] Testar frontend com `npm run dev`
