const { Client, Intents, MessageEmbed } = require('discord.js');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const intents = new Intents([
  Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_MEMBERS,
  Intents.FLAGS.GUILD_BANS,
  Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
  Intents.FLAGS.GUILD_INTEGRATIONS,
  Intents.FLAGS.GUILD_WEBHOOKS,
  Intents.FLAGS.GUILD_INVITES,
  Intents.FLAGS.GUILD_VOICE_STATES,
  Intents.FLAGS.GUILD_PRESENCES,
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  Intents.FLAGS.GUILD_MESSAGE_TYPING,
  Intents.FLAGS.DIRECT_MESSAGES,
  Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
  Intents.FLAGS.DIRECT_MESSAGE_TYPING
]);

const client = new Client({ intents });
const prefix = '!';

client.once('ready', () => {
  console.log('Bot prêt');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.type === 'DM') return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Vérification du salon pour utiliser les commandes !gen, !stock et !restock
  const allowedGenChannelId = 'id du salon gen'; // ID du salon autorisé pour !gen
  const allowedStockChannelId = 'id du salon stock'; // ID du salon autorisé pour !stock
  const allowedRestockUser = 'id de l'utilisateur admin'; // ID de l'utilisateur autorisé pour !restock
  const allowedDeleteUser = 'id de l'utilisateur admin; // ID de l'utilisateur autorisé pour !delete
  const allowedDelStockUser = 'id de l'utilisateur admin'; // ID de l'utilisateur autorisé pour !delstock

  if (command === 'create' && message.author.id === allowedRestockUser) {
    const serviceName = args[0] ? args[0].toLowerCase() : null;
    if (!serviceName) {
      return message.reply('Utilisation : !create {nomduservice}');
    }

    const filePath = path.join('./stock', `${serviceName}.txt`);
    if (fs.existsSync(filePath)) {
      const embed = new MessageEmbed()
        .setColor('YELLOW')
        .setTitle('Service déjà créé')
        .setDescription(`Le service que vous essayez de créer existe déjà.`);
      return message.channel.send({ embeds: [embed] });
    }

    fs.writeFileSync(filePath, ''); // Crée un fichier vide

    const embed = new MessageEmbed()
      .setColor('GREEN')
      .setTitle(`Création du service ${serviceName}`)
      .setDescription(`Le service ${serviceName} a été créé avec succès.`);
    message.channel.send({ embeds: [embed] });
  }

  if (command === 'restock' && message.author.id === allowedRestockUser) {
    const serviceName = args[0] ? args[0].toLowerCase() : null;
    if (!serviceName) {
      return message.reply('Utilisation : !restock {nomduservice}');
    }

    const attachment = message.attachments.first();
    if (attachment && attachment.name.endsWith('.txt')) {
      // Nouveau système avec fichier .txt
      const linesToAdd = (await fetchAttachment(attachment.url)).trim();
      if (linesToAdd.length === 0) {
        const emptyEmbed = new MessageEmbed()
          .setColor('YELLOW')
          .setTitle('Fichier vide')
          .setDescription('Le fichier attaché est vide.');
        return message.channel.send({ embeds: [emptyEmbed] });
      }

      restockService = serviceName;

      try {
        const filePath = path.join('./stock', `${serviceName}.txt`);
        const existingLines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
        const newLinesCount = linesToAdd.split('\n').filter(Boolean).length;

        fs.appendFileSync(filePath, `\n${linesToAdd}`);
        const confirmEmbed = new MessageEmbed()
          .setColor('GREEN')
          .setTitle(`Restock de compte ${serviceName}`)
          .setDescription(`Les ${newLinesCount} comptes ont été ajoutés au service ${serviceName}.`);
        message.channel.send({ embeds: [confirmEmbed] });

        // Envoi de l'embed dans le canal de restock
        const restockChannel = client.channels.cache.get('id du salon restock'); // ID du canal pour les restocks
        if (restockChannel) {
          const embed = new MessageEmbed()
            .setColor('GREEN')
            .setTitle(`Restock du service ${serviceName}`)
            .setDescription(`${newLinesCount} compte(s) ajouté(s). Comptes restants : ${existingLines.length + newLinesCount}`)
            .addField('Redirection', `<#id du salons gen>`);
          restockChannel.send({ embeds: [embed], content: '<@&id du rôle a ping au restock>' }); // Ping du rôle
        }
      } catch (error) {
        console.error(error);
        const errorEmbed = new MessageEmbed()
          .setColor('RED')
          .setTitle(`Erreur`)
          .setDescription(`Une erreur est survenue lors du restock du service ${serviceName}.`);
        message.channel.send({ embeds: [errorEmbed] });
      }
    } else {
      // Ancien système sans fichier .txt
      restockUser = message.author.id;
      restockService = serviceName;

      const embed = new MessageEmbed()
        .setColor('BLUE')
        .setTitle(`Restock de compte ${serviceName}`)
        .setDescription(`Veuillez renvoyer le message suivant avec les Comptes à ajouter au service ${serviceName} :`);
      const confirmMessage = await message.channel.send({ embeds: [embed] });

      const filter = (response) => response.author.id === allowedRestockUser && response.content.trim().length > 0;
      const collector = message.channel.createMessageCollector({ filter, time: 120000 }); // 2 minutes de temps d'attente

      collector.on('collect', async (response) => {
        try {
          const linesToAdd = response.content.trim();
          const filePath = path.join('./stock', `${serviceName}.txt`);

          const existingLines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
          const newLinesCount = linesToAdd.split('\n').filter(Boolean).length;

          fs.appendFileSync(filePath, `\n${linesToAdd}`);
          const confirmEmbed = new MessageEmbed()
            .setColor('GREEN')
            .setTitle(`Restock de compte ${serviceName}`)
            .setDescription(`Les ${newLinesCount} comptes ont été ajoutés au service ${serviceName}.`);
          confirmMessage.edit({ embeds: [confirmEmbed] });

          // Envoi de l'embed dans le canal de restock
          const restockChannel = client.channels.cache.get('id du salons restock'); // ID du canal pour les restocks
          if (restockChannel) {
            const embed = new MessageEmbed()
              .setColor('GREEN')
              .setTitle(`Restock du service ${serviceName}`)
              .setDescription(`${newLinesCount} compte(s) ajouté(s). Comptes restants : ${existingLines.length + newLinesCount}`)
              .addField('Redirection', `<#id du salons pour gen>`);
            restockChannel.send({ embeds: [embed], content: '<@&id du role a ping au restock>' }); // Ping du rôle
          }

          restockUser = null;
          restockService = null;

          collector.stop();
        } catch (error) {
          console.error(error);
          message.reply(`Une erreur est survenue lors du restock du service ${serviceName}.`);
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          const timeoutEmbed = new MessageEmbed()
            .setColor('RED')
            .setTitle(`Temps écoulé`)
            .setDescription(`Le temps imparti pour le restock du service ${serviceName} est écoulé.`);
          confirmMessage.edit({ embeds: [timeoutEmbed] });

          restockUser = null;
          restockService = null;
        }
      }); // <-- Closing parenthesis for the 'end' event
    }
  }

      if (command === 'delstock' && message.author.id === allowedRestockUser) {
    const serviceName = args[0] ? args[0].toLowerCase() : null;
    if (!serviceName) {
      return message.reply('Utilisation : !delstock {nomduservice}');
    }

    const filePath = path.join('./stock', `${serviceName}.txt`);
    if (!fs.existsSync(filePath)) {
      const embed = new MessageEmbed()
        .setColor('YELLOW')
        .setTitle('Service inexistant')
        .setDescription(`Le service que vous avez demandé n'existe pas.`);
      return message.channel.send({ embeds: [embed] });
    }

    try {
      fs.writeFileSync(filePath, ''); // Vide le contenu du fichier
      const embed = new MessageEmbed()
        .setColor('GREEN')
        .setTitle(`Vidage du stock du service ${serviceName}`)
        .setDescription(`Le contenu du stock du service ${serviceName} a été vidé avec succès.`);
      message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      const embed = new MessageEmbed()
        .setColor('RED')
        .setTitle(`Erreur`)
        .setDescription(`Une erreur est survenue lors du vidage du stock du service ${serviceName}.`);
      message.channel.send({ embeds: [embed] });
    }
  }
    
    if (command === 'delete' && message.author.id === allowedRestockUser) {
    const serviceName = args[0] ? args[0].toLowerCase() : null;
    if (!serviceName) {
      return message.reply('Utilisation : !delete {nomduservice}');
    }

    const filePath = path.join('./stock', `${serviceName}.txt`);
    if (!fs.existsSync(filePath)) {
      const embed = new MessageEmbed()
        .setColor('YELLOW')
        .setTitle('Service inexistant')
        .setDescription(`Le service que vous avez demandé n'existe pas.`);
      return message.channel.send({ embeds: [embed] });
    }

    try {
      fs.unlinkSync(filePath);
      const embed = new MessageEmbed()
        .setColor('GREEN')
        .setTitle(`Suppression du service ${serviceName}`)
        .setDescription(`Le service ${serviceName} a été supprimé avec succès.`);
      message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      const embed = new MessageEmbed()
        .setColor('RED')
        .setTitle(`Erreur`)
        .setDescription(`Une erreur est survenue lors de la suppression du service ${serviceName}.`);
      message.channel.send({ embeds: [embed] });
    }
  }
    
 if (command === 'gen') {
  try {
    if (message.channel.id !== allowedGenChannelId) {
      const notAllowedEmbed = new MessageEmbed()
        .setColor('RED')
        .setTitle('Mauvais salons')
        .setDescription(`La commande !gen ne peut être utilisée que dans le salon autorisé.`)
        .addField('Redirection', `<#id du salon pour gen>`);
      return message.channel.send({ embeds: [notAllowedEmbed] });
    }

    const serviceName = args[0] ? args[0].toLowerCase() : null;
    if (!serviceName) {
      return message.reply('Utilisation : !gen {nomduservice}');
    }

    const filePath = path.join('./stock', `${serviceName}.txt`);
    if (!fs.existsSync(filePath)) {
      const embed = new MessageEmbed()
        .setColor('YELLOW')
        .setTitle('Service inexistant')
        .setDescription(`Le service que vous avez demandé n'existe pas.`);
      return message.channel.send({ embeds: [embed] });
    }

    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
    if (lines.length === 0) {
      const embed = new MessageEmbed()
        .setColor('RED')
        .setTitle('Rupture de stock')
        .setDescription(`Le service ${serviceName} est en rupture de stock. Veuillez attendre le restock.`)
        .addField('Redirection', `<#id du salons pour restock>`);
      return message.channel.send({ embeds: [embed] });
    }

    const account = lines.shift();
    fs.writeFileSync(filePath, lines.join('\n'));

    const user = message.author;
    const embed = new MessageEmbed()
      .setColor('GREEN')
      .setTitle(`Génération du compte ${serviceName}`)
      .setDescription(`Voici votre compte ${serviceName} :\n${account}`)
      .setImage('url de votre banniere');
    user.send({ embeds: [embed] });

    const successEmbed = new MessageEmbed()
      .setColor('GREEN')
      .setTitle(`Génération du compte ${serviceName}`)
      .setDescription(`Le compte a été généré avec succès. Veuillez vérifier vos messages privés. Veuillez mettre un proof sous peine d'une sanction.`)
      .setImage('url de votre banniere);
    message.channel.send({ embeds: [successEmbed] });
  } catch (error) {
    console.error(error);
    const errorEmbed = new MessageEmbed()
      .setColor('RED')
      .setTitle(`Erreur`)
      .setDescription(`Une erreur est survenue lors de la génération du compte ${serviceName}.`);
    message.channel.send({ embeds: [errorEmbed] });
  }
}

  if (command === 'stock') {
    try {
if (message.channel.id !== allowedStockChannelId) {
 const notAllowedEmbed = new MessageEmbed()
          .setColor('RED')
          .setTitle('Mauvais salons')
          .setDescription(`La commande !stock ne peut être utilisée que dans le salon autorisé.`)
          .addField('Redirection', `<#id du salons ou on peut utiliser la commande !stock>`);
        return message.channel.send({ embeds: [notAllowedEmbed] });
      }


      const stockEmbed = new MessageEmbed()
        .setColor('BLUE')
        .setTitle('Stock de comptes')
        .setDescription('Voici le stock de comptes disponibles :');

      const stockFiles = fs.readdirSync('./stock').filter(file => file.endsWith('.txt'));

      stockFiles.forEach(file => {
        const serviceName = file.replace('.txt', '');
        const lines = fs.readFileSync(path.join('./stock', file), 'utf-8').split('\n').filter(Boolean);
        const remaining = lines.length;
        stockEmbed.addField(serviceName, `Comptes restants : ${remaining}`);
      });

      message.channel.send({ embeds: [stockEmbed] });
    } catch (error) {
      console.error(error);
      message.reply('Une erreur est survenue lors de la récupération du stock.');
    }
  }
});

async function fetchAttachment(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    return text;
  } catch (error) {
    console.error(error);
    return '';
  }
}

// Remplacez token par votre propre jeton de bot Discord
client.login('token');