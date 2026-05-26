const { io } = require("socket.io-client");

const client1 = io("http://localhost:3000");
const client2 = io("http://localhost:3000");

const ROOM_ID = "test-room-123";

client1.on("connect", () => {
  console.log("Client 1 connected. Joining room.");
  client1.emit("join_room", { roomId: ROOM_ID, username: "Alice" });
});

client2.on("connect", () => {
  console.log("Client 2 connected. Joining room.");
  setTimeout(() => {
    client2.emit("join_room", { roomId: ROOM_ID, username: "Bob" });
  }, 500);
});

client1.on("participant_update", (parts) => {
  console.log("Client 1 saw participants update:", parts.map(p => p.username));
  if (parts.length === 2) {
    console.log("Client 1 starting timer...");
    client1.emit("start_timer", { roomId: ROOM_ID });
  }
});

client2.on("timer_tick", (data) => {
  console.log("Client 2 sees timer tick:", data.remaining);
  if (data.remaining === 25 * 60 - 2) {
    console.log("Timer test successful. Disconnecting.");
    client1.disconnect();
    client2.disconnect();
    process.exit(0);
  }
});

setTimeout(() => {
  console.error("Test timeout");
  process.exit(1);
}, 5000);
