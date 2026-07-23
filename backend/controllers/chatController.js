const axios = require("axios");

const chatWithAI = async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "openai/gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: message
                    }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "StudyPlan Chatbot"
                }
            }
        );

        const reply = response.data.choices?.[0]?.message?.content;

        return res.json({ reply });

    } catch (error) {
        console.error("AI ERROR:", error.response?.data || error.message);

        return res.status(500).json({
            error: "AI failed"
        });
    }
};

module.exports = { chatWithAI };