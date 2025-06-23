require('dotenv').config();
const fs = require('fs-extra');
const {
  Client, GatewayIntentBits, Partials,
  EmbedBuilder, REST, Routes,
  SlashCommandBuilder, AttachmentBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, Events
} = require('discord.js');

const XP_FILE = './xp_data.json';
let userData = fs.existsSync(XP_FILE) ? fs.readJSONSync(XP_FILE) : {};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Role & Channel config
const SPECIAL_ROLE_ID = '1384176365019861123';
const VIP_ROLE_ID = '1385654143192141945';
const AUTO_ROLE_ID = '1384488260662726676';

const abusiveWords = ["chutiya", "madarchod", "gandu", "bokachoda", "mc", "bc", "fuck","RANDI","shit"];
const linkKeywords = ["http://", "www","https://", "discord.gg/", "discord.com/invite/", "bit.ly", "tinyurl.com"];

const allowedLinkChannels = new Set();
const welcomeChannels = new Map();
const leaveChannels = new Map();

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
});

// Welcome + Auto Role
client.on('guildMemberAdd', async member => {
  const role = member.guild.roles.cache.get(AUTO_ROLE_ID);
  if (role) await member.roles.add(role).catch(() => {});
  const channel = welcomeChannels.get(member.guild.id);
  if (channel) channel.send(`👋 Welcome ${member.user} to **${member.guild.name}**!`);
});

client.on('guildMemberRemove', async member => {
  const channel = leaveChannels.get(member.guild.id);
  if (channel) channel.send(`👋 ${member.user.tag} has left the server.`);
});

// XP, Abuse, Links
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  const isVip = message.member.roles.cache.has(VIP_ROLE_ID);
  const content = message.content.toLowerCase();

  if (!isVip) {
    if (!allowedLinkChannels.has(message.channel.id) && linkKeywords.some(k => content.includes(k))) {
      await message.delete().catch(() => {});
      await message.member.timeout(60_000, 'Sent blocked link');
      return message.author.send("🚫 You were timed out for 1 minute for sending a restricted link.");
    }

    if (abusiveWords.some(w => content.includes(w))) {
      await message.delete().catch(() => {});
      return message.channel.send(`🚫 <@${message.author.id}>, abusive language is not allowed!`).then(m => setTimeout(() => m.delete(), 5000));
    }

    const uid = message.author.id;
    userData[uid] = userData[uid] || { xp: 0, level: 1 };
    userData[uid].xp += Math.floor(Math.random() * 11 + 5);
    if (userData[uid].xp >= userData[uid].level * 100) {
      userData[uid].level++;
      userData[uid].xp = 0;
      message.channel.send(`🎉 <@${uid}> leveled up to **Level ${userData[uid].level}**!`);
    }
    await fs.writeJSON(XP_FILE, userData);
  }
});

// Slash Commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const isAdmin = interaction.member.roles.cache.has(SPECIAL_ROLE_ID);

  const cmd = interaction.commandName;
  const channel = interaction.channel;

  if (cmd === 'linkallow') {
    if (!isAdmin) return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
    allowedLinkChannels.add(channel.id);
    return interaction.reply({ content: '✅ Links allowed in this channel.', ephemeral: true });

  } else if (cmd === 'linkremove') {
    if (!isAdmin) return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
    allowedLinkChannels.delete(channel.id);
    return interaction.reply({ content: '✅ Links blocked in this channel.', ephemeral: true });

  } else if (cmd === 'setupwelcome') {
    if (!isAdmin) return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
    welcomeChannels.set(interaction.guild.id, channel);
    return interaction.reply({ content: '✅ Welcome channel set.', ephemeral: true });

  } else if (cmd === 'setupleave') {
    if (!isAdmin) return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
    leaveChannels.set(interaction.guild.id, channel);
    return interaction.reply({ content: '✅ Leave channel set.', ephemeral: true });

  } else if (cmd === 'rank') {
    const data = userData[interaction.user.id];
    if (!data) return interaction.reply({ content: '❌ No XP data found.', ephemeral: true });
    const embed = new EmbedBuilder()
      .setTitle("📊 Your Rank")
      .addFields({ name: "Level", value: `${data.level}`, inline: true }, { name: "XP", value: `${data.xp}/${data.level * 100}`, inline: true })
      .setColor(0x00ff00);
    return interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (cmd === 'leaderboard') {
    const sorted = Object.entries(userData).sort(([, a], [, b]) => b.level - a.level || b.xp - a.xp).slice(0, 10);
    const embed = new EmbedBuilder().setTitle("🏆 Leaderboard").setColor(0xffaa00);
    for (let i = 0; i < sorted.length; i++) {
      const [uid, stats] = sorted[i];
      const user = await client.users.fetch(uid).catch(() => null);
      embed.addFields({ name: `#${i + 1} ${user ? user.tag : 'Unknown'}`, value: `Level: ${stats.level} | XP: ${stats.xp}` });
    }
    return interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (cmd === 'love') {
    const user1 = interaction.options.getUser('user1');
    const user2 = interaction.options.getUser('user2');
    const score = Math.floor(Math.random() * 100) + 1;
    const bar = '❤️'.repeat(score / 10) + '🤍'.repeat(10 - score / 10);
    const mood = score > 90 ? "💞 Soulmates!" : score > 70 ? "💕 Beautiful match!" : score > 50 ? "💛 Worth a try!" : score > 30 ? "🧡 There's potential." : "💔 Just friends maybe.";
    const embed = new EmbedBuilder()
      .setTitle("💘 Love Compatibility")
      .setDescription(`${user1} ❤️ ${user2}\n**Score:** ${score}%\n${bar}\n${mood}`)
      .setThumbnail(user1.displayAvatarURL())
      .setImage(user2.displayAvatarURL())
      .setColor(0xff66aa);
    interaction.reply({ embeds: [embed] });

  } else if (cmd === 'sendpanelprice') {
    if (!isAdmin) return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
    const embed = new EmbedBuilder()
      .setTitle("💸 Noxx Cheats Pricing")
      .setDescription("**🚀 PREMIUM PANEL**\n1 Week – 500 BDT\n1 Month – 1000 BDT\nLifetime – 2500 BDT\n...")
      .setColor(0xff0000);
    channel.send({ embeds: [embed] });
    interaction.reply({ content: '✅ Panel price sent.', ephemeral: true });

  } else if (cmd === 'senddiscount') {
    if (!isAdmin) return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
    const discount = Math.floor(Math.random() * 26) + 5;
    const embed = new EmbedBuilder().setTitle("🎉 Special Discount").setDescription(`🔥 **${discount}% OFF** on panels!`).setColor(0x00ff00);
    channel.send({ embeds: [embed] });
    interaction.reply({ content: '✅ Discount sent.', ephemeral: true });

  } else if (cmd === 'sourceprice') {
    if (!isAdmin) return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
    const embed = new EmbedBuilder()
      .setTitle("🧠 Bot Source Prices")
      .setDescription("**JWT Token Generator** – 900 INR\n**Info Bot** – 500 INR\n...")
      .setColor(0x3399ff);
    channel.send({ embeds: [embed] });
    interaction.reply({ content: '✅ Source price sent.', ephemeral: true });

  } else if (cmd === 'announce') {
    if (!isAdmin) return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
    const msg = interaction.options.getString('message');
    const link = interaction.options.getString('link');
    const files = ['attachment1', 'attachment2', 'attachment3'].map(n => interaction.options.getAttachment(n)).filter(Boolean);
    const embed = new EmbedBuilder().setTitle("📢 Announcement").setDescription(msg).setColor(0xffcc00);
    if (link) embed.addFields({ name: "🔗 Link", value: link });
    channel.send({ embeds: [embed], files: await Promise.all(files.map(f => AttachmentBuilder.from(f.url))) });
    interaction.reply({ content: '✅ Announcement sent.', ephemeral: true });
  }
});

// `!help` command
client.on(Events.MessageCreate, async message => {
  if (message.content === "!help") {
    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
      .setCustomId('help')
      .setPlaceholder("Select a category")
      .addOptions([
        { label: '🎉 General', value: 'general' },
        { label: '⚙️ Admin', value: 'admin' },
        { label: '💖 Fun', value: 'fun' },
        { label: '📢 Announcement', value: 'announce' },
      ]));
    const embed = new EmbedBuilder().setTitle("📘 Help Menu").setDescription("Choose a category below").setColor(0x00cc99);
    await message.reply({ embeds: [embed], components: [row] });
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isSelectMenu() || interaction.customId !== 'help') return;
  const value = interaction.values[0];
  const embed = new EmbedBuilder().setTitle("📘 Help");
  if (value === 'general') embed.addFields({ name: "/rank, /leaderboard", value: "XP system" });
  if (value === 'admin') embed.addFields({ name: "/setupwelcome", value: "Set welcome/leave/panel config" });
  if (value === 'fun') embed.addFields({ name: "/love", value: "Test love between 2 users" });
  if (value === 'announce') embed.addFields({ name: "/announce", value: "Send announcements" });
  await interaction.update({ embeds: [embed], components: interaction.message.components });
});

// Register slash commands
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName('linkallow').setDescription('Allow links here'),
    new SlashCommandBuilder().setName('linkremove').setDescription('Block links here'),
    new SlashCommandBuilder().setName('setupwelcome').setDescription('Set this channel as welcome'),
    new SlashCommandBuilder().setName('setupleave').setDescription('Set this channel as leave'),
    new SlashCommandBuilder().setName('rank').setDescription('View your XP & level'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 XP users'),
    new SlashCommandBuilder().setName('love')
      .setDescription('Check love between users')
      .addUserOption(o => o.setName('user1').setDescription('First user').setRequired(true))
      .addUserOption(o => o.setName('user2').setDescription('Second user').setRequired(true)),
    new SlashCommandBuilder().setName('sendpanelprice').setDescription('Send panel pricing (admin)'),
    new SlashCommandBuilder().setName('senddiscount').setDescription('Send random discount (admin)'),
    new SlashCommandBuilder().setName('sourceprice').setDescription('Send source prices (admin)'),
    new SlashCommandBuilder().setName('announce')
      .setDescription('Send announcement')
      .addStringOption(o => o.setName('message').setDescription('Message text').setRequired(true))
      .addStringOption(o => o.setName('link').setDescription('Optional link').setRequired(false))
      .addAttachmentOption(o => o.setName('attachment1').setDescription('File 1'))
      .addAttachmentOption(o => o.setName('attachment2').setDescription('File 2'))
      .addAttachmentOption(o => o.setName('attachment3').setDescription('File 3')),
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = (await rest.get(Routes.user())).id;

  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(appId, guild.id), { body: commands.map(c => c.toJSON()) });
  }
}

client.login(process.env.DISCORD_TOKEN);
