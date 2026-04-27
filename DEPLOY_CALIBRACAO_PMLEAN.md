# Deploy da Aplicacao em `calibracao.pmlean.com`

Este documento descreve o passo a passo para publicar a aplicacao com:

- frontend e backend em uma VPS Linux
- banco PostgreSQL ja existente
- Agente Windows rodando a planilha Excel e enviando o PDF para a API
- dominio publico em `https://calibracao.pmlean.com`
- deploy do codigo via `git`

## Arquitetura Final

- Frontend: `https://calibracao.pmlean.com`
- Backend publico: `https://calibracao.pmlean.com/api/v1`
- Backend interno na VPS: `127.0.0.1:8000`
- Banco PostgreSQL: ja existente
- Agente Windows:
  - le fila direto do PostgreSQL
  - gera PDF localmente
  - envia o PDF para o backend via upload HTTP

## 1. DNS do Dominio

No painel DNS do dominio `pmlean.com`, criar:

- Tipo: `A`
- Nome: `calibracao`
- Valor: `IP_PUBLICO_DA_VPS`

Se usar IPv6:

- Tipo: `AAAA`
- Nome: `calibracao`
- Valor: `IPV6_DA_VPS`

Resultado esperado:

- `calibracao.pmlean.com` aponta para a VPS

## 2. Estrutura Recomendada na VPS

Usar uma estrutura como:

```text
/opt/calibracao/
  app/
  storage/
    pdfs/
```

Criar as pastas:

```bash
sudo mkdir -p /opt/calibracao/storage/pdfs
sudo chown -R $USER:$USER /opt/calibracao
```

Observacao:

- o repositorio sera clonado em `/opt/calibracao/app`
- os arquivos sensiveis como `.env`, `venv`, `node_modules`, `dist`, logs e outputs nao sobem para o Git
- o projeto agora possui `.gitignore` na raiz cobrindo esses itens

## 3. Instalar Dependencias na VPS

Exemplo para Ubuntu:

```bash
sudo apt update
sudo apt install -y nginx python3 python3-venv python3-pip certbot python3-certbot-nginx
```

Se o frontend for buildado na propria VPS:

```bash
sudo apt install -y nodejs npm
```

## 4. Subir o Projeto para a VPS

### 4.1 Subir seu codigo para um repositorio Git

No seu computador:

```bash
git init
git add .
git commit -m "deploy inicial"
git branch -M main
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
```

Se o repositorio ja existe:

```bash
git add .
git commit -m "ajustes para deploy"
git push
```

### 4.2 Clonar na VPS

```bash
cd /opt/calibracao
git clone URL_DO_SEU_REPOSITORIO app
```

Estrutura esperada:

- `/opt/calibracao/app/backend`
- `/opt/calibracao/app/frontend`
- `/opt/calibracao/app/worker_rpa`

### 4.3 Atualizar o codigo depois

Sempre que fizer alteracoes localmente:

```bash
git add .
git commit -m "sua alteracao"
git push
```

Na VPS:

```bash
cd /opt/calibracao/app
git pull
```

## 5. Configurar o Backend

### 5.1 Criar o venv

```bash
cd /opt/calibracao/app/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 5.2 Criar o arquivo `.env`

Arquivo: `/opt/calibracao/app/backend/.env`

Exemplo:

```env
APP_NAME=Calibracao API
APP_VERSION=0.1.0
DEBUG=false

DATABASE_URL=postgresql://USUARIO:SENHA@localhost:5432/NOME_DO_BANCO

SECRET_KEY=COLOQUE_UMA_CHAVE_GRANDE_E_FORTE
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
ALGORITHM=HS256

CORS_ORIGINS=["https://calibracao.pmlean.com"]

PDF_STORAGE_PATH=/opt/calibracao/storage/pdfs
WORKER_UPLOAD_TOKEN=COLOQUE_UM_TOKEN_FORTE_AQUI

OPENAI_API_KEY=
```

Observacoes:

- `DATABASE_URL` deve usar o banco que ja existe
- `WORKER_UPLOAD_TOKEN` deve ser um segredo compartilhado com o Agente Windows

### 5.3 Testar backend manualmente

```bash
cd /opt/calibracao/app/backend
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Testar:

```bash
curl http://127.0.0.1:8000/api/v1/health
```

## 6. Criar o Servico do Backend no systemd

Arquivo:

`/etc/systemd/system/calibracao-backend.service`

Conteudo:

```ini
[Unit]
Description=Calibracao Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/calibracao/backend
EnvironmentFile=/opt/calibracao/app/backend/.env
ExecStart=/opt/calibracao/app/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ajustar permissoes:

```bash
sudo chown -R www-data:www-data /opt/calibracao/app/backend
sudo chown -R www-data:www-data /opt/calibracao/storage
```

Ativar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable calibracao-backend
sudo systemctl start calibracao-backend
sudo systemctl status calibracao-backend
```

## 7. Configurar o Frontend

### 7.1 Instalar dependencias

```bash
cd /opt/calibracao/app/frontend
npm install
```

### 7.2 Build de producao

```bash
cd /opt/calibracao/app/frontend
npm run build
```

Isso deve gerar a pasta:

```text
/opt/calibracao/app/frontend/dist
```

## 8. Configurar o Nginx

Arquivo:

`/etc/nginx/sites-available/calibracao.pmlean.com`

Conteudo:

```nginx
server {
    listen 80;
    server_name calibracao.pmlean.com;

    root /opt/calibracao/app/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ativar o site:

```bash
sudo ln -s /etc/nginx/sites-available/calibracao.pmlean.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 9. Configurar HTTPS com Certbot

Depois que o DNS estiver propagado:

```bash
sudo certbot --nginx -d calibracao.pmlean.com
```

Testar:

- `https://calibracao.pmlean.com`
- `https://calibracao.pmlean.com/api/v1/health`

## 10. Banco PostgreSQL Ja Existente

Como o banco ja existe, voce nao precisa recria-lo.

Verifique apenas:

- nome do banco
- usuario
- senha
- acesso local na VPS funcionando para o backend

## 11. Liberar Acesso Remoto ao PostgreSQL para o Agente Windows

O Agente hoje le a fila direto do banco. Entao ele precisa acessar o PostgreSQL da VPS.

### 11.1 Ajustar `postgresql.conf`

Local comum:

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Ajustar:

```conf
listen_addresses = '*'
```

### 11.2 Ajustar `pg_hba.conf`

Exemplo:

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Adicionar uma linha restrita ao IP publico da maquina Windows:

```conf
host    NOME_DO_BANCO    USUARIO    IP_PUBLICO_DA_MAQUINA_WINDOWS/32    md5
```

### 11.3 Reiniciar PostgreSQL

```bash
sudo systemctl restart postgresql
```

### 11.4 Liberar a porta 5432 no firewall

Se usar UFW:

```bash
sudo ufw allow from IP_PUBLICO_DA_MAQUINA_WINDOWS to any port 5432
```

Observacao:

- libere somente para o IP do Windows
- nao deixe a porta 5432 aberta para qualquer origem

## 12. Configurar o Agente Windows

O Agente:

- le a fila do PostgreSQL
- abre a planilha Excel
- gera o PDF
- faz upload do PDF para o backend em `https://calibracao.pmlean.com/api/v1`

### 12.1 Criar o venv

No Windows:

```powershell
cd "C:\CAMINHO\worker_rpa"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Observacao:

- o `worker_rpa/.env` nao sobe para o Git
- a pasta `worker_rpa/venv` nao sobe para o Git
- `worker_rpa/output` e `worker_rpa/logs` tambem nao sobem para o Git

### 12.2 Criar o `.env`

Arquivo: `worker_rpa/.env`

Exemplo:

```env
DATABASE_URL=postgresql+psycopg2://USUARIO:SENHA@IP_DA_VPS:5432/NOME_DO_BANCO

API_BASE_URL=https://calibracao.pmlean.com/api/v1
UPLOAD_PDF_TO_API=true
WORKER_UPLOAD_TOKEN=COLOQUE_O_MESMO_TOKEN_DO_BACKEND

WORKER_ID=agente-01
PDF_OUTPUT_DIR=./output
KILL_EXCEL_ON_START=true
RUN_MODE=scheduled_once
```

### 12.3 Planilha Excel

Deixar a planilha no caminho:

```text
C:\Planilhas\Certificado de Volume-CVM-VOL-001 Rev.73.xlsm
```

O template da POC ja foi preparado para esse caminho.

### 12.4 Testar manualmente

```powershell
cd "C:\CAMINHO\worker_rpa"
.\venv\Scripts\Activate.ps1
python main.py
```

O esperado:

- mata `EXCEL.EXE`
- pega 1 item da fila
- abre a planilha
- preenche
- gera PDF
- envia PDF para a API
- atualiza o banco

Logs:

- `worker_rpa/logs`

Saidas locais:

- `worker_rpa/output`

## 13. Agendar o Agente no Windows

No Agendador de Tarefas:

### 13.1 Criar tarefa

- Nome: `Agente Elus`
- Executar com privilegios mais altos

### 13.2 Disparador

- diario
- repetir a cada `2 minutos`
- por tempo `indefinidamente`

### 13.3 Acao

Programa:

```text
C:\CAMINHO\worker_rpa\venv\Scripts\python.exe
```

Argumentos:

```text
main.py
```

Iniciar em:

```text
C:\CAMINHO\worker_rpa
```

### 13.4 Configuracao recomendada

Marcar:

- nao iniciar nova instancia se a anterior ainda estiver em execucao

## 14. Fluxo de Teste Completo

1. subir backend na VPS
2. subir frontend na VPS
3. confirmar `https://calibracao.pmlean.com/api/v1/health`
4. no sistema, cadastrar listas em `Configuracoes`
5. criar ou sincronizar o template da planilha
6. criar um certificado pelo frontend
7. clicar em `Processar` para enviar para a fila
8. rodar o Agente manualmente no Windows
9. conferir se:
   - o status foi para `done`
   - o PDF foi salvo na VPS
   - o download funciona no frontend

## 15. Fluxo de Atualizacao por Git

Quando voce alterar o projeto localmente:

1. no seu computador:

```bash
git add .
git commit -m "descricao da alteracao"
git push
```

2. na VPS:

```bash
cd /opt/calibracao/app
git pull
```

3. se alterou backend:

```bash
cd /opt/calibracao/app/backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart calibracao-backend
```

4. se alterou frontend:

```bash
cd /opt/calibracao/app/frontend
npm install
npm run build
sudo systemctl reload nginx
```

5. se alterou somente arquivos Python do Agente:

- atualizar a copia local da maquina Windows
- ou `git pull` na pasta do Agente, se ela tambem estiver versionada la

## 16. Exemplo de Campos Minimos para Teste

No formulario, preencher algo como:

- `Nº do Certificado`: `15236`
- `Empresa`: `Elus`
- `Tipo da Calibracao`: `Acreditado Interno`
- `Nº do Orcamento`: `555662`
- `Contratante`: `Teste Cliente`
- `Instrumento`: `Micropipeta de Volume Fixo`
- `Fabricante`: `teste`
- `Modelo`: `teste`
- `Identificacao`: `teste`
- `Numero de Serie`: `teste`
- `Tipo de Indicacao`: `Digital`
- `Material`: `Bronze`
- `Escopo`: `Microvolume`
- `Faixa de Medicao`: `100`
- `Menor Divisao`: `0,1`
- `Metodo`: `Normal`
- `Qtd Canais/Seringas`: `1`
- `Pontos por Canal`: `3`
- `Data da Calibracao`: `2026-03-18`
- `Data de Emissao`: `2026-03-18`
- `Tecnico`: selecionar um cadastrado

Canal 1:

- `Identificacao do Canal/Seringa`: `teste`

Pontos:

- ponto 1: `10`
- ponto 2: `50`
- ponto 3: `100`

Nas 10 medicoes de cada ponto:

- `Massa aparente`: `0,1`
- `Temperatura do fluido`: `20`

## 17. Checklist de Erros Comuns

Se algo falhar, revisar:

- DNS do subdominio
- certbot/SSL
- Nginx com proxy para `/api/`
- backend respondendo em `127.0.0.1:8000`
- banco acessivel pela VPS
- banco acessivel pelo Windows
- token do upload igual no backend e no Agente
- planilha realmente em `C:\Planilhas\...`
- Excel instalado na maquina Windows
- logs do Agente em `worker_rpa/logs`

## 18. Resumo da Configuracao Final

- frontend publico: `https://calibracao.pmlean.com`
- backend publico: `https://calibracao.pmlean.com/api/v1`
- backend interno: `127.0.0.1:8000`
- PDFs armazenados na VPS em:
  - `/opt/calibracao/storage/pdfs`
- Agente Windows:
  - banco via `DATABASE_URL`
  - upload do PDF via `API_BASE_URL`
