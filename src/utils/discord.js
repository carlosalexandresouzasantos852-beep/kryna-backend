// src/utils/discord.js
// Funções para buscar dados do Discord (guilds, canais, cargos)
// e executar ações no bot via discord.js

const axios  = require('axios');
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const DISCORD_API = 'https://discord.com/api/v10';

// ── Cliente do Bot ───────────────────────────────────────────────────────────
const botClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ]
});

botClient.once('ready', () => {
  console.log(`[Bot] Logado como ${botClient.user.tag}`);
});

async function startBot() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.warn('[Bot] BOT_TOKEN não configurado — bot offline.');
    return;
  }
  await botClient.login(process.env.DISCORD_BOT_TOKEN);
}

// ── Funções de API do Discord (OAuth2 do usuário) ───────────────────────────

/**
 * Busca os servidores do usuário via API do Discord
 * usando o access_token dele (não o bot)
 */
async function getUserGuilds(accessToken) {
  const { data } = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return data;
}

/**
 * Filtra os servidores onde o usuário é DONO ou tem ADMINISTRADOR
 * e verifica em quais o bot já está presente
 */
async function getManageableGuilds(accessToken) {
  const userGuilds = await getUserGuilds(accessToken);

  // Servidores onde o usuário tem permissão de administrador ou é dono
  const manageable = userGuilds.filter(g => {
    const perms = BigInt(g.permissions);
    return g.owner || (perms & BigInt(PermissionsBitField.Flags.Administrator)) !== 0n;
  });

  // Verifica quais têm o bot (bot só conhece guilds onde está)
  const botGuildIds = new Set(botClient.guilds.cache.map(g => g.id));

  return manageable.map(g => ({
    id:       g.id,
    name:     g.name,
    icon:     g.icon
      ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
      : null,
    owner:    g.owner,
    hasBot:   botGuildIds.has(g.id),
    memberCount: botClient.guilds.cache.get(g.id)?.memberCount || 0
  }));
}

// ── Funções do Bot (via discord.js) ─────────────────────────────────────────

/** Retorna os canais de texto de um servidor */
async function getGuildChannels(guildId) {
  const guild = botClient.guilds.cache.get(guildId);
  if (!guild) return [];

  await guild.channels.fetch();
  return guild.channels.cache
    .filter(c => c.type === 0 || c.type === 2) // 0 = text, 2 = voice
    .map(c => ({ id: c.id, name: c.name, type: c.type }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Retorna os cargos de um servidor */
async function getGuildRoles(guildId) {
  const guild = botClient.guilds.cache.get(guildId);
  if (!guild) return [];

  await guild.roles.fetch();
  return guild.roles.cache
    .filter(r => r.name !== '@everyone')
    .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
    .sort((a, b) => b.rawPosition - a.rawPosition);
}

/** Bane um usuário via bot */
async function banUser(guildId, userId, reason, days = 0) {
  const guild = botClient.guilds.cache.get(guildId);
  if (!guild) throw new Error('Servidor não encontrado.');
  await guild.members.ban(userId, { reason, deleteMessageDays: days });
}

/** Remove o ban de um usuário */
async function unbanUser(guildId, userId) {
  const guild = botClient.guilds.cache.get(guildId);
  if (!guild) throw new Error('Servidor não encontrado.');
  await guild.members.unban(userId);
}

/** Silencia (mute) um membro */
async function muteUser(guildId, userId, muteRoleId) {
  const guild  = botClient.guilds.cache.get(guildId);
  if (!guild) throw new Error('Servidor não encontrado.');
  const member = await guild.members.fetch(userId);
  await member.roles.add(muteRoleId);
}

/** Remove o mute */
async function unmuteUser(guildId, userId, muteRoleId) {
  const guild  = botClient.guilds.cache.get(guildId);
  if (!guild) throw new Error('Servidor não encontrado.');
  const member = await guild.members.fetch(userId);
  await member.roles.remove(muteRoleId);
}

/** Dá um cargo a um membro */
async function addRole(guildId, userId, roleId) {
  const guild  = botClient.guilds.cache.get(guildId);
  if (!guild) throw new Error('Servidor não encontrado.');
  const member = await guild.members.fetch(userId);
  await member.roles.add(roleId);
}

/** Remove um cargo de um membro */
async function removeRole(guildId, userId, roleId) {
  const guild  = botClient.guilds.cache.get(guildId);
  if (!guild) throw new Error('Servidor não encontrado.');
  const member = await guild.members.fetch(userId);
  await member.roles.remove(roleId);
}

/** Trava um canal (remove permissão de envio para @everyone) */
async function lockChannel(channelId, guildId) {
  const guild   = botClient.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel) throw new Error('Canal não encontrado.');
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    SendMessages: false
  });
}

/** Destrava um canal */
async function unlockChannel(channelId, guildId) {
  const guild   = botClient.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel) throw new Error('Canal não encontrado.');
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    SendMessages: null
  });
}

/** Deleta N mensagens de um canal (até 100, máx 14 dias) */
async function purgeMessages(channelId, guildId, amount) {
  const guild   = botClient.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel) throw new Error('Canal não encontrado.');
  const deleted = await channel.bulkDelete(Math.min(amount, 100), true);
  return deleted.size;
}

/** Envia um aviso em um canal */
async function sendAnnouncement(channelId, guildId, embed) {
  const guild   = botClient.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel) throw new Error('Canal não encontrado.');
  await channel.send(embed);
}

/** Atualiza o nome de um canal contador */
async function updateCounterChannel(channelId, guildId, template, count) {
  const guild   = botClient.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel) throw new Error('Canal não encontrado.');
  const newName = template.replace('{count}', count);
  await channel.setName(newName);
}

module.exports = {
  botClient,
  startBot,
  getUserGuilds,
  getManageableGuilds,
  getGuildChannels,
  getGuildRoles,
  banUser,
  unbanUser,
  muteUser,
  unmuteUser,
  addRole,
  removeRole,
  lockChannel,
  unlockChannel,
  purgeMessages,
  sendAnnouncement,
  updateCounterChannel
};
