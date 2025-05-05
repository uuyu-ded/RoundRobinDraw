const Room = require("./Room")
const RoomUtils = require("./RoomUtils")
const Drawing = require("../models/Drawing")

class LobbyController {
  constructor() {
    this.rooms = []
    this.viewingTimers = {} // Store timers for copycat viewing phase
    this.io = null // Initialize io as null
    console.log("LobbyController initialized")
  }

  addRoom(room) {
    this.rooms.push(room)
    console.log(`Room added: ${room.roomCode}, Total rooms: ${this.rooms.length}`)
  }

  getRoomByCode(roomCode) {
    for (let i = 0; i < this.rooms.length; i++) {
      if (this.rooms[i].roomCode === roomCode) {
        return this.rooms[i]
      }
    }
    console.log(`Room not found: ${roomCode}`)
    return undefined
  }

  createRoom(socket, player) {
    player.socketId = socket.id
    console.log(`Creating room with code ${player.roomCode} for player ${player.nickname} (${player.socketId})`)

    let currentRoom = this.getRoomByCode(player.roomCode)

    if (!currentRoom) {
      currentRoom = new Room(5, player.roomCode)
      currentRoom.addPlayer(player)

      this.addRoom(currentRoom)
      socket.join(currentRoom.roomCode)
      console.log(`Player ${player.nickname} joined socket room ${currentRoom.roomCode}`)

      socket.emit("joinComplete", currentRoom)
      socket.emit("serverLog", `Room ${player.roomCode} created successfully`)
    } else {
      console.log(`Room ${player.roomCode} already exists`)
      socket.emit("joinFailed")
      socket.emit("serverLog", `Failed to create room: Room ${player.roomCode} already exists`)
    }
  }

  joinRoom(io, socket, player) {
    this.io = io // Store io reference
    player.socketId = socket.id
    console.log(`Player ${player.nickname} (${player.socketId}) attempting to join room ${player.roomCode}`)

    const currentRoom = this.getRoomByCode(player.roomCode)

    if (currentRoom && !currentRoom.gameStarted) {
      if (currentRoom.players.length >= currentRoom.maxPlayers) {
        console.log(`Room ${player.roomCode} is full`)
        socket.emit("joinFailedMaxPlayers")
        socket.emit("serverLog", `Failed to join: Room ${player.roomCode} is full`)
        return
      }

      if (!RoomUtils.checkRepeatedNicknames(player, currentRoom.players)) {
        console.log(`Nickname ${player.nickname} is already in use in room ${player.roomCode}`)
        socket.emit("nickInUse")
        socket.emit("serverLog", `Failed to join: Nickname ${player.nickname} is already in use`)
        return
      }

      currentRoom.addPlayer(player)
      currentRoom.everyoneReady = false

      console.log(`Player ${player.nickname} joined room ${player.roomCode}`)
      console.log(`Room ${player.roomCode} now has ${currentRoom.players.length} players`)

      // Log all players in the room
      currentRoom.players.forEach((p, index) => {
        console.log(`Player ${index + 1}: ${p.nickname}, Ready: ${p.ready}, SocketId: ${p.socketId}`)
      })

      io.to(currentRoom.roomCode).emit("playersChanged", currentRoom)
      io.to(currentRoom.roomCode).emit("serverLog", `Player ${player.nickname} joined the room`)

      socket.join(currentRoom.roomCode)
      console.log(`Player ${player.nickname} joined socket room ${currentRoom.roomCode}`)

      socket.emit("joinComplete", currentRoom)
      socket.emit("serverLog", `Successfully joined room ${player.roomCode}`)
    } else {
      if (!currentRoom) {
        console.log(`Room ${player.roomCode} not found`)
        socket.emit("serverLog", `Failed to join: Room ${player.roomCode} not found`)
      } else {
        console.log(`Game already started in room ${player.roomCode}`)
        socket.emit("serverLog", `Failed to join: Game already started in room ${player.roomCode}`)
      }
      socket.emit("joinFailed")
    }
  }

  removePlayerFromRooms(io, socket) {
    this.io = io // Store io reference
    const iterator = socket.rooms.values()
    let roomCode = iterator.next()?.value

    console.log(`Player with socket ID ${socket.id} disconnecting`)

    while (roomCode) {
      const currentRoom = this.getRoomByCode(roomCode)

      if (currentRoom && !currentRoom.gameStarted) {
        const newPlayersList = []
        let removedPlayer = null

        for (let i = 0; i < currentRoom.players.length; i++) {
          if (currentRoom.players[i].socketId !== socket.id) {
            newPlayersList.push(currentRoom.players[i])
          } else {
            removedPlayer = currentRoom.players[i].nickname
          }
        }

        if (removedPlayer) {
          console.log(`Player ${removedPlayer} removed from room ${roomCode}`)
        }

        currentRoom.players = newPlayersList
        currentRoom.checkEveryoneReady()

        console.log(`Room ${roomCode} now has ${currentRoom.players.length} players`)
        console.log(`Everyone ready: ${currentRoom.everyoneReady}`)

        io.to(currentRoom.roomCode).emit("playersChanged", currentRoom)
        if (removedPlayer) {
          io.to(currentRoom.roomCode).emit("serverLog", `Player ${removedPlayer} left the room`)
        }
      }

      roomCode = iterator.next()?.value
    }
  }

  changePlayerReady(io, socket, player) {
    this.io = io // Store io reference

    // Get the room code directly from the player object
    const roomCode = player.roomCode
    const currentRoom = this.getRoomByCode(roomCode)

    console.log(
      `[changePlayerReady] Player ${player.nickname} ready status changed to ${player.ready} in room ${roomCode}`,
    )
    console.log(`[changePlayerReady] Player socketId: ${player.socketId || "undefined"}, Socket ID: ${socket.id}`)

    if (!roomCode) {
      console.error("[changePlayerReady] No room code found in player object:", player)
      socket.emit("readyError", { message: "Room code not found in player data" })
      return
    }

    if (!currentRoom) {
      console.error(`[changePlayerReady] Room ${roomCode} not found`)
      socket.emit("readyError", { message: `Room ${roomCode} not found` })
      return
    }

    // Update the player's ready status
    let playerFound = false
    for (let i = 0; i < currentRoom.players.length; i++) {
      if (currentRoom.players[i].nickname === player.nickname) {
        console.log(`[changePlayerReady] Found player ${player.nickname} at index ${i}`)
        console.log(`[changePlayerReady] Changing ready status from ${currentRoom.players[i].ready} to ${player.ready}`)

        // Update the ready status
        currentRoom.players[i].ready = player.ready

        // Also update the socketId if it was undefined
        if (!currentRoom.players[i].socketId || currentRoom.players[i].socketId === undefined) {
          console.log(
            `[changePlayerReady] Updating player socketId from ${currentRoom.players[i].socketId} to ${socket.id}`,
          )
          currentRoom.players[i].socketId = socket.id
        }

        playerFound = true
        break
      }
    }

    if (!playerFound) {
      console.error(`[changePlayerReady] Player ${player.nickname} not found in room ${roomCode}`)
      socket.emit("readyError", { message: `Player ${player.nickname} not found in room ${roomCode}` })
      return
    }

    // Check if everyone is ready
    currentRoom.checkEveryoneReady()
    console.log(`[changePlayerReady] Everyone ready in room ${roomCode}: ${currentRoom.everyoneReady}`)

    // Log all players and their ready status
    console.log(`Players in room ${roomCode}:`)
    currentRoom.players.forEach((p, index) => {
      console.log(`Player ${index + 1}: ${p.nickname}, Ready: ${p.ready}, SocketId: ${p.socketId}`)
    })

    // Emit the updated player list to all clients
    io.to(currentRoom.roomCode).emit("playersChanged", currentRoom)
    io.to(currentRoom.roomCode).emit(
      "serverLog",
      `Player ${player.nickname} is ${player.ready ? "ready" : "not ready"}`,
    )

    // For copycat mode, handle rounds differently
    if (currentRoom.gameMode === "copycat") {
      console.log(`[changePlayerReady] Room ${roomCode} is in copycat mode`)

      if (currentRoom.everyoneReady) {
        console.log(`[changePlayerReady] Everyone is ready in copycat mode, advancing round`)

        // If everyone is ready, advance to the next round
        const gameActive = currentRoom.advanceCopycatRound()
        console.log(
          `[changePlayerReady] Advanced copycat round. Game active: ${gameActive}, Round: ${currentRoom.copycatRound}, Phase: ${currentRoom.copycatPhase}`,
        )

        if (!gameActive) {
          // Game is over
          console.log(`[changePlayerReady] Game over in room ${roomCode}`)
          io.to(currentRoom.roomCode).emit("endGame", currentRoom)
          io.to(currentRoom.roomCode).emit("serverLog", `Game over`)
          return
        }

        if (currentRoom.copycatRound > 0) {
          // Start a new round only if we're past the initial drawing round
          console.log(`[changePlayerReady] Starting new round for room ${roomCode}`)
          this.newRound(io, roomCode)
        } else {
          // Just update the UI for the initial drawing round
          io.to(currentRoom.roomCode).emit("playersChanged", currentRoom)
        }
      }
    } else {
      // Original game mode logic
      if (currentRoom.everyoneReady) {
        currentRoom.setupAvaialbleDrawers()
        this.setupRound(roomCode)
        this.newRound(io, roomCode)
      }
    }
  }

  changeGameMode(io, roomCode, gameMode) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(roomCode)
    if (currentRoom) {
      console.log(`Changing game mode in room ${roomCode} from ${currentRoom.gameMode} to ${gameMode}`)
      currentRoom.gameMode = gameMode

      // Reset copycat-specific properties when changing game mode
      if (gameMode === "copycat") {
        console.log(`Initializing copycat mode settings for room ${roomCode}`)
        currentRoom.copycatRound = 0
        currentRoom.copycatDrawings = {}
        currentRoom.copycatAssignments = {}
        currentRoom.copycatPhase = "drawing"
        currentRoom.updateTotalRounds()
        console.log(`Total rounds for copycat mode: ${currentRoom.totalRounds}`)
      }

      io.to(currentRoom.roomCode).emit("gameModeChanged", currentRoom)
      io.to(currentRoom.roomCode).emit("serverLog", `Game mode changed to ${gameMode}`)
    } else {
      console.error(`Room ${roomCode} not found when changing game mode`)
    }
  }

  joinGame(io, socket, playerId, roomCode) {
    this.io = io // Store io reference
    console.log(`Player with socket ID ${playerId} attempting to join game in room ${roomCode}`)

    const currentRoom = this.getRoomByCode(roomCode)
    if (currentRoom) {
      for (let i = 0; i < currentRoom.players.length; i++) {
        const currentPlayer = currentRoom.players[i]

        if (currentPlayer.socketId === playerId) {
          socket.join(currentRoom.roomCode)
          console.log(`Player ${currentPlayer.nickname} joined game in room ${roomCode}`)

          currentPlayer.socketId = socket.id
          currentRoom.gameStarted = true
          currentRoom.mostRecentPlayer = currentPlayer

          socket.emit("joinComplete", currentRoom)
          socket.emit("serverLog", `Successfully joined game in room ${roomCode}`)

          io.to(currentRoom.roomCode).emit("playersChanged", currentRoom)

          // If we're in copycat mode and viewing phase, send the drawing to copy
          if (currentRoom.gameMode === "copycat" && currentRoom.copycatRound > 0) {
            if (currentRoom.copycatPhase === "viewing") {
              console.log(`Sending drawing to copy to player ${currentPlayer.nickname}`)
              this.sendDrawingToCopy(socket, currentRoom, currentPlayer.nickname)
            }
          }

          return
        }
      }

      console.log(`Player with socket ID ${playerId} not found in room ${roomCode}`)
      socket.emit("joinFailed")
      socket.emit("serverLog", `Failed to join game: Player not found in room ${roomCode}`)
    } else {
      console.log(`Room ${roomCode} not found when joining game`)
      socket.emit("joinFailed")
      socket.emit("serverLog", `Failed to join game: Room ${roomCode} not found`)
    }
  }

  async sendDrawingToCopy(socket, currentRoom, playerNickname) {
    try {
      // Get the assigned drawing from MongoDB
      const sourcePlayerNickname = currentRoom.copycatAssignments[playerNickname]
      if (!sourcePlayerNickname) {
        console.log(`No source player assigned for ${playerNickname}`)
        return
      }

      console.log(`Fetching drawing for player ${playerNickname} to copy from ${sourcePlayerNickname}`)

      const previousRound = currentRoom.copycatRound - 1
      const drawing = await Drawing.findOne({
        roomCode: currentRoom.roomCode,
        playerNickname: sourcePlayerNickname,
        round: previousRound,
      }).sort({ createdAt: -1 })

      if (drawing && drawing.drawingData) {
        console.log(`Drawing found, sending to player ${playerNickname}`)
        socket.emit("drawingToCopy", {
          drawer: { nickname: playerNickname },
          drawingData: drawing.drawingData,
          sourcePlayer: sourcePlayerNickname,
        })
        socket.emit("serverLog", `You are copying ${sourcePlayerNickname}'s drawing`)
      } else {
        console.log(`No drawing found for ${sourcePlayerNickname} in round ${previousRound}`)
        socket.emit("serverLog", `Error: No drawing found to copy`)
      }
    } catch (error) {
      console.error("Error fetching drawing to copy:", error)
      socket.emit("serverLog", `Error fetching drawing to copy: ${error.message}`)
    }
  }

  setupRound(roomCode) {
    const currentRoom = this.getRoomByCode(roomCode)
    if (currentRoom) {
      console.log(`Setting up round for room ${roomCode}`)
      currentRoom.chooseDrawer()
      currentRoom.chooseWord()

      console.log(
        `Room ${roomCode}: Drawer: ${currentRoom.drawer ? currentRoom.drawer.nickname : "None"}, Word: ${currentRoom.word}`,
      )

      // For copycat mode, if we're in a viewing phase, start the viewing timer
      if (
        currentRoom.gameMode === "copycat" &&
        currentRoom.copycatRound > 0 &&
        currentRoom.copycatPhase === "viewing" &&
        this.io // Make sure io is available
      ) {
        console.log(`Starting viewing timer for room ${roomCode}`)
        this.startViewingTimer(roomCode)
      }
    }
    return currentRoom
  }

  // Start a timer for the viewing phase in copycat mode
  startViewingTimer(roomCode) {
    const currentRoom = this.getRoomByCode(roomCode)
    if (!currentRoom || currentRoom.gameMode !== "copycat" || currentRoom.copycatPhase !== "viewing" || !this.io) {
      console.log(`Cannot start viewing timer for room ${roomCode}`)
      return
    }

    // Clear any existing timer
    if (this.viewingTimers[roomCode]) {
      console.log(`Clearing existing viewing timer for room ${roomCode}`)
      clearInterval(this.viewingTimers[roomCode])
    }

    // Store io and room in local variables to use in the callback
    const io = this.io
    console.log(`Starting viewing timer for room ${roomCode}, initial time: ${currentRoom.viewingTimeRemaining}s`)

    // Start a new timer
    this.viewingTimers[roomCode] = setInterval(() => {
      const timeRemaining = currentRoom.updateViewingTime()
      console.log(`Room ${roomCode} viewing time remaining: ${timeRemaining}s`)

      // Emit the time update using the stored io reference
      if (io) {
        io.to(roomCode).emit("viewingTimeUpdate", { timeRemaining })
      }

      // If time is up, switch to drawing phase
      if (timeRemaining <= 0) {
        console.log(`Viewing time up for room ${roomCode}, switching to drawing phase`)
        clearInterval(this.viewingTimers[roomCode])
        delete this.viewingTimers[roomCode]

        currentRoom.startDrawingPhase()
        if (io) {
          io.to(roomCode).emit("copycatPhaseChange", {
            room: currentRoom,
            roundDescription: currentRoom.getRoundDescription(),
            phaseDescription: currentRoom.getPhaseDescription(),
          })
          io.to(roomCode).emit("serverLog", `Switching to drawing phase`)
        }
      }
    }, 1000)
  }

  // Fix the newRound method to ensure proper word selection
  async newRound(io, roomCode) {
    this.io = io // Store io reference
    console.log(`Starting new round for room ${roomCode}`)
    const currentRoom = this.getRoomByCode(roomCode)

    if (!currentRoom) {
      console.log(`Room ${roomCode} not found when starting new round`)
      io.to(roomCode).emit("endGame", currentRoom)
      io.to(roomCode).emit("serverLog", `Error: Room not found`)
      return
    }

    // Reset alreadyPointed flag for all players so they can earn points in the new round
    currentRoom.players.forEach((player) => {
      player.alreadyPointed = false
    })

    if (currentRoom.gameMode === "guess") {
      // Original game mode
      console.log(`Room ${roomCode} is in guess mode, available drawers: ${currentRoom.availableDrawers.length}`)
      if (currentRoom.availableDrawers.length === 0) {
        console.log(`No more drawers available in room ${roomCode}, ending game`)
        io.to(roomCode).emit("endGame", currentRoom)
        io.to(roomCode).emit("serverLog", `Game over: No more drawers available`)
        return
      }

      // Setup the round with a new drawer and word
      this.setupRound(roomCode)
    } else if (currentRoom.gameMode === "copycat") {
      // Copycat mode - check if we need to advance to the next round
      console.log(
        `Room ${roomCode} is in copycat mode, round: ${currentRoom.copycatRound}, phase: ${currentRoom.copycatPhase}`,
      )

      if (currentRoom.copycatPhase === "viewing" && currentRoom.copycatRound > 0) {
        // Load all drawings from the previous round
        console.log(`Loading drawings from round ${currentRoom.copycatRound - 1} for viewing phase`)
        const previousRound = currentRoom.copycatRound - 1
        try {
          const drawings = await Drawing.find({
            roomCode: currentRoom.roomCode,
            round: previousRound,
          })

          console.log(`Found ${drawings.length} drawings from previous round`)

          // Store them in the room for reference
          currentRoom.copycatDrawings = {}
          drawings.forEach((drawing) => {
            currentRoom.copycatDrawings[drawing.playerNickname] = drawing.drawingData
            console.log(`Stored drawing from player ${drawing.playerNickname}`)
          })

          // Assign drawings to players
          currentRoom.assignDrawingsToCopy()
          console.log(`Assigned drawings to copy:`)
          Object.entries(currentRoom.copycatAssignments).forEach(([player, source]) => {
            console.log(`${player} will copy ${source}'s drawing`)
          })

          // Send each player their assigned drawing
          for (const player of currentRoom.players) {
            const sourceNickname = currentRoom.copycatAssignments[player.nickname]
            if (sourceNickname && currentRoom.copycatDrawings[sourceNickname]) {
              io.to(player.socketId).emit("drawingToCopy", {
                drawingData: currentRoom.copycatDrawings[sourceNickname],
                sourcePlayer: sourceNickname,
              })
              io.to(player.socketId).emit("serverLog", `Memorize ${sourceNickname}'s drawing!`)
            }
          }
        } catch (error) {
          console.error("Error fetching previous drawings:", error)
        }
      } else {
        // Setup the round for copycat mode
        this.setupRound(roomCode)
      }
    }

    console.log(`Emitting new game event for room ${roomCode}`)
    io.to(roomCode).emit("newGame", {
      ...currentRoom,
      roundDescription: currentRoom.getRoundDescription(),
      phaseDescription: currentRoom.getPhaseDescription(),
    })
    io.to(roomCode).emit("serverLog", `Starting new round: ${currentRoom.getRoundDescription()}`)
  }

  async sendDrawingToAllPlayers(io, currentRoom, playerNickname) {
    try {
      // Get the assigned drawing from MongoDB
      const sourcePlayerNickname = currentRoom.copycatAssignments[playerNickname]
      if (!sourcePlayerNickname) {
        console.log(`No source player assigned for ${playerNickname}`)
        return
      }

      console.log(`Fetching drawing for player ${playerNickname} to show to all players`)

      const previousRound = currentRoom.copycatRound - 1
      const drawing = await Drawing.findOne({
        roomCode: currentRoom.roomCode,
        playerNickname: sourcePlayerNickname,
        round: previousRound,
      }).sort({ createdAt: -1 })

      if (drawing && drawing.drawingData) {
        console.log(`Drawing found, sending to all players in room ${currentRoom.roomCode}`)
        io.to(currentRoom.roomCode).emit("drawingToCopy", {
          drawer: { nickname: playerNickname },
          drawingData: drawing.drawingData,
          sourcePlayer: sourcePlayerNickname,
        })
      } else {
        console.log(`No drawing found for ${sourcePlayerNickname} in round ${previousRound}`)
      }
    } catch (error) {
      console.error("Error fetching drawing to copy:", error)
    }
  }

  endRound(io, player) {
    this.io = io // Store io reference
    console.log(`Player ${player.nickname} ending round in room ${player.roomCode}`)

    const currentRoom = this.getRoomByCode(player.roomCode)
    if (!currentRoom) {
      console.log(`Room ${player.roomCode} not found when ending round`)
      return
    }

    for (let i = 0; i < currentRoom.players.length; i++) {
      if (currentRoom.players[i].nickname === player.nickname) {
        console.log(`Setting player ${player.nickname} as ready for next round`)
        currentRoom.players[i].ready = true
        break
      }
    }

    currentRoom.checkEveryoneReady()
    console.log(`Everyone ready for next round: ${currentRoom.everyoneReady}`)

    if (currentRoom.gameMode === "guess") {
      // Original game mode
      console.log(`Revealing word "${currentRoom.word}" to all players`)
      io.to(currentRoom.roomCode).emit("wordWas", `A palavra era: ${currentRoom.word}`)
      io.to(currentRoom.roomCode).emit("serverLog", `The word was: ${currentRoom.word}`)
    }

    if (currentRoom.everyoneReady) {
      console.log(`Everyone is ready, starting new round in room ${player.roomCode}`)
      this.newRound(io, player.roomCode)
    }
  }

  guessWord(io, player, word) {
    this.io = io // Store io reference
    console.log(`Player ${player.nickname} guessing word "${word}" in room ${player.roomCode}`)

    let playerIndex = 0
    const currentRoom = this.getRoomByCode(player.roomCode)
    if (!currentRoom) {
      console.log(`Room ${player.roomCode} not found when guessing word`)
      return
    }

    if (currentRoom.word === word && !player.alreadyPointed) {
      console.log(`Correct guess by player ${player.nickname}!`)

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

      console.log(`Player ${player.nickname} earned ${pointsEarned} points`)
      currentRoom.players[playerIndex].points += pointsEarned
      currentRoom.players[playerIndex].alreadyPointed = true

      if (currentRoom.drawer) {
        for (let i = 0; i < currentRoom.players.length; i++) {
          if (currentRoom.players[i].nickname === currentRoom.drawer.nickname) {
            console.log(`Drawer ${currentRoom.drawer.nickname} earned 1 point`)
            currentRoom.players[i].points += 1
            break
          }
        }
      }

      io.to(currentRoom.roomCode).emit("guessedRight", currentRoom, player, pointsEarned)
      io.to(currentRoom.roomCode).emit(
        "serverLog",
        `${player.nickname} guessed correctly and earned ${pointsEarned} points!`,
      )
    } else {
      console.log(`Incorrect guess by player ${player.nickname}`)
      io.to(currentRoom.roomCode).emit("guessedWrong", currentRoom, player)
      io.to(player.socketId).emit("serverLog", `Incorrect guess`)
    }
  }

  drawing(io, player, data) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(player.roomCode)
    if (currentRoom) {
      // Don't log every drawing event as it would flood the console
      io.to(currentRoom.roomCode).emit("playerDrawing", data)
    }
  }

  async saveDrawing(io, player, drawingData) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(player.roomCode)
    if (!currentRoom || currentRoom.gameMode !== "copycat") return

    try {
      console.log(`Saving drawing from player ${player.nickname} in round ${currentRoom.copycatRound}`)

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
      io.to(player.socketId).emit("serverLog", `Your drawing was saved`)

      // Check if all players have saved their drawings
      const savedDrawings = await Drawing.find({
        roomCode: currentRoom.roomCode,
        round: currentRoom.copycatRound,
      })

      console.log(`${savedDrawings.length} drawings saved out of ${currentRoom.players.length} players`)

      // If all players have saved their drawings, show the album
      if (savedDrawings.length >= currentRoom.players.length) {
        console.log(`All players have saved their drawings, showing album for round ${currentRoom.copycatRound}`)
        this.fetchRoundDrawings(io, currentRoom.roomCode, currentRoom.copycatRound)
      }
    } catch (error) {
      console.error("Error saving drawing:", error)
      io.to(player.socketId).emit("serverLog", `Error saving drawing: ${error.message}`)
    }
  }

  clearBoard(io, player) {
    this.io = io // Store io reference
    console.log(`Player ${player.nickname} clearing board in room ${player.roomCode}`)

    const currentRoom = this.getRoomByCode(player.roomCode)
    if (currentRoom) {
      io.to(currentRoom.roomCode).emit("resetBoard")
      io.to(currentRoom.roomCode).emit("serverLog", `${player.nickname} cleared the board`)
    }
  }

  updateTimeRemaining(io, roomCode, timeRemaining) {
    this.io = io // Store io reference
    const currentRoom = this.getRoomByCode(roomCode)
    if (currentRoom) {
      currentRoom.timeRemaining = timeRemaining
      // Don't log every time update as it would flood the console
    }
  }

  randomizeWord() {
    const number = RoomUtils.randomIndex(0, this.words.length)
    this.word = this.list.pop(number)
    console.log(`Randomized word: ${this.word}`)
  }

  // Add this new method to handle drawing ratings
  async rateDrawing(io, data) {
    try {
      console.log(
        `Player ${data.raterNickname} rated ${data.drawerNickname}'s drawing ${data.rating} stars in room ${data.roomCode}`,
      )

      // You could store ratings in MongoDB if needed
      // For now, just broadcast the rating to all players in the room
      io.to(data.roomCode).emit("drawingRated", {
        drawerNickname: data.drawerNickname,
        rating: data.rating,
        raterNickname: data.raterNickname,
      })

      io.to(data.roomCode).emit(
        "serverLog",
        `${data.raterNickname} rated ${data.drawerNickname}'s drawing ${data.rating} stars`,
      )
    } catch (error) {
      console.error("Error rating drawing:", error)
    }
  }

  // Add this new method to fetch all drawings for the album review
  async fetchRoundDrawings(io, roomCode, round) {
    try {
      console.log(`Fetching all drawings for room ${roomCode} in round ${round}`)

      // Get all drawings from this round
      const drawings = await Drawing.find({
        roomCode: roomCode,
        round: round,
      })

      console.log(`Found ${drawings.length} drawings for album review`)

      // Send the drawings to all players in the room
      io.to(roomCode).emit("showAlbum", {
        drawings: drawings,
      })

      io.to(roomCode).emit("serverLog", `Showing album of ${drawings.length} drawings from round ${round}`)
    } catch (error) {
      console.error("Error fetching round drawings:", error)
    }
  }
}

module.exports = LobbyController
