const chatBox = document.getElementById("chat-box");

const userInput = document.getElementById("user-input");

const sendBtn = document.getElementById("send-btn");

const addMessage = (message, className) => {

    const div = document.createElement("div");

    div.classList.add(className);

    div.innerText = message;

    chatBox.appendChild(div);

    chatBox.scrollTop = chatBox.scrollHeight;
};

const sendMessage = async () => {

    const message = userInput.value.trim();

    if (!message) return;

    addMessage(message, "user-message");

    userInput.value = "";

    addMessage("Typing...", "bot-message");

    try {

        const response = await fetch("/api/chat", {

            method: "POST",

            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                message,
            }),
        });
        const data = await response.json();

console.log("Backend response:", data);

chatBox.lastChild.remove();

if (data.reply) {
    addMessage(data.reply, "bot-message");
} else {
    addMessage(
        data.error || "No response from AI",
        "bot-message"
    );
}

    } catch (error) {

        chatBox.lastChild.remove();

        addMessage(
            "Something went wrong",
            "bot-message"
        );

        console.error(error);
    }
};

sendBtn.addEventListener("click", sendMessage);

userInput.addEventListener("keypress", (e) => {

    if (e.key === "Enter") {
        sendMessage();
    }
});