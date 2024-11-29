const fs = require("fs");
const config = require("../config.json");
const { Initialization, execute } = require("../database/database");
const {
  Events,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const cron = require("node-cron");
module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    Initialization();
    let guild = await client.guilds.fetch(config.guild_id);
    let dailyChannel = await guild.channels.fetch(config.daily_channel_id);

    cron.schedule("0 0 * * *", async () => {
      // cron.schedule("* * * * *", async () => {
      let status = JSON.parse(fs.readFileSync("status.json", "utf8"));

      console.log("Running task at midnight!");

      const action = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("answer_now")
          .setLabel("Answer Now")
          .setStyle(ButtonStyle.Primary)
      );
      if (status.last) {
        console.log("test");
        let last = await execute(`SELECT * FROM daily WHERE message_id = ?`, [
          status.last,
        ]);
        console.log("ey");
        console.log(last);
        let message = await dailyChannel.messages.fetch(status.last);
        console.log(message);
        const dailyEmbed = new EmbedBuilder()
          .setTitle("❓ | Daily Quiz")
          .setDescription(
            `### Previous Statistics:\n> **Correctly Answered:** ${last[0].correctly_answered}\n> **Wrongly Answered:** ${last[0].wrongly_answered}\n\n### New Question\n> Dear Members,\n\n> A new daily challenge has dropped! Please click the **Answer Now** button to start.\n\n> Exactly at midnight, a report of the amount of correct and wrong answers will be published!\n\n> **Good Luck!**`
          )
          .setTimestamp()
          .setAuthor({
            name: `${client.user.username}`,
            iconURL: `${client.user.displayAvatarURL()}`,
          })
          .setColor("White");
        let z = await dailyChannel.send({
          embeds: [dailyEmbed],
          components: [action],
          content: `@everyone`,
        });
        console.log("sent");
        await execute(
          `INSERT INTO daily (message_id, correctly_answered, wrongly_answered) VALUES (?, ?, ?)`,
          [z.id, 0, 0]
        );
        status.last = z.id;
        fs.writeFileSync("status.json", JSON.stringify(status), (err) => {
          if (err) console.log(err);
        });
        await execute(`DELETE FROM daily WHERE message_id = ?`, [status.last]);
        await execute(
          `INSERT INTO daily (message_id, correctly_answered, wrongly_answered) VALUES (?, ?, ?)`,
          [z.id, 0, 0]
        );
      } else {
        console.log("test2");
        const dailyEmbed = new EmbedBuilder()
          .setTitle("❓ | Daily Quiz")
          .setDescription(
            `> Dear Members,\n\n> A new daily challenge has dropped! Please click the **Answer Now** button to start.\n\n> Exactly at midnight, a report of the amount of correct and wrong answers will be published!\n\n> **Good Luck!**`
          )
          .setTimestamp()
          .setAuthor({
            name: `${client.user.username}`,
            iconURL: `${client.user.displayAvatarURL()}`,
          })
          .setColor("White");
        let z = await dailyChannel.send({
          embeds: [dailyEmbed],
          components: [action],
          content: `@everyone`,
        });
        await execute(
          `INSERT INTO daily (message_id, correctly_answered, wrongly_answered) VALUES (?, ?, ?)`,
          [z.id, 0, 0]
        );
        console.log("test");
        status.last = z.id;
        fs.writeFileSync("status.json", JSON.stringify(status), (err) => {
          if (err) console.log(err);
        });
      }
    });

    let status = JSON.parse(fs.readFileSync("./status.json", "utf8"));
    if (!status.status) {
      let profileChannel = await guild.channels.fetch(
        config.profile_channel_id
      );
      let realChannel = await guild.channels.fetch(config.real_channel_id);
      let trainChannel = await guild.channels.fetch(config.train_channel_id);

      const dailyEmbed = new EmbedBuilder()
        .setTitle("❓ | Daily Quiz")
        .setDescription(
          `> Dear Members,\n\n> **Each day** at exactly **midnight**, a new daily quiz is sent in this channel. This quiz consists of **10** questions. At the end of the day, it will show the statistics of how many entered the answers correctly!\n\n> We wish you luck!`
        )
        .setTimestamp()
        .setAuthor({
          name: `${client.user.username}`,
          iconURL: `${client.user.displayAvatarURL()}`,
        })
        .setColor("White");
      let z = await dailyChannel.send({ embeds: [dailyEmbed] });
      await z.pin();
      const profileButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("leaderboard")
          .setLabel("Leaderboard")
          .setEmoji("🥇")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("profile")
          .setLabel("View Profile")
          .setEmoji("👤")
          .setStyle(ButtonStyle.Primary)
      );
      const profileEmbed = new EmbedBuilder()
        .setTitle("👤 | Profile Buttons")
        .setDescription(
          `> Dear Members,\n\n> Below you can find 2 important buttons.\n> - **Leaderboard:** will show you the top 10 users in terms of quiz points, and how much questions they answered correctly.\n> - **Profile:** will display your quiz profile, including all your points, your leaderboard ranking and how much questions you answered correct/wrong.`
        )
        .setTimestamp()
        .setAuthor({
          name: `${client.user.username}`,
          iconURL: `${client.user.displayAvatarURL()}`,
        })
        .setColor("White");
      let h = await profileChannel.send({
        embeds: [profileEmbed],
        components: [profileButtons],
      });
      await h.pin();
      const quizButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("start_quiz")
          .setLabel("Start Quiz")
          .setEmoji("⚔️")
          .setStyle(ButtonStyle.Danger)
      );
      const realEmbed = new EmbedBuilder()
        .setTitle("⚔️ | Quiz Battlegrounds")
        .setDescription(
          `> Dear Members,\n\n> In this channel you will find the renowned **Start Quiz** button.\n> When clicking on this button, you will be shown **10** random questions from all types of mathematical subjects.\n\n> ⚠️ **Beware! Based on this quiz, you will either gain or lose points!** Would you rather only test yourself? Then you can head over to the ${trainChannel}, to answer quiz questions that have no effect on your profile. The grading is as follows:\n> - Answering less than 5 questions correct removes **-1** point from your account.\n> - Then, for each point above **0.5**, you receive **0.1** point, added to your account.\n\n> **Ready for the challenge? Click the button now and start answering!**.  `
        )
        .setTimestamp()
        .setAuthor({
          name: `${client.user.username}`,
          iconURL: `${client.user.displayAvatarURL()}`,
        })
        .setColor("White");
      let g = await realChannel.send({
        embeds: [realEmbed],
        components: [quizButtons],
      });
      await g.pin();
      const buttons = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Start Selection")
            .setCustomId("start_selection")
            .setStyle(ButtonStyle.Danger)
        ),
      ];
      const trainEmbed = new EmbedBuilder()
        .setTitle("📊 | Quiz Training")
        .setDescription(
          `> Dear Members,\n\n> In this channel you will find several  buttons for each type of category.\n> When clicking on one of these buttons, it will add the category to the list of questions you may be asked. Click on the same button again to remove the category.\n> Click on **Start Quiz** to start the training with the selected amount of categories.\n\n> **First Click on Start Selection to start choosing your categories**.\n\n> ⚠️ **Beware!** This quiz will **NOT** affect your quiz profile. If you want to gain points, head over to the ${realChannel} channel. This channel is solely for training purposes.  `
        )
        .setTimestamp()
        .setAuthor({
          name: `${client.user.username}`,
          iconURL: `${client.user.displayAvatarURL()}`,
        })
        .setColor("White");
      let d = await trainChannel.send({
        embeds: [trainEmbed],
        components: buttons,
      });
      await d.pin();
      status.status = true;
      fs.writeFileSync("./status.json", JSON.stringify(status), (err) => {
        if (err) console.log(err);
      });
    }
  },
};
