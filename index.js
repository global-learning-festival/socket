const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

app.use(cors());

const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const adminSocket = io.of("/admin"); // Separate namespace for admin

// Dictionary to keep track of which admin is currently handling each user
const userAdminMapping = {};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`User with ID: ${socket.id} joined room: ${room}`);
  });

  socket.on("send_message", (data) => {
    if (data.room === "admin") {
      // Send the message to the assigned admin room
      const adminSocketId = userAdminMapping[data.author];
      if (adminSocketId) {
        adminSocket.to(adminSocketId).emit("receive_message", data);
      }
    } else {
      // Send the message to the specified user room
      socket.to(data.room).emit("receive_message", data);
    }
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
  });
});

// Queue system for managing user requests
const userQueue = [];

adminSocket.on("connection", (socket) => {
  console.log(`Admin Connected: ${socket.id}`);

  socket.on("join_queue", () => {
    userQueue.push(socket);
    if (userQueue.length === 1) {
      // If there is only one admin in the queue, assign them to the next user
      const userSocket = userQueue.shift();
      userSocket.emit("admin_available");
      userAdminMapping[userSocket.id] = socket.id;
    }
  });

  // Event listener for the admin joining a user's room
  socket.on("join_room", (userSocketId) => {
    // Assign the admin to handle the specific user
    userAdminMapping[userSocketId] = socket.id;
    // Inform the user that the admin is assigned
    io.to(userSocketId).emit("admin_assigned");
  });

  socket.on("disconnect", () => {
    console.log("Admin Disconnected", socket.id);
    // Remove the admin from the userAdminMapping dictionary upon disconnection
    for (const [userSocketId, adminSocketId] of Object.entries(userAdminMapping)) {
      if (adminSocketId === socket.id) {
        delete userAdminMapping[userSocketId];
      }
    }
  });
});

server.listen(PORT, () => {
  console.log("SERVER RUNNING");
});
