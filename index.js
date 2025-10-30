const axios = require("axios");
const CORS = require("cors");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const users = {};

app.use(CORS());

const image = async (prompt, model = "flux", source = "") => {
  if (source) {
    source = `&image=${source}`;
  } else {
    source = undefined;
  }
  const negative_prompt = ["watermark"];
  console.log("Meow");

  const { data, status } = await axios.get(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
    {
      responseType: "arraybuffer",
      params: {
        model,
        source,
        negative_prompt: negative_prompt.join(" "),
      },
    },
  );

  if (status >= 200 && status < 300) {
    const buffer = Buffer.from(data, "binary").toString("base64");
    return {
      response: `data:image/png;base64,${buffer}`,
    };
  }
  return {
    error: "System error",
    code: status,
  };
};

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
    const response = data.choices[0].message.content;
    if (response.startsWith("Image: ")) {
      return {
        response: image(response, "gptimage"),
      };
    }
    return {
      response,
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
  users[id] = [
    {
      role: "system",
      content:
        "You are a markdown-capable AI assistant that can generate both text and images. Always respond in markdown when possible. Summarize and adapt to the user's current intent based on recent prompts. Detect if the user is requesting an image; if so, combine all related details from previous messages and format the image prompt as `{ sceneDetailed }% 20{ adjective }% 20{ charactersDetailed }% 20{ visualStyle }% 20{ genre }% 20{ artistReference } `. Reply to image requests as `Image: { finalPrompt } `. Infer user preferences (tone, style, detail) from their prompts and use them in future responses. If conversation context becomes too confusing or overloaded, respond with ` / clear` or ` / cls` to reset. Stay precise, concise, and relevant.",
    },
  ];
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
      users[user] = [
        {
          role: "system",
          content:
            "You are a markdown-capable AI assistant that can generate both text and images. Always respond in markdown when possible. Summarize and adapt to the user's current intent based on recent prompts. Detect if the user is requesting an image; if so, combine all related details from previous messages and format the image prompt as `{ sceneDetailed }% 20{ adjective }% 20{ charactersDetailed }% 20{ visualStyle }% 20{ genre }% 20{ artistReference } `. Reply to image requests as `Image: { finalPrompt } `. Infer user preferences (tone, style, detail) from their prompts and use them in future responses. If conversation context becomes too confusing or overloaded, respond with ` / clear` or ` / cls` to reset. Stay precise, concise, and relevant.",
        },
      ];
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
      <li>[GET] <a href="https://${req.hostname}/?message=your%20message%20here">https://${req.hostname}/?message=your message here</a> ➙ Create a message</li>
      <li>[GET] <a href="https://${req.hostname}/?message=your%20message%20here&user=your_id_here">https://${req.hostname}/?message=your message here&user=your_id_here</a> ➙ For using with past conversation retrieval</li>
      <li>[GET] <a href="https://${req.hostname}/delete/?user=your_id_here">https://${req.hostname}/delete/?user=your_id_here</a> ➙ Deletion of past conversation based on ID</li>
      <li>[GET] <a href="https://${req.hostname}/chats/your_id_here">https://${req.hostname}/chats/your_id_here</a> ➙ Retrieval of your past conversation</li>
      </ol>
    </div>
  `);
});

app.get("/abcd", (req, res) => {
  return res.json(chats);
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

app.get("/image", async (req, res) => {
  return image(req.query.prompt, "gptimage", req.query.source);
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
  console.log(`Listening to PORT ${PORT} `);
});
