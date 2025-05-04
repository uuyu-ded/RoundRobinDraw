const Room = require("./Room")
const RoomUtils = require("./RoomUtils")
const Drawing = require("../models/Drawing")

class LobbyController {
  constructor() {
    this.rooms = []
    this.viewingTimers = {} // Store timers for copycat viewing phase
    this.io = null // Initialize io as null
  }

  addRoom(room) {
    this.rooms.push(room)
  }

  getRoomByCode(roomCode) {
    for (let i = 0; i < this.rooms.length; i++) {
      if (this.rooms[i].roomCode === roomCode) {
        return this.rooms[i]
      }
    }
    return undefined
  }

  createRoom(socket, player) {
    player.socketId = socket.id
    let currentRoom = this.getRoomByCode(player.roomCode)

    if (!currentRoom) {
      currentRoom = new Room(8, player.roomCode)
      currentRoom.addPlayer(player)

      this.addRoom(currentRoom)
      socket.join(currentRoom.roomCode)
      socket.emit("joinComplete", currentRoom)
    } else {
      socket.emit("joinFailed")
    }
  }

  joinRoom(io, socket, player) {
    this.io = io // Store io reference
    player.socketId = socket.id
    const currentRoom = this.getRoomByCode(player.roomCode)

    if (currentRoom && !currentRoom.gameStarted) {
      if (currentRoom.players.length >= currentRoom.maxPlayers) {
        socket.emit("joinFailedMaxPlayers")
        return
      }

      if (!RoomUtils.checkRepeatedNicknames(player, currentRoom.players)) {
        socket.emit("nickInUse")
        return
      }

      currentRoom.addPlayer(player)
      currentRoom.everyoneReady = false
      io.to(currentRoom.roomCode).emit("playersChanged", currentRoom)

      socket.join(currentRoom.roomCode)
      socket.emit("joinComplete", currentRoom)
    } else {
      socket.emit("joinFailed")
    }
  }

  removePlayerFromRooms(io, socket) {
    this.io = io // Store io reference
    const iterator = socket.rooms.values()
    let roomCode = iterator.next()?.value

    while (roomCode) {
      const currentRoom = this.getRoomByCode(roomCode)

      if (currentRoom && !currentRoom.gameStarted) {
        const newPlayersList = []

        for (let i = 0; i < currentRoom.players.length; i++) {
          if (currentRoom.players[i].socketId !== socket.id) {
            newPlayersList.push(currentRoom.players[i])
          }
        }

        currentRoom.players = newPlayersList
        currentRoom.checkEveryoneReady()
        io.to(currentRoom.roomCode).emit("playersChanged", currentRoom)
      }

      roomCode = iterator.next()?.value
    }
  }

  changePlayerReady(io, socket, player) {
    this.io = io // Store io reference
    const iterator = socket.rooms.values()
    let roomCode = iterator.next()?.value

    while (roomCode) {
      const currentRoom = this.getRoomByCode(roomCode)

      if (currentRoom) {
        for (let i = 0; i < currentRoom.players.length; i++) {
          if (currentRoom.players[i].nickname === player.nickname) {
            currentRoom.players[i].ready = player.ready
            break
          }
        }

        currentRoom.checkEveryoneReady()

        // For copycat mode, we handle rounds differently
        if (currentRoom.gameMode === "copycat") {
          if (currentRoom.everyoneReady) {
            // If everyone is ready, advance to the next round
            const gameActive = currentRoom.advanceCopycatRound()
            if (!gameActive) {
              // Game is over
              io.to(currentRoom.roomCode).emit("endGame", currentRoom)
              return
            }
          }
        } else {
          // For guess mode, use the original logic
          currentRoom.setupAvaialbleDrawers()
        }

        this.setupRound(roomCode)
        io.to(currentRoom.roomCode).emit("playersChanged", currentRoom)
      }

      roomCode = iterator.next()?.value
    }
  }

  changeGameMode(io, roomCode, gameMode) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(roomCode)
    if (currentRoom) {
      currentRoom.gameMode = gameMode

      // Reset copycat-specific properties when changing game mode
      if (gameMode === "copycat") {
        currentRoom.copycatRound = 0
        currentRoom.copycatDrawings = {}
        currentRoom.copycatAssignments = {}
        currentRoom.copycatPhase = "drawing"
        currentRoom.updateTotalRounds()
      }

      io.to(currentRoom.roomCode).emit("gameModeChanged", currentRoom)
    }
  }

  joinGame(io, socket, playerId, roomCode) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(roomCode)
    if (currentRoom) {
      for (let i = 0; i < currentRoom.players.length; i++) {
        const currentPlayer = currentRoom.players[i]

        if (currentPlayer.socketId === playerId) {
          socket.join(currentRoom.roomCode)

          currentPlayer.socketId = socket.id
          currentRoom.gameStarted = true
          currentRoom.mostRecentPlayer = currentPlayer

          socket.emit("joinComplete", currentRoom)
          io.to(currentRoom.roomCode).emit("playersChanged", currentRoom)

          // If we're in copycat mode and viewing phase, send the drawing to copy
          if (currentRoom.gameMode === "copycat" && currentRoom.copycatRound > 0) {
            if (currentRoom.copycatPhase === "viewing") {
              this.sendDrawingToCopy(socket, currentRoom, currentPlayer.nickname)
            }
          }

          return
        }
      }

      socket.emit("joinFailed")
    } else {
      socket.emit("joinFailed")
    }
  }

  async sendDrawingToCopy(socket, currentRoom, playerNickname) {
    try {
      // Get the assigned drawing from MongoDB
      const sourcePlayerNickname = currentRoom.copycatAssignments[playerNickname]
      if (!sourcePlayerNickname) return

      const previousRound = currentRoom.copycatRound - 1
      const drawing = await Drawing.findOne({
        roomCode: currentRoom.roomCode,
        playerNickname: sourcePlayerNickname,
        round: previousRound,
      }).sort({ createdAt: -1 })

      if (drawing && drawing.drawingData) {
        socket.emit("drawingToCopy", {
          drawer: { nickname: playerNickname },
          drawingData: drawing.drawingData,
          sourcePlayer: sourcePlayerNickname,
        })
      }
    } catch (error) {
      console.error("Error fetching drawing to copy:", error)
    }
  }

  setupRound(roomCode) {
    const currentRoom = this.getRoomByCode(roomCode)
    if (currentRoom) {
      currentRoom.chooseDrawer()
      currentRoom.chooseWord()

      // For copycat mode, if we're in a viewing phase, start the viewing timer
      if (
        currentRoom.gameMode === "copycat" &&
        currentRoom.copycatRound > 0 &&
        currentRoom.copycatPhase === "viewing" &&
        this.io // Make sure io is available
      ) {
        this.startViewingTimer(roomCode)
      }
    }
    return currentRoom
  }

  // Start a timer for the viewing phase in copycat mode
  startViewingTimer(roomCode) {
    const currentRoom = this.getRoomByCode(roomCode)
    if (!currentRoom || currentRoom.gameMode !== "copycat" || currentRoom.copycatPhase !== "viewing" || !this.io) {
      return
    }

    // Clear any existing timer
    if (this.viewingTimers[roomCode]) {
      clearInterval(this.viewingTimers[roomCode])
    }

    // Store io and room in local variables to use in the callback
    const io = this.io

    // Start a new timer
    this.viewingTimers[roomCode] = setInterval(() => {
      const timeRemaining = currentRoom.updateViewingTime()

      // Emit the time update using the stored io reference
      if (io) {
        io.to(roomCode).emit("viewingTimeUpdate", { timeRemaining })
      }

      // If time is up, switch to drawing phase
      if (timeRemaining <= 0) {
        clearInterval(this.viewingTimers[roomCode])
        delete this.viewingTimers[roomCode]

        currentRoom.startDrawingPhase()
        if (io) {
          io.to(roomCode).emit("copycatPhaseChange", {
            room: currentRoom,
            roundDescription: currentRoom.getRoundDescription(),
            phaseDescription: currentRoom.getPhaseDescription(),
          })
        }
      }
    }, 1000)
  }

  async newRound(io, roomCode) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(roomCode)

    if (!currentRoom) {
      io.to(roomCode).emit("endGame", currentRoom)
      return
    }

    if (currentRoom.gameMode === "guess") {
      // Original game mode
      if (currentRoom.availableDrawers.length === 0) {
        io.to(roomCode).emit("endGame", currentRoom)
        return
      }
    } else if (currentRoom.gameMode === "copycat") {
      // Copycat mode - check if we need to advance to the next round
      const gameActive = currentRoom.advanceCopycatRound()
      if (!gameActive) {
        // Game is over
        io.to(roomCode).emit("endGame", currentRoom)
        return
      }
      if (currentRoom.copycatPhase === "viewing") {
        // Load all drawings from the previous round
        const previousRound = currentRoom.copycatRound - 1
        const drawings = await Drawing.find({
          roomCode: currentRoom.roomCode,
          round: previousRound,
        })

        // Store them in the room for reference
        currentRoom.copycatDrawings = {}
        drawings.forEach((drawing) => {
          currentRoom.copycatDrawings[drawing.playerNickname] = drawing.drawingData
        })

        // Assign drawings to players
        currentRoom.assignDrawingsToCopy()

        // Send each player their assigned drawing
        for (const player of currentRoom.players) {
          const sourceNickname = currentRoom.copycatAssignments[player.nickname]
          if (sourceNickname && currentRoom.copycatDrawings[sourceNickname]) {
            io.to(player.socketId).emit("drawingToCopy", {
              drawingData: currentRoom.copycatDrawings[sourceNickname],
              sourcePlayer: sourceNickname,
            })
          }
        }
      }
    }

    io.to(currentRoom.roomCode).emit("newGame", {
      ...currentRoom,
      roundDescription: currentRoom.getRoundDescription(),
      phaseDescription: currentRoom.getPhaseDescription(),
    })
  }

  async sendDrawingToAllPlayers(io, currentRoom, playerNickname) {
    try {
      // Get the assigned drawing from MongoDB
      const sourcePlayerNickname = currentRoom.copycatAssignments[playerNickname]
      if (!sourcePlayerNickname) return

      const previousRound = currentRoom.copycatRound - 1
      const drawing = await Drawing.findOne({
        roomCode: currentRoom.roomCode,
        playerNickname: sourcePlayerNickname,
        round: previousRound,
      }).sort({ createdAt: -1 })

      if (drawing && drawing.drawingData) {
        io.to(currentRoom.roomCode).emit("drawingToCopy", {
          drawer: { nickname: playerNickname },
          drawingData: drawing.drawingData,
          sourcePlayer: sourcePlayerNickname,
        })
      }
    } catch (error) {
      console.error("Error fetching drawing to copy:", error)
    }
  }

  endRound(io, player) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(player.roomCode)
    if (!currentRoom) return

    for (let i = 0; i < currentRoom.players.length; i++) {
      if (currentRoom.players[i].nickname === player.nickname) {
        currentRoom.players[i].ready = true
        break
      }
    }

    currentRoom.checkEveryoneReady()

    if (currentRoom.gameMode === "guess") {
      // Original game mode
      io.to(currentRoom.roomCode).emit("wordWas", `A palavra era: ${currentRoom.word}`)
    }

    if (currentRoom.everyoneReady) {
      this.newRound(io, player.roomCode)
    }
  }

  guessWord(io, player, word) {
    this.io = io // Store io reference
    let playerIndex = 0
    const currentRoom = this.getRoomByCode(player.roomCode)
    if (!currentRoom) return

    if (currentRoom.word === word && !player.alreadyPointed) {
      for (let i = 0; i < currentRoom.players.length; i++) {
        if (currentRoom.players[i].nickname === player.nickname) {
          playerIndex = i
          break
        }
      }

      const timeRemaining = Number.parseInt(currentRoom.timeRemaining || 120)
      let pointsEarned = 1

      if (timeRemaining > 90) {
        pointsEarned = 5
      } else if (timeRemaining > 60) {
        pointsEarned = 4
      } else if (timeRemaining > 30) {
        pointsEarned = 3
      } else if (timeRemaining > 10) {
        pointsEarned = 2
      }

      currentRoom.players[playerIndex].points += pointsEarned
      currentRoom.players[playerIndex].alreadyPointed = true

      if (currentRoom.drawer) {
        for (let i = 0; i < currentRoom.players.length; i++) {
          if (currentRoom.players[i].nickname === currentRoom.drawer.nickname) {
            currentRoom.players[i].points += 1
            break
          }
        }
      }

      io.to(currentRoom.roomCode).emit("guessedRight", currentRoom, player, pointsEarned)
    } else {
      io.to(currentRoom.roomCode).emit("guessedWrong", currentRoom, player)
    }
  }

  drawing(io, player, data) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(player.roomCode)
    if (currentRoom) {
      io.to(currentRoom.roomCode).emit("playerDrawing", data)
    }
  }

  async saveDrawing(io, player, drawingData) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(player.roomCode)
    if (!currentRoom || currentRoom.gameMode !== "copycat") return

    try {
      // Save drawing to MongoDB
      const newDrawing = new Drawing({
        roomCode: currentRoom.roomCode,
        playerNickname: player.nickname,
        round: currentRoom.copycatRound,
        drawingData: drawingData,
        originalDrawer: currentRoom.copycatRound > 0 ? currentRoom.copycatAssignments[player.nickname] : null,
      })

      await newDrawing.save()
      console.log(`Drawing saved for player ${player.nickname} in round ${currentRoom.copycatRound}`)
    } catch (error) {
      console.error("Error saving drawing:", error)
    }
  }

  clearBoard(io, player) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(player.roomCode)
    if (currentRoom) {
      io.to(currentRoom.roomCode).emit("resetBoard")
    }
  }

  updateTimeRemaining(io, roomCode, timeRemaining) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(roomCode)
    if (currentRoom) {
      currentRoom.timeRemaining = timeRemaining
    }
  }

  randomizeWord() {
    const number = RoomUtils.randomIndex(0, this.words.length)
    this.word = this.list.pop(number)
  }
}

module.exports = LobbyController
