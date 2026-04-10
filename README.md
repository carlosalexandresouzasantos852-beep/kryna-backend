# 🌸 Crina Dashboard — Backend

Painel de controle web para o bot Crina no Discord.  
Stack: **Node.js + Express + PostgreSQL + Discord OAuth2**

---

## 📁 Estrutura do projeto

```
crina-backend/
├── src/
│   ├── server.js              ← Servidor principal
│   ├── auth/
│   │   └── passport.js        ← OAuth2 Discord
│   ├── database/
│   │   └── db.js              ← PostgreSQL + criação de tabelas
│   ├── middlewares/
│   │   └── auth.js            ← Proteção de rotas
│   ├── routes/
│   │   ├── auth.js            ← /auth/discord, /auth/me, /auth/logout
│   │   ├── guilds.js          ← /api/guilds
│   │   ├── config.js          ← /api/guilds/:id/config/*
│   │   └── user.js            ← /api/user/*
│   └── utils/
│       └── discord.js         ← Bot discord.js + helpers
├── public/
│   ├── index.html             ← Landing page
│   ├── painel.html            ← Painel de controle
│   └── js/
│       └── painel.js          ← JavaScript do painel
├── .env.example
├── discloud.config
└── package.json
```

---

## ⚙️ Setup — Passo a Passo

### 1. Discord Developer Portal

1. Acesse https://discord.com/developers/applications
2. Selecione sua aplicação (a Crina)
3. Em **OAuth2 → General**, copie o **Client ID** e **Client Secret**
4. Em **OAuth2 → Redirects**, adicione:
   - `http://localhost:3000/auth/discord/callback` (desenvolvimento)
   - `https://SEU-APP.discloud.app/auth/discord/callback` (produção)
5. Em **Bot**, copie o **Token**

---

### 2. Banco de Dados PostgreSQL

Recomendamos o **[Neon.tech](https://neon.tech)** (gratuito, funciona com Discloud):

1. Crie uma conta em neon.tech
2. Crie um novo projeto
3. Copie a **Connection String** (formato: `postgresql://user:pass@host/db`)

---

### 3. Configurar o .env

Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

Preencha o `.env`:
```env
DISCORD_CLIENT_ID=seu_client_id
DISCORD_CLIENT_SECRET=seu_client_secret
DISCORD_BOT_TOKEN=seu_bot_token
DASHBOARD_URL=http://localhost:3000
CALLBACK_URL=http://localhost:3000/auth/discord/callback
DATABASE_URL=postgresql://...
SESSION_SECRET=uma_string_muito_secreta_aqui
PORT=3000
```

---

### 4. Conectar o painel.html ao JS

No seu `painel.html`, antes do `</body>`, adicione:
```html
<script src="/js/painel.js"></script>
```

Nos botões do HTML, adicione os `id` e `onclick` conforme o `painel.js`:

**Notificações** — adicione `id` em cada toggle:
```html
<!-- Exemplo: -->
<input type="checkbox" id="notif-rep" />
<input type="checkbox" id="notif-marriage" />
<input type="checkbox" id="notif-mar-end" />
<input type="checkbox" id="notif-affinity" />
<input type="checkbox" id="notif-renewed" />
<input type="checkbox" id="notif-letter" />
<input type="checkbox" id="notif-level" />
<input type="checkbox" id="notif-giveaway" />
```

**Botão salvar notificações:**
```html
<button class="btn btn-primary btn-sm" onclick="saveNotifications()">Salvar</button>
```

**Prefixo:**
```html
<input class="form-input" id="prefix-input" oninput="updatePreview()" />
<button onclick="savePrefix()">Salvar</button>
```

**Logout:**
```html
<div class="nav-item danger" onclick="logout()">🚪 Sair</div>
```

---

### 5. Rodar localmente

```bash
npm install
npm run dev
```

Acesse: http://localhost:3000

---

### 6. Deploy no Discloud

1. Compacte a pasta em `.zip` (sem a pasta `node_modules`)
2. Acesse https://discloud.app
3. Suba o `.zip`
4. Configure as variáveis de ambiente no painel do Discloud
5. Atualize o `.env` com a URL real:
   ```env
   DASHBOARD_URL=https://crina.discloud.app
   CALLBACK_URL=https://crina.discloud.app/auth/discord/callback
   ```
6. Adicione a URL de callback no Discord Developer Portal também

---

## 🔌 Rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /auth/discord | Login via Discord |
| GET | /auth/me | Usuário logado |
| POST | /auth/logout | Logout |
| GET | /api/guilds | Servidores do usuário |
| GET | /api/guilds/:id/channels | Canais do servidor |
| GET | /api/guilds/:id/roles | Cargos do servidor |
| GET/PUT | /api/guilds/:id/config | Config geral |
| GET/PUT | /api/guilds/:id/config/prefix | Prefixo |
| GET/POST/DELETE | /api/guilds/:id/config/custom-commands | Comandos personalizados |
| GET/PUT | /api/guilds/:id/config/welcome | Entrada/saída |
| GET/PUT | /api/guilds/:id/config/moderation | Moderação |
| GET/PUT | /api/guilds/:id/config/xp | Sistema de XP |
| GET/PUT | /api/user/notifications | Notificações |
| GET/PUT | /api/user/customization | Personalização |
| GET | /api/user/api-key | Chave de API |
| POST | /api/user/api-key/regenerate | Gerar nova chave |
