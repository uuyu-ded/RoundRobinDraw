const path = require("path")
const express = require("express")
const connectDB = require("./db")

const app = express()
const http = require("http").Server(app)
const io = require("socket.io")(http)

const LobbyController = require("./Modules/LobbyController")

// Connect to MongoDB
connectDB()

const lobbyController = new LobbyController()
const port = process.env.PORT || 3000
const publicDirectory = path.join(__dirname, "public")

// Static file serving
app.use(express.static(publicDirectory))

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDirectory, "pages/home.html"))
})

app.get("/lobby", (req, res) => {
  res.sendFile(path.join(publicDirectory, "pages/lobby.html"))
})

app.get("/game", (req, res) => {
  res.sendFile(path.join(publicDirectory, "pages/game.html"))
})

app.use("/scripts", express.static(path.join(__dirname, "node_modules/socket.io/client-dist/")))

function onConnection(socket) {
  socket.on("createRoom", (player) => {
    try {
      lobbyController.createRoom(socket, player)
    } catch (error) {
      console.error("Error creating room:", error)
      socket.emit("joinFailed", { error: "Failed to create room" })
    }
  })

  socket.on("joinRoom", (player) => {
    try {
      lobbyController.joinRoom(io, socket, player)
    } catch (error) {
      console.error("Error joining room:", error)
      socket.emit("joinFailed", { error: "Failed to join room" })
    }
  })

  socket.on("joinGame", (data) => {
    try {
      lobbyController.joinGame(io, socket, data.playerId, data.roomCode)
    } catch (error) {
      console.error("Error joining game:", error)
      socket.emit("joinFailed", { error: "Failed to join game" })
    }
  })

  socket.on("disconnecting", () => {
    try {
      setTimeout(() => lobbyController.removePlayerFromRooms(io, socket), 10000)
    } catch (error) {
      console.error("Error handling disconnect:", error)
    }
  })

  socket.on("playerReadyChanged", (player) => {
    try {
      lobbyController.changePlayerReady(io, socket, player)
    } catch (error) {
      console.error("Error changing player ready status:", error)
    }
  })

  socket.on("lobbyDrawing", (data, player) => {
    try {
      lobbyController.drawing(io, player, data)
    } catch (error) {
      console.error("Error handling lobby drawing:", error)
    }
  })

  socket.on("gameDrawing", (data, player) => {
    try {
      lobbyController.drawing(io, player, data)
    } catch (error) {
      console.error("Error handling game drawing:", error)
    }
  })

  socket.on("saveDrawing", (drawingData, player) => {
    try {
      lobbyController.saveDrawing(io, player, drawingData)
    } catch (error) {
      console.error("Error saving drawing:", error)
    }
  })

  socket.on("startNewRound", (roomCode) => {
    try {
      lobbyController.newRound(io, roomCode)
    } catch (error) {
      console.error("Error starting new round:", error)
    }
  })

  socket.on("guessWord", (player, word) => {
    try {
      lobbyController.guessWord(io, player, word)
    } catch (error) {
      console.error("Error handling word guess:", error)
    }
  })

  socket.on("endRound", (player) => {
    try {
      lobbyController.endRound(io, player)
    } catch (error) {
      console.error("Error ending round:", error)
    }
  })

  socket.on("clearBoard", (player) => {
    try {
      lobbyController.clearBoard(io, player)
    } catch (error) {
      console.error("Error clearing board:", error)
    }
  })

  socket.on("updateTimeRemaining", (roomCode, timeRemaining) => {
    try {
      lobbyController.updateTimeRemaining(io, roomCode, timeRemaining)
    } catch (error) {
      console.error("Error updating time remaining:", error)
    }
  })

  socket.on("changeGameMode", (roomCode, gameMode) => {
    try {
      lobbyController.changeGameMode(io, roomCode, gameMode)
    } catch (error) {
      console.error("Error changing game mode:", error)
    }
  })

  // Add the new socket event handler for rating drawings
  socket.on("rateDrawing", (data) => {
    try {
      lobbyController.rateDrawing(io, data)
    } catch (error) {
      console.error("Error rating drawing:", error)
    }
  })
}

io.on("connection", onConnection)
http.listen(port, () => console.log(`listening on port ${port}`))
