const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collection,
    ComponentType
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;
const ROLE_A_GARDER = '1416179767899848714';
const SALON_VOCAL_ID = '1416180566193213561';
const DUREE_VOTE_DEFAUT = 30; // durée par défaut en secondes
const PREFIX = "!";

client.once('ready', () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// Fonction commune pour lancer le vote
async function lancerVote(member, interactionOrMessage, dureeVote) {
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

    const voteMessage = await interactionOrMessage.channel.send({
        content: `@everyone 🗳️ Vote pour réinitialiser les rôles de **${member.user.tag}** !\n⏱️ Durée : **${Math.round(dureeVote / 60000)} minute(s)**`,
        components: [row]
    });

    const votes = new Collection();

    const collector = voteMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: dureeVote
    });

    collector.on('collect', async i => {
        // Tout le monde peut voter mais une seule fois
        if (votes.has(i.user.id)) {
            return i.reply({ content: "⚠️ Tu as déjà voté !", ephemeral: true });
        }

        votes.set(i.user.id, i.customId);
        await i.reply({
            content: `✅ Vote enregistré : ${i.customId === 'vote_yes' ? 'Oui' : 'Non'}`,
            ephemeral: true
        });
    });

    collector.on('end', async () => {
        const oui = votes.filter(v => v === 'vote_yes').size;
        const non = votes.filter(v => v === 'vote_no').size;

        if (oui > non) {
            try {
                const rolesToRemove = member.roles.cache.filter(
                    role => role.id !== ROLE_A_GARDER && role.id !== member.guild.id
                );
                await member.roles.remove(rolesToRemove);
                await member.roles.add(ROLE_A_GARDER);
                if (member.voice?.channel) {
                    await member.voice.setChannel(SALON_VOCAL_ID);
                }
                await voteMessage.edit({
                    content: `✅ Vote terminé : action validée (${oui}✅ vs ${non}❌)`,
                    components: []
                });
            } catch (err) {
                console.error(err);
                await voteMessage.edit({ content: "❌ Impossible d'appliquer les changements.", components: [] });
            }
        } else {
            await voteMessage.edit({
                content: `❌ Vote terminé : action annulée (${oui}✅ vs ${non}❌)`,
                components: []
            });
        }
    });
}

// Slash command /Goulag
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'Goulag') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({ content: "🚫 Tu n'as pas la permission de gérer les rôles.", ephemeral: true });
        }

        const member = interaction.options.getMember('utilisateur');
        if (!member) return interaction.reply({ content: "⚠️ Utilisateur introuvable.", ephemeral: true });

        // Durée par défaut pour slash command (peut être amélioré pour option)
        await lancerVote(member, interaction, DUREE_VOTE_DEFAUT * 1000);
    }
});

// Commande classique !Goulag
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "goulag") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.reply("🚫 Tu n'as pas la permission de gérer les rôles !");
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply("⚠️ Mentionne un utilisateur : `!Goulag @pseudo [minutes]`");

        // Récupérer la durée en minutes après la mention
        const dureeMinutes = parseFloat(args[1]);
        const dureeVote = !isNaN(dureeMinutes) && dureeMinutes > 0
            ? dureeMinutes * 60 * 1000
            : DUREE_VOTE_DEFAUT * 1000;

        await lancerVote(member, message, dureeVote);
    }
});

client.login(TOKEN);
