// Add game mode selector for the host
const roomCodeHeader = document.getElementById("roomCodeHeader")
const playersHeader = document.getElementById("playersHeader")
const playersList = document.getElementById("players")
const lobbyHeader = document.getElementById("lobbyHeader")
const lobbyCanvas = document.getElementById("lobbyCanvas")
const readyButton = document.getElementById("lobbyReady")
const resetCanvaBtn = document.querySelector("#reset-canvas")
const copyRoomCodeBtn = document.getElementById("copyRoomCodeBtn")
const copyNotification = document.getElementById("copyNotification")
const gameModeSelector = document.getElementById("gameModeSelector")

let player
let socket
let currentRoom

const queryString = window.location.search
const urlParams = new URLSearchParams(queryString)

const lobbyType = urlParams.get("type")
const nickname = urlParams.get("nickname")
const roomCode = urlParams.get("roomCode")

let startGameTimer

const initialCont = 5
let startGameSeconds = initialCont

const context = lobbyCanvas.getContext("2d")

let drawing = false

const currentCanvasPosition = { color: "black", x: 0, y: 0 }
const targetCanvasPosition = { color: "black", x: 0, y: 0 }

function startGame(start) {
  if (start && !startGameTimer) {
    startGameTimer = setInterval(() => {
      if (startGameSeconds === 0) {
        window.location.href = `/game?roomCode=${currentRoom.roomCode}&playerId=${socket.id}&playerNick=${nickname}`
      } else {
        lobbyHeader.innerHTML = `Game starting in ${startGameSeconds}`
        startGameSeconds--
      }
    }, 1000)
  } else {
    clearInterval(startGameTimer)
    startGameTimer = undefined
    startGameSeconds = 5
    lobbyHeader.innerHTML = "Waiting Room"
  }
}

function updatePlayerList() {
  if (!currentRoom || !currentRoom.gameStarted) {
    playersList.innerHTML = ""
    if (currentRoom && currentRoom.players) {
      playersHeader.innerHTML = `Players - ${currentRoom.players.length}/${currentRoom.maxPlayers}`

      for (let i = 0; i < currentRoom.maxPlayers; i++) {
        const p = document.createElement("p")

        if (currentRoom.players[i]) {
          p.className = "player joined"
          const characterImg = document.createElement("img")
          characterImg.src = `../img/characters/character${currentRoom.players[i].character}.png`
          characterImg.className = "player-avatar"
          characterImg.alt = "Player avatar"

          p.appendChild(characterImg)
          p.appendChild(document.createTextNode(currentRoom.players[i].nickname))

          if (currentRoom.players[i].ready) {
            p.innerHTML += " 👍"
          }
        } else {
          p.className = "player empty"
          p.innerHTML = "Empty"
        }

        playersList.appendChild(p)
      }

      // Show game mode selector only for the host (first player)
      if (currentRoom.players.length > 0 && currentRoom.players[0].nickname === nickname) {
        gameModeSelector.style.display = "block"
        gameModeSelector.value = currentRoom.gameMode || "guess"
      } else {
        gameModeSelector.style.display = "none"
      }

      if (currentRoom.everyoneReady) {
        startGame(true)
      } else {
        startGame(false)
      }
    }
  }
}

function copyRoomCode() {
  if (currentRoom && currentRoom.roomCode) {
    navigator.clipboard
      .writeText(currentRoom.roomCode)
      .then(() => {
        copyNotification.classList.add("show")

        setTimeout(() => {
          copyNotification.classList.remove("show")
        }, 2000)
      })
      .catch((err) => {
        console.error("Failed to copy room code: ", err)
      })
  }
}

function changeGameMode(event) {
  if (currentRoom && currentRoom.players.length > 0 && currentRoom.players[0].nickname === nickname) {
    const newMode = event.target.value
    socket.emit("changeGameMode", currentRoom.roomCode, newMode)
  }
}

function throttle(callback, delay) {
  let previousCall = new Date().getTime()
  return (...args) => {
    const time = new Date().getTime()
    if (time - previousCall >= delay) {
      previousCall = time
      callback.apply(null, args)
    }
  }
}

function relMouseCoords(event, position) {
  let totalOffsetX = 0
  let totalOffsetY = 0
  let currentElement = event.target

  do {
    totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft
    totalOffsetY += currentElement.offsetTop - currentElement.scrollTop
    currentElement = currentElement.offsetParent
  } while (currentElement)

  position.x = (event.pageX || (event.touches && event.touches[0] ? event.touches[0].pageX : 0)) - totalOffsetX
  position.y = (event.pageY || (event.touches && event.touches[0] ? event.touches[0].pageY : 0)) - totalOffsetY
}

function drawLine(x0, y0, x1, y1, color, emit) {
  if (!emit) {
    const rect = lobbyCanvas.getBoundingClientRect()
    const widthMultiplier = lobbyCanvas.width / rect.width

    context.beginPath()
    context.moveTo(x0 * widthMultiplier, y0 * widthMultiplier)
    context.lineTo(x1 * widthMultiplier, y1 * widthMultiplier)
    context.strokeStyle = color
    context.lineWidth = 2
    context.stroke()
    context.closePath()

    return
  }

  socket.emit(
    "lobbyDrawing",
    {
      x0,
      y0,
      x1,
      y1,
      color,
    },
    player,
  )
}

function onResetBtnClick() {
  context.clearRect(0, 0, lobbyCanvas.width, lobbyCanvas.height)
}

function changeColor(event) {
  currentCanvasPosition.color = event.target.value
}

function selectColor() {
  const penColor = document.querySelector("#pen-color")
  penColor.value = currentCanvasPosition.color
  penColor.addEventListener("input", changeColor, false)
  penColor.select()
}

function onReadyClick() {
  console.log("[onReadyClick] Current player:", player)

  if (!player || !player.roomCode) {
    console.error("[onReadyClick] Player or roomCode is missing:", player)
    showErrorMessage("Player data is incomplete. Please refresh the page.")
    return
  }

  if (readyButton.className === "readyButton ready") {
    readyButton.className = "readyButton cancel"
    readyButton.innerHTML = "Cancel"
    player.ready = true

    // Log the player data being sent
    console.log("[onReadyClick] Setting player ready:", player)

    // Make sure we're sending the complete player object
    socket.emit("playerReadyChanged", {
      nickname: player.nickname,
      roomCode: player.roomCode,
      character: player.character,
      ready: true,
      socketId: socket.id,
    })
  } else {
    readyButton.className = "readyButton ready"
    readyButton.innerHTML = "Ready"
    player.ready = false

    // Log the player data being sent
    console.log("[onReadyClick] Setting player not ready:", player)

    // Make sure we're sending the complete player object
    socket.emit("playerReadyChanged", {
      nickname: player.nickname,
      roomCode: player.roomCode,
      character: player.character,
      ready: false,
      socketId: socket.id,
    })
  }
}

function showErrorMessage(message) {
  const errorNotification = document.createElement("div")
  errorNotification.className = "error-notification"
  errorNotification.textContent = message
  document.body.appendChild(errorNotification)

  setTimeout(() => {
    document.body.removeChild(errorNotification)
  }, 3000)
}

function onMouseDown(event) {
  drawing = true
  selectColor()
  relMouseCoords(event, currentCanvasPosition)
}

function onMouseUp(event) {
  if (!drawing) {
    return
  }
  drawing = false
  relMouseCoords(event, targetCanvasPosition)
  drawLine(
    currentCanvasPosition.x,
    currentCanvasPosition.y,
    targetCanvasPosition.x,
    targetCanvasPosition.y,
    currentCanvasPosition.color,
    true,
  )
}

function onMouseMove(event) {
  if (!drawing) {
    return
  }
  relMouseCoords(event, targetCanvasPosition)
  drawLine(
    currentCanvasPosition.x,
    currentCanvasPosition.y,
    targetCanvasPosition.x,
    targetCanvasPosition.y,
    currentCanvasPosition.color,
    true,
  )
  relMouseCoords(event, currentCanvasPosition)
}

function onJoinComplete(updatedRoom) {
  console.log("[onJoinComplete] Room data:", updatedRoom)
  currentRoom = updatedRoom
  roomCodeHeader.innerHTML = `Room ${currentRoom.roomCode}`
  updatePlayerList()
}

function onGameModeChanged(updatedRoom) {
  console.log("[onGameModeChanged] Room data:", updatedRoom)
  currentRoom = updatedRoom
  gameModeSelector.value = currentRoom.gameMode

  // Show a notification about the game mode change
  const modeNotification = document.createElement("div")
  modeNotification.className = "mode-notification"
  modeNotification.textContent = `Game mode changed to: ${currentRoom.gameMode === "guess" ? "Guessing" : "Copycat"}`
  document.body.appendChild(modeNotification)

  setTimeout(() => {
    document.body.removeChild(modeNotification)
  }, 3000)
}

function onReadyError(error) {
  console.error("[onReadyError]", error)
  showErrorMessage(error.message || "Error changing ready status")

  // Reset the ready button to match the player's status in the room
  if (currentRoom && currentRoom.players) {
    for (let i = 0; i < currentRoom.players.length; i++) {
      if (currentRoom.players[i].nickname === nickname) {
        if (currentRoom.players[i].ready) {
          readyButton.className = "readyButton cancel"
          readyButton.innerHTML = "Cancel"
        } else {
          readyButton.className = "readyButton ready"
          readyButton.innerHTML = "Ready"
        }
        break
      }
    }
  }
}

function onNickInUse() {
  lobbyHeader.innerHTML = "Nickname is already in use"
  setTimeout(() => {
    window.location.href = "/"
  }, 2000)
}

function onJoinFailed() {
  lobbyHeader.innerHTML = "Room not found!"
  setTimeout(() => {
    window.location.href = "/"
  }, 2000)
}

function onJoinFailedMaxPlayers() {
  lobbyHeader.innerHTML = "Room is full!"
  setTimeout(() => {
    window.location.href = "/"
  }, 2000)
}

function onPlayersChanged(updatedRoom) {
  console.log("[onPlayersChanged] Room data:", updatedRoom)
  currentRoom = updatedRoom
  updatePlayerList()

  // Update the ready button state to match the player's ready status in the room
  if (currentRoom && currentRoom.players) {
    for (let i = 0; i < currentRoom.players.length; i++) {
      if (currentRoom.players[i].nickname === nickname) {
        console.log(`[onPlayersChanged] Player ${nickname} ready status: ${currentRoom.players[i].ready}`)
        // Update the ready button to match the player's ready status
        if (currentRoom.players[i].ready) {
          readyButton.className = "readyButton cancel"
          readyButton.innerHTML = "Cancel"
        } else {
          readyButton.className = "readyButton ready"
          readyButton.innerHTML = "Ready"
        }
        break
      }
    }
  }
}

function onDrawingEvent(data) {
  drawLine(data.x0, data.y0, data.x1, data.y1, data.color, false)
}

function setupSocket() {
  // Make sure io is defined
  if (typeof io !== "undefined") {
    socket = io()

    socket.on("joinComplete", onJoinComplete)
    socket.on("joinFailed", onJoinFailed)
    socket.on("joinFailedMaxPlayers", onJoinFailedMaxPlayers)
    socket.on("nickInUse", onNickInUse)
    socket.on("gameModeChanged", onGameModeChanged)
    socket.on("readyError", onReadyError)

    socket.on("playersChanged", onPlayersChanged)
    socket.on("playerDrawing", onDrawingEvent)
  } else {
    console.error("Socket.io is not loaded!")
    lobbyHeader.innerHTML = "Error: Socket.io not loaded!"
  }
}

function checkParameters() {
  if (!lobbyType || !nickname || !roomCode) {
    window.location.href = "/"
  }
}

function initializeClient() {
  // Make sure socket is initialized before using it
  if (!socket) {
    console.error("Socket not initialized!")
    return
  }

  const characterId = urlParams.get("character") || "1"
  player = {
    nickname: nickname,
    roomCode: roomCode,
    character: characterId,
    ready: false,
    socketId: socket.id, // Add socketId to player object
  }

  console.log("[initializeClient] Initializing client with player:", player)

  if (lobbyType === "create") {
    socket.emit("createRoom", player)
  } else {
    socket.emit("joinRoom", player)
  }
}

// First setup the socket
setupSocket()
// Then check parameters
checkParameters()
// Then initialize the client
if (socket) {
  initializeClient()
}

// Add event listeners
readyButton.onclick = onReadyClick
resetCanvaBtn.onclick = onResetBtnClick
copyRoomCodeBtn.onclick = copyRoomCode
gameModeSelector.onchange = changeGameMode

lobbyCanvas.addEventListener("mousedown", onMouseDown, false)
lobbyCanvas.addEventListener("mouseup", onMouseUp, false)
lobbyCanvas.addEventListener("mouseout", onMouseUp, false)
lobbyCanvas.addEventListener("mousemove", throttle(onMouseMove, 10), false)

lobbyCanvas.addEventListener("touchstart", onMouseDown, false)
lobbyCanvas.addEventListener("touchend", onMouseUp, false)
lobbyCanvas.addEventListener("touchcancel", onMouseUp, false)
lobbyCanvas.addEventListener("touchmove", throttle(onMouseMove, 10), false)
