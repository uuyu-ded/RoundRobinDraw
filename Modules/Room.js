const RoomUtils = require("./RoomUtils")

class Room {
  constructor(maxPlayers, roomCode) {
    this.maxPlayers = maxPlayers
    this.players = []
    this.availableDrawers = []
    this.roomCode = roomCode
    this.mostRecentPlayer = undefined
    this.everyoneReady = false
    this.gameStarted = false
    this.drawerIndex = 0
    this.drawer = undefined
    this.timeRemaining = 120
    this.gameMode = "guess" // Default game mode is "guess", alternative is "copycat"
    this.copycatRound = 0 // Track which round we're in for copycat mode (0 = initial drawing round)
    this.copycatDrawings = {} // Store drawings from previous rounds for copycat mode
    this.copycatAssignments = {} // Track which player is copying which drawing
    this.copycatPhase = "drawing" // "viewing" or "drawing"
    this.viewingTimeRemaining = 20 // Time to view the reference drawing (in seconds)
    this.totalRounds = 0 // Total number of rounds to play in copycat mode
    this.words = [
      "Astronauta",
      "Leite",
      "Pescador",
      "Livro",
      "Melancia",
      "Escola",
      "Macaco",
      "Palma",
      "Margarida",
      "Cérebro",
      "Lagarto",
      "Saco",
      "Saia",
      "Violão",
      "Cometa",
      "Hamburger",
      "Giz",
      "Rosa",
      "Alface",
      "Vendedor",
      "Tambor",
      "Pente",
      "Tempestade",
      "Salto",
      "Ouro",
      "Meia",
    ]
    this.word = undefined
  }

  addPlayer(player) {
    this.players.push(player)
    this.mostRecentPlayer = player

    // Update total rounds based on player count for copycat mode
    if (this.gameMode === "copycat") {
      this.updateTotalRounds()
    }
  }

  updateTotalRounds() {
    // Set total rounds based on player count
    // Each player should get a chance to copy each other player's drawing
    this.totalRounds = this.players.length
  }

  setupAvaialbleDrawers() {
    this.availableDrawers = [...this.players]
  }

  checkEveryoneReady() {
    if (!this.players || this.players.length === 0) {
      this.everyoneReady = false
      return
    }

    this.everyoneReady = true // Start with true and set to false if any player is not ready

    for (let i = 0; i < this.players.length; i++) {
      console.log(`Checking player ${this.players[i].nickname}, ready: ${this.players[i].ready}`)
      if (!this.players[i].ready) {
        this.everyoneReady = false
        return
      }
    }

    console.log("Everyone is ready!")
  }

  chooseDrawer() {
    if (!this.availableDrawers || this.availableDrawers.length === 0) {
      return
    }

    if (this.gameMode === "guess") {
      // Original game mode - choose a random drawer
      const drawerIndex = RoomUtils.randomIndex(0, this.availableDrawers.length - 1)
      this.drawer = this.availableDrawers.splice(drawerIndex, 1)[0]
    } else if (this.gameMode === "copycat") {
      // Copycat mode - everyone draws
      this.drawer = { nickname: "Everyone", isEveryone: true }
    }
  }

  chooseWord() {
    if (this.gameMode === "guess") {
      if (!this.words || this.words.length === 0) {
        return
      }
      const wordIndex = RoomUtils.randomIndex(0, this.words.length - 1)
      this.word = this.words[wordIndex]
    } else if (this.gameMode === "copycat") {
      // For copycat mode, we don't need a word
      if (this.copycatRound === 0) {
        this.word = "Draw anything!"
      } else {
        this.word = "Copy the drawing from memory!"
      }
    }
  }

  // Assign drawings for players to copy
  assignDrawingsToCopy() {
    if (this.gameMode === "copycat" && this.players.length > 0) {
      this.copycatAssignments = {}

      // Get all drawings from the previous round
      const previousRound = this.copycatRound - 1

      // Create a list of available drawings (excluding your own)
      const availableDrawings = this.players.map((player) => player.nickname)

      // Assign each player a random drawing to copy
      this.players.forEach((player) => {
        // Filter out the player's own drawing
        const possibleAssignments = availableDrawings.filter((nick) => nick !== player.nickname)

        if (possibleAssignments.length > 0) {
          // Randomly select one
          const randomIndex = RoomUtils.randomIndex(0, possibleAssignments.length - 1)
          this.copycatAssignments[player.nickname] = possibleAssignments[randomIndex]

          // Remove this assignment from available options
          const index = availableDrawings.indexOf(this.copycatAssignments[player.nickname])
          if (index !== -1) {
            availableDrawings.splice(index, 1)
          }
        } else {
          // Fallback if no other drawings available
          this.copycatAssignments[player.nickname] = this.players[0].nickname
        }
      })
    }
  }

  // Fisher-Yates shuffle algorithm
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  // Start the viewing phase for copycat mode
  startViewingPhase() {
    if (this.gameMode === "copycat") {
      this.copycatPhase = "viewing"
      this.viewingTimeRemaining = 20 // Reset viewing time
      this.assignDrawingsToCopy()
    }
  }

  // Start the drawing phase for copycat mode
  startDrawingPhase() {
    if (this.gameMode === "copycat") {
      this.copycatPhase = "drawing"
    }
  }

  // Advance to the next copycat round
  advanceCopycatRound() {
    if (this.gameMode === "copycat") {
      this.copycatRound++

      // Reset all players' ready status at the start of each round
      this.players.forEach((player) => {
        player.ready = false
        player.alreadyPointed = false
      })
      this.everyoneReady = false

      // Check if we've completed all rounds
      if (this.copycatRound > this.totalRounds) {
        // Game is over
        return false
      }

      // For round 1, we start with viewing phase
      if (this.copycatRound === 1) {
        this.startViewingPhase()
      } else if (this.copycatRound > 1) {
        // For subsequent rounds, alternate between viewing and drawing
        if (this.copycatPhase === "drawing") {
          this.startViewingPhase()
        } else {
          this.startDrawingPhase()
        }
      }

      return true
    }
    return true
  }

  // Update viewing time remaining
  updateViewingTime() {
    if (this.gameMode === "copycat" && this.copycatPhase === "viewing" && this.viewingTimeRemaining > 0) {
      this.viewingTimeRemaining--
      return this.viewingTimeRemaining
    }
    return 0
  }

  // Get round description for UI
  getRoundDescription() {
    if (this.gameMode !== "copycat") return ""

    if (this.copycatRound === 0) {
      return "Round 1: Draw anything you want!"
    } else {
      return `Round ${this.copycatRound + 1}: Copy the drawing from memory!`
    }
  }

  // Get phase description for UI
  getPhaseDescription() {
    if (this.gameMode !== "copycat") return ""

    if (this.copycatPhase === "viewing") {
      return "Memorize this drawing!"
    } else {
      if (this.copycatRound === 0) {
        return "Draw anything you want!"
      } else {
        return "Draw from memory!"
      }
    }
  }
}

module.exports = Room
