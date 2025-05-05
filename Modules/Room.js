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
    this.albumShown = false // Track if we've shown the album for the current round
    this.words = [
      "Spaceship",
      "Banana",
      "Ghost",
      "Mermaid",
      "Volcano",
      "Robot",
      "Pizza",
      "Castle",
      "Dinosaur",
      "Rainbow",
      "Wizard",
      "Dessert",
      "Bomb",
      "Island",
      "Harmonica",
      "Hamburger",
      "Ben10",
      "Romania",
      "Birthday",
      "Vendedor",
      "Platypus",
      "Zombie",
      "Telescope",
      "Couple",
      "Cinema",
      "Moonwalk",
      "Mermaid",
      "Glinda",
      "Elpheba",
      "Origami",
      "Hourglass",
      "Lirilli Larilla",
      "Bonega Ambalabu",
      "Tung tung tung tung sahur",
      "Illuminati",
      "Virus",
      "Joker",
      "John Pork",
      "Pikachu",
      "Mickey Mouse",
      "Hamburger",
      "Chiikawa",
      "Iron Fist",
      "Emma Frost",
      "Iron Man",
      "Cloak and Dagger",
      "Tace cat",
      "Saitama",
      "Gojo",
      "Labubu",
      "Donald Trump",
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
        // Reset the word list if it's empty
        this.words = [
          "Spaceship",
          "Banana",
          "Ghost",
          "Mermaid",
          "Volcano",
          "Robot",
          "Pizza",
          "Castle",
          "Dinosaur",
          "Rainbow",
          "Wizard",
          "Dessert",
          "Bomb",
          "Island",
          "Harmonica",
          "Hamburger",
          "Ben10",
          "Romania",
          "Birthday",
          "Vendedor",
          "Platypus",
          "Zombie",
          "Telescope",
          "Couple",
          "Cinema",
          "Moonwalk",
          "Mermaid",
          "Glinda",
          "Elpheba",
          "Origami",
          "Hourglass",
          "Lirilli Larilla",
          "Bonega Ambalabu",
          "Tung tung tung tung sahur",
          "Illuminati",
          "Virus",
          "Joker",
          "John Pork",
          "Pikachu",
          "Mickey Mouse",
          "Hamburger",
          "Chiikawa",
          "Iron Fist",
          "Emma Frost",
          "Iron Man",
          "Cloak and Dagger",
          "Tace cat",
          "Saitama",
          "Gojo",
          "Labubu",
          "Donald Trump",
        ]
      }

      // Get a random word index
      const wordIndex = RoomUtils.randomIndex(0, this.words.length - 1)

      // Store the selected word
      this.word = this.words[wordIndex]

      // Remove the used word from the array to prevent repetition
      this.words = [...this.words.slice(0, wordIndex), ...this.words.slice(wordIndex + 1)]

      console.log(`Selected word: ${this.word}, Remaining words: ${this.words.length}`)
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
      console.log(`[advanceCopycatRound] Current round: ${this.copycatRound}, Phase: ${this.copycatPhase}`)

      if (this.copycatRound > 0 || this.copycatPhase === "drawing") {
        this.copycatRound++
      }
      console.log(`[advanceCopycatRound] Advanced to round: ${this.copycatRound}`)

      // Reset all players' ready status at the start of each round
      this.players.forEach((player) => {
        player.ready = false
        player.alreadyPointed = false
      })
      this.everyoneReady = false
      if (this.copycatRound >= this.totalRounds) {
        console.log(`[advanceCopycatRound] Game over - completed all rounds`)
        return false
      }
      this.copycatRound++

      // Reset the albumShown flag for the new round
      this.albumShown = false

      if (this.copycatRound === 0) {
        this.copycatPhase = "drawing"
      } else if (this.copycatRound % 2 === 0) {
        this.copycatPhase = "drawing"
      } else {
        this.copycatPhase = "viewing"
        this.viewingTimeRemaining = 20 // Reset viewing timer
      }

      console.log(`[advanceCopycatRound] New round state: Round ${this.copycatRound}, Phase: ${this.copycatPhase}`)
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
