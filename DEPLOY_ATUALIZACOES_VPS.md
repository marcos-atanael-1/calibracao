# Atualizacao da Aplicacao na VPS

Este documento explica o procedimento padrao para atualizar a aplicacao na VPS depois que voce subir novas alteracoes para o GitHub.

Repositorio:

- `https://github.com/marcos-atanael-1/calibracao.git`

Estrutura assumida na VPS:

- projeto clonado em `/opt/calibracao/app`
- backend em `/opt/calibracao/app/backend`
- frontend em `/opt/calibracao/app/frontend`
- storage de PDFs em `/opt/calibracao/storage/pdfs`

## Regra Geral

Sempre que voce fizer alteracoes localmente:

1. subir para o GitHub
2. entrar na VPS
3. executar `git pull`
4. atualizar backend e/ou frontend conforme o tipo da mudanca

## 1. Subir Alteracoes para o GitHub

No seu computador:

```bash
git add .
git commit -m "descricao da alteracao"
git push
```

## 2. Atualizar o Codigo na VPS

Na VPS:

```bash
cd /opt/calibracao/app
git pull
```

Se aparecer conflito local na VPS, pare e revise antes de continuar.

## 3. Atualizacao Rapida por Tipo de Mudanca

### 3.1 Se alterou somente frontend

Exemplos:

- telas React
- CSS
- componentes
- rotas do frontend

Comandos:

```bash
cd /opt/calibracao/app/frontend
npm install
npm run build
systemctl reload nginx
```

### 3.2 Se alterou somente backend

Exemplos:

- rotas FastAPI
- services
- models
- schemas
- upload de PDF

Comandos:

```bash
cd /opt/calibracao/app/backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart calibracao-backend
systemctl status calibracao-backend --no-pager
```

### 3.3 Se alterou backend e frontend

Comandos:

```bash
cd /opt/calibracao/app/backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart calibracao-backend

cd /opt/calibracao/app/frontend
npm install
npm run build
systemctl reload nginx
```

## 4. Quando Existem Migrations

Se voce adicionou ou alterou migrations do Alembic, normalmente basta reiniciar o backend, porque o projeto ja tenta aplicar migrations no startup.

Mesmo assim, o fluxo recomendado continua:

```bash
cd /opt/calibracao/app/backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart calibracao-backend
journalctl -u calibracao-backend -n 80 --no-pager
```

Se o backend subir corretamente, as migrations foram aplicadas.

## 5. Quando Alterar o `.env` do Backend

Se voce mudou:

- `DATABASE_URL`
- `CORS_ORIGINS`
- `PDF_STORAGE_PATH`
- `WORKER_UPLOAD_TOKEN`
- `SECRET_KEY`

entao edite:

```bash
nano /opt/calibracao/app/backend/.env
```

Depois:

```bash
systemctl restart calibracao-backend
systemctl status calibracao-backend --no-pager
```

## 6. Quando Alterar o Nginx

Se voce mudou:

- dominio
- proxy `/api/`
- SSL
- raiz do frontend

entao valide antes:

```bash
nginx -t
```

Se estiver ok:

```bash
systemctl reload nginx
```

## 7. Quando Alterar o Worker

O worker roda no Windows, fora da VPS.

Se alterou arquivos em:

- `worker_rpa/main.py`
- `worker_rpa/db_client.py`
- `worker_rpa/excel_handler.py`
- `worker_rpa/config.py`
- `worker_rpa/api_client.py`

voce precisa atualizar a copia da maquina Windows tambem.

Opcoes:

### 7.1 Atualizar por Git na maquina Windows

Se o worker estiver em uma pasta clonada do repositorio:

```powershell
cd C:\worker_rpa
git pull
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 7.2 Atualizar copiando os arquivos

Se o worker estiver em uma pasta separada:

- copie os arquivos alterados do repositorio para `C:\worker_rpa`
- preserve o `.env` e a `venv`

Depois teste:

```powershell
cd C:\worker_rpa
.\venv\Scripts\Activate.ps1
python main.py
```

## 8. Checklist de Validacao Depois de Atualizar

### 8.1 Backend

```bash
systemctl status calibracao-backend --no-pager
curl https://calibracao.pmlean.com/api/v1/health
```

Esperado:

- backend ativo
- health respondendo

### 8.2 Frontend

Abra no navegador:

- `https://calibracao.pmlean.com`

Ou teste:

```bash
curl -I https://calibracao.pmlean.com
```

### 8.3 Logs do backend

```bash
journalctl -u calibracao-backend -n 80 --no-pager
```

### 8.4 Logs do Nginx

```bash
tail -n 80 /var/log/nginx/error.log
```

### 8.5 Worker

Na maquina Windows:

```powershell
cd C:\worker_rpa
.\venv\Scripts\Activate.ps1
python main.py
```

Se houver item na fila, ele deve:

- abrir a planilha
- gerar o PDF
- enviar o PDF para a API
- atualizar o banco

## 9. Fluxo Mais Comum no Dia a Dia

Na pratica, para a maioria das alteracoes:

### Se alterou frontend

```bash
cd /opt/calibracao/app
git pull
cd frontend
npm install
npm run build
systemctl reload nginx
```

### Se alterou backend

```bash
cd /opt/calibracao/app
git pull
cd backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart calibracao-backend
```

### Se alterou ambos

```bash
cd /opt/calibracao/app
git pull

cd backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart calibracao-backend

cd ../frontend
npm install
npm run build
systemctl reload nginx
```

## 10. Quando Algo Der Errado

### Backend nao sobe

```bash
systemctl status calibracao-backend --no-pager
journalctl -u calibracao-backend -n 100 --no-pager
```

### Frontend nao abre

```bash
ls -la /opt/calibracao/app/frontend/dist
tail -n 80 /var/log/nginx/error.log
nginx -t
```

### API externa nao responde

```bash
curl http://127.0.0.1:8000/api/v1/health
curl https://calibracao.pmlean.com/api/v1/health
```

### Worker falha

Verifique:

- `worker_rpa/.env`
- conectividade com PostgreSQL
- conectividade com `https://calibracao.pmlean.com/api/v1`
- logs em `worker_rpa/logs`

## 11. Recomendacao Final

Sempre que atualizar:

1. `git pull`
2. rebuild do frontend se mudou React
3. restart do backend se mudou FastAPI
4. testar `health`
5. testar a tela principal
6. se mudou o worker, atualizar a maquina Windows tambem

