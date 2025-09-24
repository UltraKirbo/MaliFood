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
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel]
});

const TOKEN = 'TON_TOKEN_ICI';
const ROLE_A_GARDER = 'ID_DU_ROLE_A_GARDER';
const SALON_VOCAL_ID = 'ID_DU_SALON_VOCAL';
const DUREE_VOTE = 30000; // 30 secondes de vote

client.once('ready', () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'resetroles') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({ content: "🚫 Tu n'as pas la permission de gérer les rôles.", ephemeral: true });
        }

        const member = interaction.options.getMember('utilisateur');
        if (!member) return interaction.reply({ content: "⚠️ Utilisateur introuvable.", ephemeral: true });

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

        const voteMessage = await interaction.reply({
            content: `🗳️ Vote pour réinitialiser les rôles de **${member.user.tag}**. Vous avez ${DUREE_VOTE / 1000}s pour voter !`,
            components: [row],
            fetchReply: true
        });

        // Collection pour suivre les votes (userId -> vote)
        const votes = new Collection();

        const collector = voteMessage.createMessageComponentCollector({
            componentType: 'BUTTON',
            time: DUREE_VOTE
        });

        collector.on('collect', i => {
            // Vérifie que l'utilisateur a la permission
            if (!i.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return i.reply({ content: "🚫 Tu ne peux pas voter.", ephemeral: true });
            }

            // Enregistre le vote
            votes.set(i.user.id, i.customId);
            i.reply({ content: `✅ Vote enregistré : ${i.customId === 'vote_yes' ? 'Oui' : 'Non'}`, ephemeral: true });
        });

        collector.on('end', async () => {
            const oui = votes.filter(v => v === 'vote_yes').size;
            const non = votes.filter(v => v === 'vote_no').size;

            if (oui > non) {
                // Action validée
                const rolesToRemove = member.roles.cache.filter(role =>
                    role.id !== ROLE_A_GARDER && role.id !== interaction.guild.id
                );
                try {
                    await member.roles.remove(rolesToRemove);
                    await member.roles.add(ROLE_A_GARDER);
                    if (member.voice?.channel) {
                        await member.voice.setChannel(SALON_VOCAL_ID);
                    }
                    await voteMessage.edit({ content: `✅ Vote terminé : action validée (${oui}✅ vs ${non}❌)`, components: [] });
                } catch (err) {
                    console.error(err);
                    await voteMessage.edit({ content: "❌ Impossible d'appliquer les changements.", components: [] });
                }
            } else {
                await voteMessage.edit({ content: `❌ Vote terminé : action annulée (${oui}✅ vs ${non}❌)`, components: [] });
            }
        });
    }
});

client.login(TOKEN);
