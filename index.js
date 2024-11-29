const fs = require("node:fs");
const path = require("node:path");
const n = require("./config.json");
let talkedRecently = new Set();
const { getRandomRows, getRandomRowsTraining } = require("./helpers/helper");

const {
  REST,
  Routes,
  ChannelType,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  Embed,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuComponent,
  RoleSelectMenuBuilder,
} = require("discord.js");
const {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  Collection,
  EmbedBuilder,
} = require("discord.js");
const {
  execute,

  makeid,
} = require("./database/database");
const { generateKey } = require("node:crypto");
const client = new Client({
  intents: Object.keys(GatewayIntentBits).map((a) => {
    return GatewayIntentBits[a];
  }),
});
client.invites = {};
const commands = [];
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);
client.commands = new Collection();
for (const folder of commandFolders) {
  if (fs.lstatSync("./commands/" + folder).isDirectory()) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    }
  }
}

const rest = new REST().setToken(n.token);
(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );
    const data = await rest.put(Routes.applicationCommands(n.clientid), {
      body: commands,
    });

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
})();

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.guild)
    return interaction.reply({
      ephemeral: true,
      content: `> :x: This command can only be used in guilds, and not DMs.`,
    });

  let command = client.commands.get(interaction.commandName);
  if (interaction.isCommand()) {
    command.execute(interaction);
  }

  if (interaction.isButton()) {
    if (interaction.customId === "answer_now") {
      let quizData = await execute(`SELECT * FROM daily WHERE message_id = ?`, [
        interaction.message.id,
      ]);

      let temp = JSON.parse(fs.readFileSync("./temp.json", "utf8"));
      let randomRows = getRandomRows(1);
      randomRows = randomRows.map((x) => ({ ...x, correct: null }));
      if (!temp[interaction.member.id]) {
        temp[interaction.member.id] = {};
      }

      temp[interaction.member.id].questions = randomRows;
      fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2));
      let currentIndex = 0;

      const createQuestionEmbed = (index) => {
        const question = randomRows[index];
        return new EmbedBuilder()
          .setTitle(`❓ | Question #${index + 1}`)
          .setImage(temp[interaction.member.id].questions[index].image || null)
          .setDescription(
            `> **Subject:** ${question.ject}\n> **Category:** ${
              temp[interaction.member.id].questions[index].Category ==
              "Wyrażenia algebraiczne (wielomiany, wzory skróconego mnożenia)"
                ? "Wyrażenia algebraiczne"
                : temp[interaction.member.id].questions[index].Category
            }`
          )
          .setTimestamp()
          .setAuthor({
            name: `${interaction.client.user.username}`,
            iconURL: `${interaction.client.user.displayAvatarURL()}`,
          })
          .setColor("White");
      };

      const createAnswerButtons = () => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("A")
            .setLabel("A")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("B")
            .setLabel("B")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("C")
            .setLabel("C")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("D")
            .setLabel("D")
            .setStyle(ButtonStyle.Primary)
        );
      };

      const questionEmbed = createQuestionEmbed(currentIndex);
      const buttons = createAnswerButtons();

      const message = await interaction.reply({
        embeds: [questionEmbed],
        components: [buttons],
        ephemeral: true,
        fetchReply: true,
      });

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", async (i) => {
        temp[interaction.member.id].questions[currentIndex].your_answer =
          i.customId;
        fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2));
        if (i.customId === randomRows[currentIndex].answer) {
          temp[interaction.member.id].questions[currentIndex].correct = true;

          fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2));
        } else {
          temp[interaction.member.id].questions[currentIndex].correct = false;
          fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2));
        }
        if (currentIndex + 1 >= randomRows.length) {
          collector.stop();
          return;
        }
        currentIndex++;

        const nextEmbed = createQuestionEmbed(currentIndex);
        const nextButtons = createAnswerButtons();
        await i.update({
          embeds: [nextEmbed],
          components: [nextButtons],
        });
      });

      collector.on("end", async () => {
        let first;
        let jsonData = temp[interaction.member.id].questions;
        for (let i = 0; i < jsonData.length; i++) {
          let embed;
          if (jsonData[i].correct) {
            await execute(
              `UPDATE daily SET correctly_answered = correctly_answered + 1 WHERE message_id = ?`,
              [interaction.message.id]
            );
            embed = new EmbedBuilder()
              .setTitle(`:white_check_mark: | Correct Answer`)
              .setImage(jsonData[i].image || null)
              .setDescription(
                `> **Question:** ${i + 1}\n> **Subject:** ${
                  jsonData[i].ject
                }\n> **Category:** ${
                  jsonData[i].Category ==
                  "Wyrażenia algebraiczne (wielomiany, wzory skróconego mnożenia)"
                    ? "Wyrażenia algebraiczne"
                    : jsonData[i].Category
                }\n> **Correct Answer:** ${
                  jsonData[i].answer
                }\n> **Your Answer:** ${jsonData[i].your_answer}.`
              )
              .setTimestamp()
              .setAuthor({
                name: `${interaction.client.user.username}`,
                iconURL: `${interaction.client.user.displayAvatarURL()}`,
              })
              .setColor("Green");
          } else {
            await execute(
              `UPDATE daily SET wrongly_answered = wrongly_answered + 1 WHERE message_id = ?`,
              [interaction.message.id]
            );
            embed = new EmbedBuilder()
              .setTitle(`:x: | Incorrect Answer`)
              .setImage(jsonData[i].image || null)
              .setDescription(
                `> **Question:** ${i + 1}\n> **Subject:** ${
                  jsonData[i].ject
                }\n> **Category:** ${
                  jsonData[i].Category ==
                  "Wyrażenia algebraiczne (wielomiany, wzory skróconego mnożenia)"
                    ? "Wyrażenia algebraiczne"
                    : jsonData[i].Category
                }\n> **Correct Answer:** ${
                  jsonData[i].answer
                }\n> **Your Answer:** ${jsonData[i].your_answer}.`
              )
              .setTimestamp()
              .setAuthor({
                name: `${interaction.client.user.username}`,
                iconURL: `${interaction.client.user.displayAvatarURL()}`,
              })
              .setColor("Red");
          }
          try {
            let z = await interaction.member.send({ embeds: [embed] });
            if (i == 0) {
              first = z.id;
              let score = jsonData.filter((x) => x.correct).length;

              const embed = new EmbedBuilder()
                .setTitle(`:white_check_mark: Quiz Completed!`)

                .setDescription(
                  `> You have successfully completed the quiz and answered the question. You scored a ${score}/1.\n> Please head over to ${z.url} to view your generated report.`
                )
                .setTimestamp()
                .setAuthor({
                  name: `${interaction.client.user.username}`,
                  iconURL: `${interaction.client.user.displayAvatarURL()}`,
                })
                .setColor("White");

              await interaction.editReply({
                embeds: [embed],
                components: [],
              });
            }
          } catch (e) {
            console.log(e);
          }
        }
      });
    }
    if (interaction.customId === "leaderboard") {
      const leaderboardData = await execute(`SELECT * FROM users`, []);
      const positions = leaderboardData
        .map((user, index) => {
          let medal = "";
          if (index === 0) medal = "🥇";
          else if (index === 1) medal = "🥈";
          else if (index === 2) medal = "🥉";
          else medal = `${index + 1}`;

          return `${medal} - <@${user.member_id}> - ${user.points} points`;
        })
        .join("\n");

      const leaderboardEmbed = new EmbedBuilder()
        .setTitle("🏆 | Leaderboard")
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setDescription(positions || "No data available yet!")
        .setColor("White")
        .setFooter({ text: "Keep climbing to the top!" })
        .setTimestamp();

      await interaction.reply({
        embeds: [leaderboardEmbed],
        ephemeral: true,
      });
    }

    if (interaction.customId === "profile") {
      const memberId = interaction.member.id;
      const profileData = await execute(
        `SELECT * FROM users WHERE member_id = ?`,
        [interaction.member.id]
      );
      const leaderboardData = await execute(`SELECT * FROM users`, []);
      const position =
        leaderboardData.findIndex((user) => user.member_id === memberId) + 1;

      const profileEmbed = new EmbedBuilder()
        .setTitle(`📋 | ${interaction.member.displayName}'s Profile`)
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setDescription(
          `> **Points:** ${
            profileData[0]?.points || 0
          }\n> **Correctly Answered:** ${
            Math.round(profileData[0]?.correctly_answered) || 0
          }\n> **Wrongly Answered:** ${
            Math.round(profileData[0]?.wrongly_answered) || 0
          }\n> **Leaderboard Position:** #${position || "N/A"}`
        )

        .setColor("White")
        .setFooter({ text: "👾 Keep improving to climb higher!" })
        .setTimestamp();

      await interaction.reply({
        embeds: [profileEmbed],
        ephemeral: true,
      });
    }

    if (interaction.customId === "start_quiz") {
      let userData = await execute(`SELECT * FROM users WHERE member_id = ?`, [
        interaction.member.id,
      ]);
      if (userData.length == 0) {
        await execute(
          `INSERT INTO users (member_id, points, correctly_answered, wrongly_answered) VALUES (?, 0, 0, 0)`,
          [interaction.member.id]
        );
      }

      let temp = JSON.parse(fs.readFileSync("./temp.json", "utf8"));
      let randomRows = getRandomRows(10);
      randomRows = randomRows.map((x) => ({ ...x, correct: null }));
      if (!temp[interaction.member.id]) {
        temp[interaction.member.id] = {};
      }

      temp[interaction.member.id].questions = randomRows;

      fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2), "utf8");
      let currentIndex = 0;

      const createQuestionEmbed = (index) => {
        const question = randomRows[index];
        return new EmbedBuilder()
          .setTitle(`❓ | Question #${index + 1}`)
          .setImage(question.image || null)
          .setDescription(
            `> **Subject:** ${question.ject}\n> **Category:** ${
              question.Category ==
              "Wyrażenia algebraiczne (wielomiany, wzory skróconego mnożenia)"
                ? "Wyrażenia algebraiczne"
                : question.Category
            }`
          )
          .setTimestamp()
          .setAuthor({
            name: `${interaction.client.user.username}`,
            iconURL: `${interaction.client.user.displayAvatarURL()}`,
          })
          .setColor("White");
      };

      const createAnswerButtons = () => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("A")
            .setLabel("A")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("B")
            .setLabel("B")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("C")
            .setLabel("C")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("D")
            .setLabel("D")
            .setStyle(ButtonStyle.Primary)
        );
      };

      const questionEmbed = createQuestionEmbed(currentIndex);
      const buttons = createAnswerButtons();

      const message = await interaction.reply({
        embeds: [questionEmbed],
        components: [buttons],
        ephemeral: true,
        fetchReply: true,
      });

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", async (i) => {
        temp[interaction.member.id].questions[currentIndex].your_answer =
          i.customId;
        fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2));
        if (i.customId === randomRows[currentIndex].answer) {
          temp[interaction.member.id].questions[currentIndex].correct = true;

          fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2));
        } else {
          temp[interaction.member.id].questions[currentIndex].correct = false;
          fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2));
        }
        if (currentIndex + 1 >= randomRows.length) {
          collector.stop();
          return;
        }
        currentIndex++;

        const nextEmbed = createQuestionEmbed(currentIndex);
        const nextButtons = createAnswerButtons();
        await i.update({
          embeds: [nextEmbed],
          components: [nextButtons],
        });
      });

      collector.on("end", async () => {
        let first;
        let jsonData = temp[interaction.member.id].questions;
        for (let i = 0; i < jsonData.length; i++) {
          console.log(i);
          let embed;
          if (jsonData[i].correct) {
            embed = new EmbedBuilder()
              .setTitle(`:white_check_mark: | Correct Answer`)
              .setImage(jsonData[i].image || null)
              .setDescription(
                `> **Question:** ${i + 1}\n> **Subject:** ${
                  jsonData[i].ject
                }\n> **Category:** ${
                  jsonData[i].Category ==
                  "Wyrażenia algebraiczne (wielomiany, wzory skróconego mnożenia)"
                    ? "Wyrażenia algebraiczne"
                    : jsonData[i].Category
                }\n> **Correct Answer:** ${
                  jsonData[i].answer
                }\n> **Your Answer:** ${jsonData[i].your_answer}.`
              )
              .setTimestamp()
              .setAuthor({
                name: `${interaction.client.user.username}`,
                iconURL: `${interaction.client.user.displayAvatarURL()}`,
              })
              .setColor("Green");
          } else {
            embed = new EmbedBuilder()
              .setTitle(`:x: | Incorrect Answer`)
              .setImage(jsonData[i].image || null)
              .setDescription(
                `> **Question:** ${i + 1}\n> **Subject:** ${
                  jsonData[i].ject
                }\n> **Category:** ${
                  jsonData[i].Category ==
                  "Wyrażenia algebraiczne (wielomiany, wzory skróconego mnożenia)"
                    ? "Wyrażenia algebraiczne"
                    : jsonData[i].Category
                }\n> **Correct Answer:** ${
                  jsonData[i].answer
                }\n> **Your Answer:** ${jsonData[i].your_answer}.`
              )
              .setTimestamp()
              .setAuthor({
                name: `${interaction.client.user.username}`,
                iconURL: `${interaction.client.user.displayAvatarURL()}`,
              })
              .setColor("Red");
          }
          let punishornot = "";
          let score = jsonData.filter((x) => x.correct).length * 0.1;
          if (score < 0.5) {
            punishornot = "punishment";
            if (i == 0) {
              await execute(
                `UPDATE users SET points = points - 1, correctly_answered  = ?, wrongly_answered = ? WHERE member_id = ?`,
                [score * 10, 10 - score * 10, interaction.member.id]
              );
            }
          } else {
            if (i == 0) {
              punishornot = "reward";
              await execute(
                `UPDATE users SET points = points + ?, correctly_answered  = ?, wrongly_answered = ? WHERE member_id = ?`,
                [score, score * 10, 10 - score * 10, interaction.member.id]
              );
            }
          }
          try {
            let z = await interaction.member.send({ embeds: [embed] });
            first = z.id;
            if (i == 0) {
              const ff = new EmbedBuilder()
                .setTitle(`:white_check_mark: Quiz Completed!`)

                .setDescription(
                  `> You have successfully completed the quiz and answered all 10 questions. You scored a ${
                    jsonData.filter((x) => x.correct).length
                  }/10.\n\n### Grading\n> For above grade, you shall receive a ${punishornot} of ${
                    punishornot == "punishment" ? "-1" : score
                  } points.\n\n> - Please head over to ${
                    z.url
                  } to view your generated report\n> - Please head over to: <#${
                    n.profile_channel_id
                  }> and use the buttons to view the leaderboard and your profile.`
                )
                .setTimestamp()
                .setAuthor({
                  name: `${interaction.client.user.username}`,
                  iconURL: `${interaction.client.user.displayAvatarURL()}`,
                })
                .setColor("White");

              await interaction.editReply({
                embeds: [ff],
                components: [],
              });
            }
          } catch (e) {
            console.log(e);
          }
        }
      });
    }
    if (interaction.customId == "start_selection") {
      let quiz = JSON.parse(fs.readFileSync("./quiz.json", "utf8"));
      if (quiz[interaction.member.id]) {
        delete quiz[interaction.member.id];
        fs.writeFileSync("./quiz.json", JSON.stringify(quiz, null, 2));
      }
      quiz = JSON.parse(fs.readFileSync("./quiz.json", "utf8"));

      if (!quiz[interaction.member.id]) {
        quiz[interaction.member.id] = {
          categories: [],
        };

        const Embed = new EmbedBuilder()
          .setTitle(`📍 | Category Selection`)
          .setDescription(
            `> Below you can find all categories you selected for the training. This means that these are all categories that we will be able to pull questions from in the training:\n\n> **No Categories Selected Yet.**`
          )
          .setTimestamp()
          .setAuthor({
            name: `${interaction.client.user.username}`,
            iconURL: `${interaction.client.user.displayAvatarURL()}`,
          })
          .setColor("White");

        const buttons = [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Liczby rzeczywiste")
              .setCustomId("type-Liczby_rzeczywiste")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setLabel("Wyrażenia algebraiczne")
              .setCustomId("type-Wyrażenia_algebraiczne")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setLabel("Równania i nierówności")
              .setCustomId("type-Równania_i_nierówności")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setLabel("Układy równań")
              .setCustomId("type-Układy_równań")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setLabel("Funkcje")
              .setCustomId("type-Funkcje")
              .setStyle(ButtonStyle.Primary)
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Ciągi")
              .setCustomId("type-Ciągi")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setLabel("Trygonometria")
              .setCustomId("type-Trygonometria")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setLabel("Planimetria")
              .setCustomId("type-Planimetria")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setLabel("Geometria analityczna")
              .setCustomId("type-Geometria_analityczna")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setLabel("Stereometria")
              .setCustomId("type-Stereometria")
              .setStyle(ButtonStyle.Primary)
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Kombinatoryka")
              .setCustomId("type-Kombinatoryka")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setLabel("Prawdopodobieństwo")
              .setCustomId("type-Prawdopodobieństwo")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setLabel("Statystyka")
              .setCustomId("type-Statystyka")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("start_training")
              .setLabel("Start Training")
              .setStyle(ButtonStyle.Danger)
          ),
        ];

        let reply = await interaction.reply({
          ephemeral: true,
          embeds: [Embed],
          components: buttons,
          fetchReply: true,
        });

        const collector = reply.createMessageComponentCollector({
          filter: (i) => i.user.id === interaction.user.id,
          time: 15 * 60000, // 1-minute timeout
        });

        quiz[interaction.member.id].message_id = reply.id;
        fs.writeFileSync("./quiz.json", JSON.stringify(quiz, null, 2), "utf8");

        collector.on("collect", async (i) => {
          console.log("i");
          if (i.customId.startsWith("type-")) {
            let type = i.customId.split("-")[1];
            let trimmedType = type.split("_").join(" ");

            if (quiz[interaction.member.id].categories.includes(trimmedType)) {
              let index =
                quiz[interaction.member.id].categories.indexOf(trimmedType);
              quiz[interaction.member.id].categories.splice(index, 1);
            } else {
              quiz[interaction.member.id].categories.push(trimmedType);
            }

            fs.writeFileSync(
              "./quiz.json",
              JSON.stringify(quiz, null, 2),
              "utf8"
            );

            const updatedEmbed = new EmbedBuilder()
              .setTitle(`📍 | Category Selection`)
              .setDescription(
                `> Below you can find all categories you selected for the training. This means that these are all categories that we will be able to pull questions from in the training:\n\n> - ${
                  quiz[interaction.member.id].categories.join("\n> - ") ||
                  "**No Categories Selected Yet.**"
                }`
              )
              .setTimestamp()
              .setAuthor({
                name: `${interaction.client.user.username}`,
                iconURL: `${interaction.client.user.displayAvatarURL()}`,
              })
              .setColor("White");

            await i.update({
              embeds: [updatedEmbed],
            });
          } else if (i.customId === "start_training") {
            try {
              await interaction.deleteReply();
            } catch (e) {}

            collector.stop();
          }
        });
      }
    }
    if (interaction.customId === "start_training") {
      let quiz = JSON.parse(fs.readFileSync("./quiz.json", "utf8"));
      let temp = JSON.parse(fs.readFileSync("./temp.json", "utf8"));
      let theory = quiz[interaction.member.id].categories || [];
      let randomRows = getRandomRowsTraining(10, theory);
      delete quiz[interaction.member.id];
      fs.writeFileSync("./quiz.json", JSON.stringify(quiz, null, 2), "utf8");
      console.log(randomRows);
      randomRows = randomRows.map((x) => ({ ...x, correct: null }));
      if (!temp[interaction.member.id]) {
        temp[interaction.member.id] = {};
      }

      temp[interaction.member.id].questions = randomRows;

      fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2), "utf8");
      let currentIndex = 0;

      const createQuestionEmbed = (index) => {
        const question = randomRows[index];
        return new EmbedBuilder()
          .setTitle(`❓ | Question #${index + 1}`)
          .setImage(temp[interaction.member.id].questions[index].image || null)
          .setDescription(
            `> **Subject:** ${
              temp[interaction.member.id].questions[index].ject
            }\n> **Category:** ${
              temp[interaction.member.id].questions[index].Category ==
              "Wyrażenia algebraiczne (wielomiany, wzory skróconego mnożenia)"
                ? "Wyrażenia algebraiczne"
                : temp[interaction.member.id].questions[index].Category
            }`
          )
          .setTimestamp()
          .setAuthor({
            name: `${interaction.client.user.username}`,
            iconURL: `${interaction.client.user.displayAvatarURL()}`,
          })
          .setColor("White");
      };

      const createAnswerButtons = () => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("A")
            .setLabel("A")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("B")
            .setLabel("B")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("C")
            .setLabel("C")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("D")
            .setLabel("D")
            .setStyle(ButtonStyle.Primary)
        );
      };

      const questionEmbed = createQuestionEmbed(currentIndex);
      const buttons = createAnswerButtons();

      const message = await interaction.reply({
        embeds: [questionEmbed],
        components: [buttons],
        ephemeral: true,
        fetchReply: true,
      });

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", async (i) => {
        temp[interaction.member.id].questions[currentIndex].your_answer =
          i.customId;
        fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2));
        if (i.customId === randomRows[currentIndex].answer) {
          temp[interaction.member.id].questions[currentIndex].correct = true;

          fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2));
        } else {
          temp[interaction.member.id].questions[currentIndex].correct = false;
          fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2));
        }
        if (currentIndex + 1 == randomRows.length) {
          collector.stop();
          return;
        }
        currentIndex++;

        const nextEmbed = createQuestionEmbed(currentIndex);
        const nextButtons = createAnswerButtons();
        await i.update({
          embeds: [nextEmbed],
          components: [nextButtons],
        });
      });

      collector.on("end", async () => {
        let first;
        let jsonData = temp[interaction.member.id].questions;
        for (let i = 0; i < jsonData.length; i++) {
          let embed;
          if (jsonData[i].correct) {
            embed = new EmbedBuilder()
              .setTitle(`:white_check_mark: | Correct Answer`)
              .setImage(jsonData[i].image || null)
              .setDescription(
                `> **Question:** ${i + 1}\n> **Subject:** ${
                  jsonData[i].ject
                }\n> **Category:** ${
                  jsonData[i].Category ==
                  "Wyrażenia algebraiczne (wielomiany, wzory skróconego mnożenia)"
                    ? "Wyrażenia algebraiczne"
                    : jsonData[i].Category
                }\n> **Correct Answer:** ${
                  jsonData[i].answer
                }\n> **Your Answer:** ${jsonData[i].your_answer}.`
              )
              .setTimestamp()
              .setAuthor({
                name: `${interaction.client.user.username}`,
                iconURL: `${interaction.client.user.displayAvatarURL()}`,
              })
              .setColor("Green");
          } else {
            embed = new EmbedBuilder()
              .setTitle(`:x: | Incorrect Answer`)
              .setImage(jsonData[i].image || null)
              .setDescription(
                `> **Question:** ${i + 1}\n> **Subject:** ${
                  jsonData[i].ject
                }\n> **Category:** ${
                  jsonData[i].Category ==
                  "Wyrażenia algebraiczne (wielomiany, wzory skróconego mnożenia)"
                    ? "Wyrażenia algebraiczne"
                    : jsonData[i].Category
                }\n> **Correct Answer:** ${
                  jsonData[i].answer
                }\n> **Your Answer:** ${jsonData[i].your_answer}.`
              )
              .setTimestamp()
              .setAuthor({
                name: `${interaction.client.user.username}`,
                iconURL: `${interaction.client.user.displayAvatarURL()}`,
              })
              .setColor("Red");
          }
          try {
            let z = await interaction.member.send({ embeds: [embed] });
            if (i == 0) {
              first = z.id;
              const embed = new EmbedBuilder()
                .setTitle(`:white_check_mark: Quiz Completed!`)
                .setDescription(
                  `> You have successfully completed the quiz and answered all 10 questions. You scored a ${
                    jsonData.filter((x) => x.correct).length
                  }/10.\n\n> Please head over to ${
                    z.url
                  } to view your generated report.`
                )
                .setTimestamp()
                .setAuthor({
                  name: `${interaction.client.user.username}`,
                  iconURL: `${interaction.client.user.displayAvatarURL()}`,
                })
                .setColor("White");
              await interaction.editReply({
                embeds: [embed],
                components: [],
              });
            }
          } catch (e) {
            console.log(e);
          }
        }

        delete temp[interaction.member.id];
        fs.writeFileSync("./temp.json", JSON.stringify(temp, null, 2));
      });
    }
  }
});

client.login(n.token);
