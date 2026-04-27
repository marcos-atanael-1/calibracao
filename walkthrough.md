# Walkthrough — Sistema de Calibração v0.1 (POC)

## O que foi implementado

### Backend (FastAPI)
- **6 models SQLAlchemy**: User, Template, TemplateField, Certificate, CertificatePoint, ProcessingQueue
- **Alembic** configurado com auto-migration no startup do app
- **4 routers**: auth, templates, certificates, queue
- **3 services**: template_service, certificate_service, queue_service
- **Auth**: Login com JWT, seed automático de usuário admin na POC
- **~20 endpoints** REST com padrão de resposta consistente

### Frontend (React + Vite + Tailwind v4)
- **Design system** com azul `#002868`, cinzas elegantes, fonte Inter, animações suaves
- **5 páginas**: Login, Dashboard, Certificates, CertificateForm, Templates, Queue
- **Layout**: Sidebar fixa + Header dinâmico
- **Formulário dinâmico**: renderiza campos baseado no template selecionado (mostra `excel_cell_ref`)
- **Tabela de pontos de calibração**: adicionar/remover pontos inline

### Worker RPA (Python + win32com)
- **Polling loop** com backoff exponencial em caso de erro
- **excel_handler.py**: abre template Excel, preenche campos usando mapeamento `template_fields.excel_cell_ref`, exporta PDF
- **Logging** estruturado em arquivo e console

## Como funciona o mapeamento RPA

```
Template (admin configura)
├── Campo "Fabricante"    → excel_cell_ref: "C8"
├── Campo "Modelo"        → excel_cell_ref: "C9"
├── Campo "Nº Série"      → excel_cell_ref: "C10"
└── Campo "Local"         → excel_cell_ref: "B15"

Worker RPA lê esses mapeamentos e faz:
  sheet.Range("C8").Value = certificate.manufacturer
  sheet.Range("C9").Value = certificate.model
  ...
```

## Próximos passos

1. **Criar banco PostgreSQL** e colocar credenciais no `.env`
2. **Gerar migration**: `alembic revision --autogenerate -m "initial"`
3. **Rodar backend**: `uvicorn app.main:app --reload`
4. **Rodar frontend**: `npm run dev`
5. **Testar fluxo completo**: criar template → criar certificado → processar → PDF
