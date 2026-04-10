// public/js/painel.js
// Conecta o painel.html ao backend Express + Discord

const API = ''; // vazio = mesma origem (seu Discloud URL)

// ════════════════════════════════════════════════════════════
//  UTILITÁRIOS
// ════════════════════════════════════════════════════════════

async function api(method, endpoint, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + endpoint, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

const get  = (ep)       => api('GET',    ep);
const post = (ep, body) => api('POST',   ep, body);
const put  = (ep, body) => api('PUT',    ep, body);
const del  = (ep)       => api('DELETE', ep);

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.original = btn.textContent;
    btn.textContent = '⏳ Salvando...';
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.original;
    btn.disabled = false;
  }
}

// Avatar do Discord
function avatarUrl(id, hash) {
  return hash
    ? `https://cdn.discordapp.com/avatars/${id}/${hash}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;
}

// ════════════════════════════════════════════════════════════
//  AUTENTICAÇÃO
// ════════════════════════════════════════════════════════════

let currentUser = null;

async function loadUser() {
  try {
    const data = await get('/auth/me');
    if (!data.authenticated) {
      // Não logado → redireciona para login
      window.location.href = '/auth/discord';
      return;
    }
    currentUser = data.user;
    renderUserInSidebar(currentUser);
  } catch {
    window.location.href = '/auth/discord';
  }
}

function renderUserInSidebar(user) {
  const nameEl   = document.querySelector('.sidebar-user-name');
  const tagEl    = document.querySelector('.sidebar-user-tag');
  const avatarEl = document.querySelector('.sidebar-user-avatar');

  if (nameEl)   nameEl.textContent   = user.username;
  if (tagEl)    tagEl.textContent    = `#${user.discriminator || '0000'}`;
  if (avatarEl) {
    if (user.avatar) {
      avatarEl.innerHTML = `<img src="${avatarUrl(user.id, user.avatar)}"
        style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
    }
  }
}

async function logout() {
  await post('/auth/logout');
  window.location.href = '/';
}

// ════════════════════════════════════════════════════════════
//  SERVIDORES
// ════════════════════════════════════════════════════════════

let guildCache = [];

async function loadGuilds() {
  const grid = document.getElementById('server-grid');
  grid.innerHTML = '<div style="color:var(--muted);padding:20px;">Carregando servidores... 🌸</div>';

  try {
    const data = await get('/api/guilds');
    guildCache = data.guilds;

    // Atualiza os contadores
    document.querySelectorAll('.stat-box-num')[0].textContent = data.configurable;
    document.querySelectorAll('.stat-box-num')[1].textContent = data.withoutBot;
    document.querySelectorAll('.stat-box-num')[2].textContent = data.total;

    renderGuildGrid(data.guilds);
  } catch (err) {
    grid.innerHTML = `<div style="color:var(--danger);">Erro ao carregar servidores: ${err.message}</div>`;
  }
}

function renderGuildGrid(guilds) {
  const grid = document.getElementById('server-grid');
  if (!guilds.length) {
    grid.innerHTML = '<div style="color:var(--muted);">Nenhum servidor encontrado.</div>';
    return;
  }

  grid.innerHTML = guilds.map(g => `
    <div class="server-card">
      <div class="server-icon">
        ${g.icon
          ? `<img src="${g.icon}" style="width:56px;height:56px;border-radius:16px;object-fit:cover;"/>`
          : '🌸'}
      </div>
      <div class="server-name">${escHtml(g.name)}</div>
      <div class="server-role">${g.owner ? '👑 Dono' : '🛡️ Admin'} · ${g.memberCount ? g.memberCount + ' membros' : ''}</div>
      ${g.hasBot
        ? `<button class="server-btn config" onclick="openServerConfig('${g.id}','${escHtml(g.name)}')">⚙️ Configurar</button>`
        : `<button class="server-btn add" onclick="openAddModal('${g.id}','${escHtml(g.name)}')">+ Adicionar Crina</button>`
      }
    </div>
  `).join('');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════════════
//  CONFIG DO SERVIDOR
// ════════════════════════════════════════════════════════════

let activeGuildId   = null;
let guildChannels   = [];
let guildRoles      = [];

async function openServerConfig(guildId, guildName) {
  activeGuildId = guildId;
  document.getElementById('config-server-name').textContent = guildName;
  document.getElementById('topbar-title').textContent = guildName;

  // Muda de view
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-servidor-config').classList.add('active');

  // Init no banco
  const guild = guildCache.find(g => g.id === guildId);
  await post(`/api/guilds/${guildId}/init`, { name: guild?.name, icon: guild?.icon }).catch(() => {});

  // Carrega canais e cargos para os selects
  [guildChannels, guildRoles] = await Promise.all([
    get(`/api/guilds/${guildId}/channels`).catch(() => []),
    get(`/api/guilds/${guildId}/roles`).catch(() => [])
  ]);

  // Mostra a aba inicial
  showSub('visao-geral');
  await loadServerOverview();
}

// ── Visão Geral ──────────────────────────────────────────────
async function loadServerOverview() {
  try {
    const data = await get(`/api/guilds/${activeGuildId}/config`);
    const cfg  = data.config;
    if (cfg) {
      const inputs = document.querySelectorAll('#sub-visao-geral input');
      if (inputs[0]) inputs[0].value = cfg.guild_name || '';
    }
  } catch (err) {
    console.warn('Visão geral:', err.message);
  }
}

// ── Prefixo ──────────────────────────────────────────────────
async function loadPrefixConfig() {
  try {
    const data = await get(`/api/guilds/${activeGuildId}/config`);
    const prefix = data.config?.prefix || '!';
    const inp = document.getElementById('prefix-input');
    if (inp) { inp.value = prefix; updatePreview(); }
  } catch {}

  await loadCustomCommands();
}

async function savePrefix() {
  const prefix = document.getElementById('prefix-input')?.value?.trim();
  if (!prefix) return toast('Prefixo inválido.', 'error');
  const btn = document.querySelector('[onclick="savePrefix()"]');
  if (btn) setLoading(btn, true);
  try {
    await put(`/api/guilds/${activeGuildId}/config/prefix`, { prefix });
    toast('Prefixo salvo! ✅');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) setLoading(btn, false);
  }
}

// ── Comandos personalizados ───────────────────────────────────
async function loadCustomCommands() {
  try {
    const cmds = await get(`/api/guilds/${activeGuildId}/config/custom-commands`);
    renderCustomCommandsList(cmds);
  } catch {}
}

function renderCustomCommandsList(cmds) {
  const list = document.getElementById('custom-commands-list');
  if (!list) return;
  list.innerHTML = cmds.map(c => `
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;" data-id="${c.id}">
      <input class="form-input" value="${escHtml(c.trigger)}" style="flex:1;" placeholder="!comando" readonly />
      <input class="form-input" value="${escHtml(c.response)}" style="flex:2;" placeholder="Resposta da Crina" readonly />
      <button class="btn btn-danger btn-sm" onclick="deleteCustomCommand(${c.id})">✕</button>
    </div>
  `).join('') || '<p style="color:var(--muted);font-size:0.85rem;">Nenhum comando personalizado ainda.</p>';
}

async function addCustomCommand() {
  const list = document.getElementById('custom-commands-list');
  const row  = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center;';
  row.innerHTML = `
    <input class="form-input new-trigger"  style="flex:1;"  placeholder="!meucmd" />
    <input class="form-input new-response" style="flex:2;"  placeholder="Olá, {user}!" />
    <button class="btn btn-primary btn-sm" onclick="saveNewCustomCommand(this)">✓</button>
  `;
  list.appendChild(row);
  row.querySelector('.new-trigger').focus();
}

async function saveNewCustomCommand(btn) {
  const row      = btn.closest('div');
  const trigger  = row.querySelector('.new-trigger').value.trim();
  const response = row.querySelector('.new-response').value.trim();
  if (!trigger || !response) return toast('Preencha os dois campos.', 'error');
  setLoading(btn, true);
  try {
    await post(`/api/guilds/${activeGuildId}/config/custom-commands`, { trigger, response });
    toast('Comando criado! ✅');
    await loadCustomCommands();
  } catch (err) {
    toast(err.message, 'error');
    setLoading(btn, false);
  }
}

async function deleteCustomCommand(id) {
  if (!confirm('Deletar este comando?')) return;
  try {
    await del(`/api/guilds/${activeGuildId}/config/custom-commands/${id}`);
    toast('Comando removido.');
    await loadCustomCommands();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Canais bloqueados ─────────────────────────────────────────
async function loadBlockedChannels() {
  try {
    const blocked = await get(`/api/guilds/${activeGuildId}/config/blocked-channels`);
    const box = document.getElementById('blocked-channels');
    if (!box) return;
    box.innerHTML = blocked.map(b => {
      const ch = guildChannels.find(c => c.id === b.channel_id);
      return `<span class="tag">#${ch ? ch.name : b.channel_id}
        <span class="tag-remove" onclick="removeBlockedChannel('${b.channel_id}',this)">✕</span>
      </span>`;
    }).join('');

    // Popula o select de canais
    populateChannelSelect('channel-select', guildChannels, 'Selecionar canal...');
  } catch {}
}

async function addBlockedChannel() {
  const sel = document.getElementById('channel-select');
  const channel_id = sel?.value;
  if (!channel_id || channel_id === 'Selecionar canal...') return;
  try {
    await post(`/api/guilds/${activeGuildId}/config/blocked-channels`, { channel_id });
    toast('Canal bloqueado! ✅');
    await loadBlockedChannels();
    sel.value = 'Selecionar canal...';
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function removeBlockedChannel(channelId, tagEl) {
  try {
    await del(`/api/guilds/${activeGuildId}/config/blocked-channels/${channelId}`);
    tagEl.closest('.tag').remove();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Boas-vindas ───────────────────────────────────────────────
async function loadWelcome() {
  try {
    const data = await get(`/api/guilds/${activeGuildId}/config/welcome`);
    const s = id => document.getElementById(id);

    if (s('welcome-enabled'))     s('welcome-enabled').checked     = !!data.welcome_enabled;
    if (s('welcome-channel'))     s('welcome-channel').value        = data.welcome_channel_id || '';
    if (s('welcome-message'))     s('welcome-message').value        = data.welcome_message || '';
    if (s('welcome-delete'))      s('welcome-delete').value         = data.welcome_delete_after || 0;
    if (s('leave-enabled'))       s('leave-enabled').checked        = !!data.leave_enabled;
    if (s('leave-channel'))       s('leave-channel').value          = data.leave_channel_id || '';
    if (s('leave-message'))       s('leave-message').value          = data.leave_message || '';
    if (s('leave-delete'))        s('leave-delete').value           = data.leave_delete_after || 0;

    populateChannelSelect('welcome-channel', guildChannels);
    populateChannelSelect('leave-channel',   guildChannels);
  } catch {}
}

async function saveWelcome() {
  const g = id => document.getElementById(id);
  const btn = document.querySelector('[onclick="saveWelcome()"]');
  if (btn) setLoading(btn, true);
  try {
    await put(`/api/guilds/${activeGuildId}/config/welcome`, {
      welcome_enabled:      g('welcome-enabled')?.checked,
      welcome_channel_id:   g('welcome-channel')?.value,
      welcome_message:      g('welcome-message')?.value,
      welcome_delete_after: parseInt(g('welcome-delete')?.value) || 0,
      leave_enabled:        g('leave-enabled')?.checked,
      leave_channel_id:     g('leave-channel')?.value,
      leave_message:        g('leave-message')?.value,
      leave_delete_after:   parseInt(g('leave-delete')?.value) || 0
    });
    toast('Configurações de entrada/saída salvas! ✅');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) setLoading(btn, false);
  }
}

// ── Moderação ─────────────────────────────────────────────────
async function loadModeration() {
  try {
    const data = await get(`/api/guilds/${activeGuildId}/config/moderation`);
    const s = id => document.getElementById(id);

    if (s('block-invites'))    s('block-invites').checked    = !!data.block_invites;
    if (s('log-events'))       s('log-events').checked       = !!data.log_events;
    if (s('warn-auto-punish')) s('warn-auto-punish').checked = !!data.warn_auto_punish;
    if (s('warn-limit'))       s('warn-limit').value         = data.warn_limit || 3;

    populateChannelSelect('log-channel', guildChannels);
    if (s('log-channel') && data.log_channel_id)
      s('log-channel').value = data.log_channel_id;

    const punishments = await get(`/api/guilds/${activeGuildId}/config/punishments`);
    renderPunishmentsTable(punishments);
  } catch {}
}

function renderPunishmentsTable(punishments) {
  const tbody = document.querySelector('#sub-moderacao table tbody');
  if (!tbody) return;

  const typeLabel = {
    ban:     '<span class="badge badge-red">🔨 Ban</span>',
    mute:    '<span class="badge badge-red">🔇 Mute</span>',
    warn:    '<span class="badge badge-yellow">⚠️ Aviso</span>',
    kick:    '<span class="badge badge-yellow">👢 Kick</span>',
    castigo: '<span class="badge badge-purple">⏳ Castigo</span>'
  };

  tbody.innerHTML = punishments.map(p => `
    <tr>
      <td>@${escHtml(p.user_id)}</td>
      <td>${typeLabel[p.type] || p.type}</td>
      <td>${escHtml(p.reason || '—')}</td>
      <td>${new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
      <td><button class="btn btn-ghost btn-sm">Ver</button></td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="color:var(--muted);text-align:center;">Nenhuma punição registrada.</td></tr>';
}

async function saveModeration() {
  const g   = id => document.getElementById(id);
  const btn = document.querySelector('[onclick="saveModeration()"]');
  if (btn) setLoading(btn, true);
  try {
    await put(`/api/guilds/${activeGuildId}/config/moderation`, {
      block_invites:    g('block-invites')?.checked,
      log_events:       g('log-events')?.checked,
      log_channel_id:   g('log-channel')?.value,
      warn_auto_punish: g('warn-auto-punish')?.checked,
      warn_limit:       parseInt(g('warn-limit')?.value) || 3
    });
    toast('Configurações de moderação salvas! ✅');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) setLoading(btn, false);
  }
}

// ── XP ────────────────────────────────────────────────────────
async function loadXp() {
  try {
    const data = await get(`/api/guilds/${activeGuildId}/config/xp`);
    const s = id => document.getElementById(id);

    if (s('xp-enabled'))      s('xp-enabled').checked      = !!data.xp_enabled;
    if (s('xp-per-message'))  s('xp-per-message').value    = data.xp_per_message  || 15;
    if (s('xp-cooldown'))     s('xp-cooldown').value       = data.xp_cooldown     || 60;
    if (s('xp-multiplier'))   s('xp-multiplier').value     = data.xp_multiplier   || 1;
    if (s('xp-message'))      s('xp-message').value        = data.levelup_message || '';

    populateChannelSelect('xp-channel', guildChannels);
    if (s('xp-channel') && data.levelup_channel)
      s('xp-channel').value = data.levelup_channel;
  } catch {}
}

async function saveXp() {
  const g   = id => document.getElementById(id);
  const btn = document.querySelector('[onclick="saveXp()"]');
  if (btn) setLoading(btn, true);
  try {
    await put(`/api/guilds/${activeGuildId}/config/xp`, {
      xp_enabled:      g('xp-enabled')?.checked,
      xp_per_message:  parseInt(g('xp-per-message')?.value),
      xp_cooldown:     parseInt(g('xp-cooldown')?.value),
      xp_multiplier:   parseFloat(g('xp-multiplier')?.value),
      levelup_channel: g('xp-channel')?.value,
      levelup_message: g('xp-message')?.value
    });
    toast('Configurações de XP salvas! ✅');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) setLoading(btn, false);
  }
}

// ── Prêmios do Servidor ───────────────────────────────────────
async function loadServerRewards() {
  try {
    const rewards = await get(`/api/guilds/${activeGuildId}/config/rewards`);
    const list = document.getElementById('premios-sv-list');
    if (!list) return;

    list.innerHTML = rewards.map(r => `
      <div style="display:flex;gap:10px;margin-bottom:10px;align-items:center;">
        <input class="form-input" value="${escHtml(r.name)}" style="flex:2;" readonly />
        <input class="form-input" value="${r.cost} pts" style="flex:1;" readonly />
        <button class="btn btn-danger btn-sm" onclick="deleteServerReward(${r.id})">✕</button>
      </div>
    `).join('') || '<p style="color:var(--muted);font-size:0.85rem;">Nenhum prêmio cadastrado.</p>';
  } catch {}
}

async function addServerReward() {
  const list = document.getElementById('premios-sv-list');
  const row  = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;margin-bottom:10px;align-items:center;';
  row.innerHTML = `
    <input class="form-input new-reward-name" placeholder="Nome do prêmio" style="flex:2;"/>
    <input class="form-input new-reward-cost" placeholder="Custo" type="number" style="flex:1;"/>
    <button class="btn btn-primary btn-sm" onclick="saveNewReward(this)">✓</button>
  `;
  list.appendChild(row);
}

async function saveNewReward(btn) {
  const row  = btn.closest('div');
  const name = row.querySelector('.new-reward-name').value.trim();
  const cost = parseInt(row.querySelector('.new-reward-cost').value) || 0;
  if (!name) return toast('Nome obrigatório.', 'error');
  setLoading(btn, true);
  try {
    await post(`/api/guilds/${activeGuildId}/config/rewards`, { name, cost });
    toast('Prêmio adicionado! ✅');
    await loadServerRewards();
  } catch (err) {
    toast(err.message, 'error');
    setLoading(btn, false);
  }
}

async function deleteServerReward(id) {
  if (!confirm('Remover este prêmio?')) return;
  try {
    await del(`/api/guilds/${activeGuildId}/config/rewards/${id}`);
    toast('Prêmio removido.');
    await loadServerRewards();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════
//  NOTIFICAÇÕES DO USUÁRIO
// ════════════════════════════════════════════════════════════

async function loadNotifications() {
  try {
    const data = await get('/api/user/notifications');
    const toggleMap = {
      'notif-rep':      'rep_reminder',
      'notif-marriage': 'marriage_received',
      'notif-mar-end':  'marriage_ended',
      'notif-affinity': 'affinity_low',
      'notif-renewed':  'marriage_renewed',
      'notif-letter':   'love_letter',
      'notif-level':    'level_up',
      'notif-giveaway': 'giveaway_ended'
    };
    for (const [elId, key] of Object.entries(toggleMap)) {
      const el = document.getElementById(elId);
      if (el) el.checked = !!data[key];
    }
  } catch {}
}

async function saveNotifications() {
  const btn = document.querySelector('[onclick="saveNotifications()"]');
  if (btn) setLoading(btn, true);
  try {
    await put('/api/user/notifications', {
      rep_reminder:      document.getElementById('notif-rep')?.checked,
      marriage_received: document.getElementById('notif-marriage')?.checked,
      marriage_ended:    document.getElementById('notif-mar-end')?.checked,
      affinity_low:      document.getElementById('notif-affinity')?.checked,
      marriage_renewed:  document.getElementById('notif-renewed')?.checked,
      love_letter:       document.getElementById('notif-letter')?.checked,
      level_up:          document.getElementById('notif-level')?.checked,
      giveaway_ended:    document.getElementById('notif-giveaway')?.checked
    });
    toast('Notificações salvas! ✅');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) setLoading(btn, false);
  }
}

// ════════════════════════════════════════════════════════════
//  PERSONALIZAÇÃO
// ════════════════════════════════════════════════════════════

async function loadCustomization() {
  try {
    const data = await get('/api/user/customization');
    const s = id => document.getElementById(id);
    if (s('banner-url'))    s('banner-url').value    = data.banner_url  || '';
    if (data.accent_color) {
      document.querySelectorAll('.color-swatch').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === data.accent_color);
      });
    }
  } catch {}
}

async function saveCustomization() {
  const btn = document.querySelector('[onclick="saveCustomization()"]');
  if (btn) setLoading(btn, true);
  const selectedColor = document.querySelector('.color-swatch.selected')?.dataset.color || '#c084fc';
  try {
    await put('/api/user/customization', {
      banner_url:   document.getElementById('banner-url')?.value,
      accent_color: selectedColor
    });
    toast('Personalização salva! ✅');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) setLoading(btn, false);
  }
}

// ════════════════════════════════════════════════════════════
//  LAYOUT DO PERFIL
// ════════════════════════════════════════════════════════════

async function loadLayout() {
  try {
    const data = await get('/api/user/customization');
    document.querySelectorAll('.layout-opt').forEach(el => {
      el.classList.toggle('selected', el.dataset.layout === data.profile_layout);
    });
    const s = id => document.getElementById(id);
    if (s('layout-show-xp'))      s('layout-show-xp').checked      = !!data.show_xp;
    if (s('layout-show-rep'))     s('layout-show-rep').checked      = !!data.show_rep;
    if (s('layout-show-marriage'))s('layout-show-marriage').checked = !!data.show_marriage;
    if (s('layout-show-rewards')) s('layout-show-rewards').checked  = !!data.show_rewards;
  } catch {}
}

async function saveLayout() {
  const btn = document.querySelector('[onclick="saveLayout()"]');
  if (btn) setLoading(btn, true);
  const layout = document.querySelector('.layout-opt.selected')?.dataset.layout || 'default';
  try {
    await put('/api/user/customization', {
      profile_layout: layout,
      show_xp:        document.getElementById('layout-show-xp')?.checked,
      show_rep:       document.getElementById('layout-show-rep')?.checked,
      show_marriage:  document.getElementById('layout-show-marriage')?.checked,
      show_rewards:   document.getElementById('layout-show-rewards')?.checked
    });
    toast('Layout salvo! ✅');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) setLoading(btn, false);
  }
}

// ════════════════════════════════════════════════════════════
//  REPUTAÇÕES
// ════════════════════════════════════════════════════════════

async function loadReputations() {
  try {
    const data = await get('/api/user/reputations');
    const nums = document.querySelectorAll('#view-reputacoes .stat-box-num');
    if (nums[0]) nums[0].textContent = data.received_count;
    if (nums[1]) nums[1].textContent = data.given_count;

    const tbody = document.querySelector('#view-reputacoes table tbody');
    if (!tbody) return;
    tbody.innerHTML = data.received.slice(0, 20).map(r => `
      <tr>
        <td>@${escHtml(r.from_id)}</td>
        <td>${escHtml(r.guild_id || '—')}</td>
        <td>${new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
      </tr>
    `).join('') || '<tr><td colspan="3" style="color:var(--muted);text-align:center;">Sem reputações ainda.</td></tr>';
  } catch {}
}

// ════════════════════════════════════════════════════════════
//  API KEY
// ════════════════════════════════════════════════════════════

let realApiKey = null;
let apiVisible  = false;

async function loadApiKey() {
  try {
    const data = await get('/api/user/api-key');
    realApiKey = data.api_key;
    updateApiKeyDisplay();
  } catch {}
}

function updateApiKeyDisplay() {
  const el = document.getElementById('api-key-val');
  if (!el) return;
  el.textContent = apiVisible ? realApiKey : 'kryna_sk_' + '●'.repeat(24);
}

function toggleApiKey() {
  apiVisible = !apiVisible;
  updateApiKeyDisplay();
}

async function copyApiKey() {
  if (!realApiKey) return;
  await navigator.clipboard.writeText(realApiKey);
  toast('Chave copiada! 📋');
}

async function regenApiKey() {
  if (!confirm('Gerar nova chave? A chave atual será invalidada.')) return;
  try {
    const data = await post('/api/user/api-key/regenerate');
    realApiKey = data.api_key;
    apiVisible = true;
    updateApiKeyDisplay();
    toast('Nova chave gerada! ✅');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════
//  HELPERS DE SELECTS
// ════════════════════════════════════════════════════════════

function populateChannelSelect(selectId, channels, placeholder = 'Selecionar canal...') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    channels
      .filter(c => c.type === 0) // só texto
      .map(c => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>#${escHtml(c.name)}</option>`)
      .join('');
}

function populateRoleSelect(selectId, roles, placeholder = 'Selecionar cargo...') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    roles.map(r => `<option value="${r.id}" ${r.id === current ? 'selected' : ''}>${escHtml(r.name)}</option>`).join('');
}

// ════════════════════════════════════════════════════════════
//  NAVEGAÇÃO
// ════════════════════════════════════════════════════════════

const viewLoaders = {
  servidores:      loadGuilds,
  notificacoes:    loadNotifications,
  personalizacao:  loadCustomization,
  layout:          loadLayout,
  reputacoes:      loadReputations,
  api:             loadApiKey
};

const subLoaders = {
  'visao-geral':  loadServerOverview,
  'prefixo':      loadPrefixConfig,
  'comandos':     loadBlockedChannels,
  'comunidade':   loadWelcome,
  'moderacao':    loadModeration,
  'experiencia':  loadXp,
  'premios-sv':   loadServerRewards
};

document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.addEventListener('click', async () => {
    const v = item.dataset.view;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById('view-' + v)?.classList.add('active');

    const titles = {
      servidores: 'Seus Servidores', loja: 'Loja', premios: 'Prêmios Pessoais',
      personalizacao: 'Personalização', notificacoes: 'Notificações',
      layout: 'Layout do Perfil', reputacoes: 'Reputações',
      api: 'API', diretrizes: 'Diretrizes da Comunidade'
    };
    document.getElementById('topbar-title').textContent = titles[v] || '';

    if (viewLoaders[v]) await viewLoaders[v]();
  });
});

document.querySelectorAll('.subnav-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.subnav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showSub(btn.dataset.sub);
    if (subLoaders[btn.dataset.sub]) await subLoaders[btn.dataset.sub]();
  });
});

function showSub(name) {
  document.querySelectorAll('.sub-view').forEach(sv => sv.style.display = 'none');
  const el = document.getElementById('sub-' + name);
  if (el) el.style.display = 'block';
}

function goBack() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-servidores').classList.add('active');
  document.getElementById('topbar-title').textContent = 'Seus Servidores';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-view="servidores"]')?.classList.add('active');
}

function updatePreview() {
  const el = document.getElementById('preview-prefix');
  if (el) el.textContent = document.getElementById('prefix-input')?.value || '!';
}

// ════════════════════════════════════════════════════════════
//  MODAL "ADICIONAR CRINA"
// ════════════════════════════════════════════════════════════

function openAddModal(guildId, name) {
  document.getElementById('modal-server-name').textContent = name;
  document.getElementById('modal-add').classList.add('open');
  document.getElementById('modal-add').dataset.guildId = guildId;
}

function closeModal() {
  document.getElementById('modal-add').classList.remove('open');
}

function addBot() {
  const guildId    = document.getElementById('modal-add').dataset.guildId;
  const clientId   = '{{ SEU_CLIENT_ID }}'; // será substituído dinamicamente
  const permissions = '8'; // Administrator — ajuste se quiser menos
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands&guild_id=${guildId}`;
  window.open(url, '_blank');
  closeModal();
}

document.getElementById('modal-add')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ════════════════════════════════════════════════════════════
//  TOAST CSS (injetado via JS para não precisar de arquivo extra)
// ════════════════════════════════════════════════════════════

const style = document.createElement('style');
style.textContent = `
  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    padding: 12px 20px;
    border-radius: 12px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    font-weight: 500;
    animation: slideInToast 0.3s ease, fadeOutToast 0.4s ease 2.8s forwards;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  }
  .toast-success { background: #1a2e22; color: #34d399; border: 1px solid rgba(52,211,153,0.3); }
  .toast-error   { background: #2e1a1a; color: #f87171; border: 1px solid rgba(248,113,113,0.3); }
  @keyframes slideInToast {
    from { opacity:0; transform: translateY(20px); }
    to   { opacity:1; transform: translateY(0); }
  }
  @keyframes fadeOutToast {
    to { opacity:0; transform: translateY(10px); }
  }
`;
document.head.appendChild(style);

// ════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ════════════════════════════════════════════════════════════

(async () => {
  await loadUser();
  await loadGuilds();
})();
