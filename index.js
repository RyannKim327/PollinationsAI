const axios = require("axios");
const CORS = require("cors");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const users = {};

app.use(CORS());

const gpt = async (messages) => {
  const { data, status } = await axios.post(
    "https://text.pollinations.ai/openai",
    {
      model: "openai-fast",
      messages: messages,
      temperature: 1,
      max_tokens: 1000,
      stream: false,
    },
  );
  if (status >= 200 && status < 300) {
    return {
      response: data.choices[0].message.content,
    };
  }
  return {
    error: "System error",
    code: status,
  };
};

const randomID = () => {
  let id = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const total = Math.floor(Math.random() * 10) + 10;
  for (let i = 0; i < total; i++) {
    id += characters[Math.floor(Math.random() * characters.length)];
  }
  if (Object.keys(users).includes(id)) {
    return randomID();
  }
  users[id] = [];
  return id;
};

app.get("/", async (req, res) => {
  const params = req.query;
  const user = params["user"] || randomID();
  const message = params["message"];
  if (message) {
    const query = {
      role: "user",
      content: message,
    };

    if (!users[user]) {
      users[user] = [];
    }

    users[user].push(query);
    const { response, error, code } = await gpt(users[user]);

    if (error) {
      users[user].pop();
      return res.json({ error, code });
    }

    users[user].push({
      role: "system",
      content: response,
    });

    return res.json({
      response,
      user,
    });
  }
  return res.send(`
    <div>
      <h3>Here are the list of commands to use:</h3>
      <ol>
      <li><a href="https://${req.hostname}/?message=your%20message%20here">https://${req.hostname}/?message=your message here</a> ➙ Create a message</li>
      <li><a href="https://${req.hostname}/?message=your%20message%20here&user=your_id_here">https://${req.hostname}/?message=your message here&user=your_id_here</a> ➙ For using with past conversation retrieval</li>
      <li><a href="https://${req.hostname}/delete/?user=your_id_here">https://${req.hostname}/delete/?user=your_id_here</a> ➙ Deletion of past conversation based on ID</li>
      <li><a href="https://${req.hostname}/chats/your_id_here">https://${req.hostname}/chats/your_id_here</a> ➙ Retrieval of your past conversation</li>
      </ol>
    </div>
  `);
});

app.get("/chats/:userId", (req, res) => {
  const params = req.params;
  if (params.userId) {
    if (users[params.userId]) {
      return res.json({
        message: "Chats retrieved successfully",
        chats: users[params.userId],
      });
    }
    return res.json({
      message: "No message found",
      chats: [],
    });
  }
  res.json({
    error: "User ID is required",
  });
});

app.get("/delete", (req, res) => {
  if (req.query.user) {
    users[req.query.user] = undefined;
    return res.json({
      message: "Query deleted successfully",
    });
  }
  return res.json({
    error: "No user to delete",
  });
});

app.listen(PORT, () => {
  console.log(`Listening to PORT ${PORT}`);
});
