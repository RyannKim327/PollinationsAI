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
  for (let i = 0; i < 10; i++) {
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
  console.log(user);
  if (message) {
    const query = {
      role: "user",
      content: message,
    };

    if (!users[user]) {
      users[user] = [];
    }

    users[user].push(query);
    console.log(users);
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
