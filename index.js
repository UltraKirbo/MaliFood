const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collection
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages, // nécessaire pour messageCreate
        GatewayIntentBits.MessageContent // nécessaire pour lire le contenu des messages
    ],
    partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;; // met ton token ici ou utilise process.env.TOKEN
const ROLE_A_GARDER = '789187163975581717';
const SALON_VOCAL_ID = '830510767681830922';
const DUREE_VOTE = 60000; // 60 secondes de vote
const PREFIX = "!"; // préfixe classique

client.once('ready', () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// Fonction commune pour gérer le vote
async function lancerVote(member, interactionOrMessage) {
    // Créer les boutons
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('vote_yes')
            .setLabel('✅ Oui')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('vote_no')
            .setLabel('❌ Non')
            .setStyle(ButtonStyle.Danger)
    );

    const voteText = `@everyone 🗳️ Vote pour réinitialiser les rôles de **${member.user.tag}** ! Vous avez ${DUREE_VOTE / 1000}s pour voter !`;

    const replyOptions = {
        content: voteText,
        components: [row],
        allowedMentions: { parse: ['everyone'] }, // permet de ping @everyone
        fetchReply: true
    };

    // Répond selon type (slash ou message)
    const voteMessage = interactionOrMessage.reply
        ? await interactionOrMessage.reply(replyOptions)
        : await interactionOrMessage.channel.send(replyOptions);

    const votes = new Collection();

    const collector = voteMessage.createMessageComponentCollector({
        componentType: 'BUTTON',
        time: DUREE_VOTE
    });

    collector.on('collect', i => {
        if (!i.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return i.reply({ content: "🚫 Tu ne peux pas voter.", ephemeral: true });
        }
        votes.set(i.user.id, i.customId);
        i.reply({ content: `✅ Vote enregistré : ${i.customId === 'vote_yes' ? 'Oui' : 'Non'}`, ephemeral: true });
    });

    collector.on('end', async () => {
        const oui = votes.filter(v => v === 'vote_yes').size;
        const non = votes.filter(v => v === 'vote_no').size;

        if (oui > non) {
            const rolesToRemove = member.roles.cache.filter(
                role => role.id !== ROLE_A_GARDER && role.id !== member.guild.id
            );
            try {
                await member.roles.remove(rolesToRemove);
                await member.roles.add(ROLE_A_GARDER);
                if (member.voice?.channel) {
                    await member.voice.setChannel(SALON_VOCAL_ID);
                }
                voteMessage.edit({ content: `✅ Vote terminé : action validée (${oui}✅ vs ${non}❌)`, components: [] });
            } catch (err) {
                console.error(err);
                voteMessage.edit({ content: "❌ Impossible d'appliquer les changements.", components: [] });
            }
        } else {
            voteMessage.edit({ content: `❌ Vote terminé : action annulée (${oui}✅ vs ${non}❌)`, components: [] });
        }
    });
}

// Slash command
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'Goulag') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({ content: "🚫 Tu n'as pas la permission de gérer les rôles.", ephemeral: true });
        }

        const member = interaction.options.getMember('utilisateur');
        if (!member) return interaction.reply({ content: "⚠️ Utilisateur introuvable.", ephemeral: true });

        await lancerVote(member, interaction);
    }
});

// Commande classique avec préfixe
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "Goulag") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.reply("🚫 Tu n'as pas la permission de gérer les rôles !");
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply("⚠️ Mentionne un utilisateur : `!resetroles @pseudo`");

        await lancerVote(member, message);
    }
});

client.login(TOKEN);
