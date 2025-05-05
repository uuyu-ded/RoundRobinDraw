const wordIpt = document.querySelector("#wordIpt")
const sendBtn = document.querySelector("#sendBtn")
const resetCanvaBtn = document.querySelector("#reset-canvas")
const timer = document.querySelector("#timer")
const imgClock = document.querySelector("#img-clock")
const roomCodeHeader = document.getElementById("roomCodeHeader")
const playersList = document.getElementById("players")
const gameHeader = document.getElementById("gameHeader")
const rightWord = document.getElementById("rightWord")
const gameCanvas = document.getElementById("gameCanvas")
const gameMode = document.getElementById("gameMode")

// Add these variables at the top with the other variable declarations
let albumMode = false
let currentAlbumIndex = 0
let albumDrawings = []
let ratings = {}

// Create these elements if they don't exist in the HTML
const roundInfo = document.getElementById("roundInfo") || document.createElement("p")
const copycatInfo = document.getElementById("copycatInfo") || document.createElement("p")
const referenceContainer = document.getElementById("referenceContainer") || document.createElement("div")

if (!document.getElementById("roundInfo")) {
  roundInfo.id = "roundInfo"
  roundInfo.className = "round-info"
  document.querySelector(".game-info")?.appendChild(roundInfo)
}

if (!document.getElementById("copycatInfo")) {
  copycatInfo.id = "copycatInfo"
  copycatInfo.className = "copycat-info"
  document.querySelector(".game-info")?.appendChild(copycatInfo)
}

if (!document.getElementById("referenceContainer")) {
  referenceContainer.id = "referenceContainer"
  referenceContainer.className = "reference-drawing-container"
  referenceContainer.style.display = "none"

  const referenceLabel = document.createElement("div")
  referenceLabel.className = "reference-drawing-label"
  referenceLabel.textContent = "Memorize This Drawing"

  const referenceCanvas = document.createElement("canvas")
  referenceCanvas.id = "referenceCanvas"
  referenceCanvas.className = "reference-drawing"
  referenceCanvas.width = 300
  referenceCanvas.height = 225

  referenceContainer.appendChild(referenceLabel)
  referenceContainer.appendChild(referenceCanvas)

  document.querySelector(".game-info")?.appendChild(referenceContainer)
}

// New tool elements
const pencilTool = document.getElementById("pencil-tool")
const eraserTool = document.getElementById("eraser-tool")
const bucketTool = document.getElementById("bucket-tool")
const dropperTool = document.getElementById("dropper-tool")
const undoBtn = document.getElementById("undo-btn")
const redoBtn = document.getElementById("redo-btn")
const brushSize = document.getElementById("brush-size")
const sizeDisplay = document.getElementById("size-display")
const colorSwatches = document.querySelectorAll(".color-swatch")

// Add these DOM element references after the other element references
const albumReviewContainer = document.getElementById("albumReviewContainer") || document.createElement("div")
const albumCanvas = document.getElementById("albumCanvas")
const albumContext = albumCanvas?.getContext("2d")
const prevDrawingBtn = document.getElementById("prevDrawing")
const nextDrawingBtn = document.getElementById("nextDrawing")
const drawingCounter = document.getElementById("drawingCounter")
const drawerNameElement = document.getElementById("drawerName")
const continueFromAlbumBtn = document.getElementById("continueFromAlbum")
const starRating = document.querySelectorAll(".star")

let socket
let player
let currentRoom

let rightWordwas = ""

const queryString = window.location.search
const urlParams = new URLSearchParams(queryString)
const playerId = urlParams.get("playerId")
const roomCode = urlParams.get("roomCode")
const playerNick = urlParams.get("playerNick")

let timerInterval

const initialCont = 120
let cont = initialCont

const initialStartGameSeconds = 5
let startGameSeconds = initialStartGameSeconds

const context = gameCanvas?.getContext("2d")
const referenceContext = document.getElementById("referenceCanvas")?.getContext("2d")

let drawing = false
let isDrawer = false
let isCopying = false // For copycat mode
let canDraw = false // Whether the player can draw in the current round
let isViewingReference = false // For copycat mode - viewing reference drawing
let referenceDrawingData = null // Store reference drawing data
let sourcePlayerNickname = null // Store the nickname of the player whose drawing is being copied

// Drawing history for undo/redo
let drawHistory = []
let redoStack = []
let currentStep = -1
const maxHistorySteps = 20

// Current tool and settings
let currentTool = "pencil"
const currentPos = { color: "#000000", x: 0, y: 0, size: 2 }
const targetPos = { color: "#000000", x: 0, y: 0, size: 2 }
let lastColor = "#000000" // Store last color for eraser toggle

// Add this function near the beginning of the file, after the variable declarations

function showServerLog(message) {
  const logNotification = document.createElement("div")
  logNotification.className = "server-log-notification"
  logNotification.textContent = message
  document.body.appendChild(logNotification)

  setTimeout(() => {
    document.body.removeChild(logNotification)
  }, 3000)
}

// Check if we're on the game page
const isGamePage = window.location.pathname.includes("/game") && gameCanvas !== null

// Only initialize game functionality if we're on the game page
if (isGamePage) {
  // Declare canvasDiv here
  const canvasDiv = document.getElementById("canvasDiv")

  function updatePlayerList() {
    playersList.innerHTML = ""

    for (let i = 0; i < currentRoom.maxPlayers; i++) {
      const p = document.createElement("p")

      if (currentRoom.players[i]) {
        p.className = "player joined"

        const characterImg = document.createElement("img")
        characterImg.src = `../img/characters/character${currentRoom.players[i].character}.png`
        characterImg.className = "player-avatar"
        characterImg.alt = "Player avatar"

        p.appendChild(characterImg)

        const playerInfo = document.createElement("span")
        const playerPoints = currentRoom.players[i].points || 0
        playerInfo.textContent = `${currentRoom.players[i].nickname} -  ${playerPoints}`
        playerInfo.id = `player-${currentRoom.players[i].nickname}`
        p.appendChild(playerInfo)
      } else {
        p.className = "player empty"
        p.innerHTML = "Empty"
      }

      playersList.appendChild(p)
    }

    // Display current game mode
    if (currentRoom && currentRoom.gameMode) {
      gameMode.textContent = `Mode: ${currentRoom.gameMode === "guess" ? "Guessing" : "Copycat"}`
      gameMode.style.display = "block"

      // Display round info for copycat mode
      if (currentRoom.gameMode === "copycat") {
        roundInfo.style.display = "block"
        if (currentRoom.roundDescription) {
          roundInfo.textContent = currentRoom.roundDescription
        } else {
          if (currentRoom.copycatRound === 0) {
            roundInfo.textContent = `Round: Drawing (1/${currentRoom.totalRounds || currentRoom.players.length})`
          } else {
            roundInfo.textContent = `Round: Copying (${currentRoom.copycatRound}/${currentRoom.totalRounds || currentRoom.players.length})`
          }
        }
      } else {
        roundInfo.style.display = "none"
      }
    }
  }

  function showPointsIndicator(points, targetElement) {
    const pointsIndicator = document.createElement("div")
    pointsIndicator.className = "points-indicator"
    pointsIndicator.textContent = `+${points}`

    const rect = targetElement.getBoundingClientRect()
    pointsIndicator.style.left = `${rect.left + rect.width / 2}px`
    pointsIndicator.style.top = `${rect.top}px`

    document.body.appendChild(pointsIndicator)

    setTimeout(() => {
      document.body.removeChild(pointsIndicator)
    }, 1500)
  }

  function hideToolBar() {
    const control = document.getElementById("controls")
    control.style.display = "none"
  }

  function showToolBar() {
    const control = document.getElementById("controls")
    control.style.display = "flex"
  }

  function getDrawer() {
    if (currentRoom.gameMode === "guess") {
      // Guessing mode (original game mode)
      if (currentRoom.drawer && currentRoom.drawer.nickname === playerNick) {
        gameHeader.innerHTML = `Draw word: '${currentRoom.word}'`
        isDrawer = true
        isCopying = false
        canDraw = true
        wordIpt.style.display = "none"
        sendBtn.style.display = "none"
        showToolBar()
      } else {
        gameHeader.innerHTML = `'${currentRoom.drawer ? currentRoom.drawer.nickname : "Someone"}' is drawing`
        gameCanvas.style.cursor = "not-allowed"
        isDrawer = false
        isCopying = false
        canDraw = false
        wordIpt.style.display = "block"
        sendBtn.style.display = "block"
        hideToolBar()
      }
    } else if (currentRoom.gameMode === "copycat") {
      copycatInfo.style.display = "block"
      referenceContainer.style.display = "none"

      if (currentRoom.copycatPhase === "drawing") {
        if (currentRoom.copycatRound === 0) {
          gameHeader.innerHTML = "Draw anything you want!";
          copycatInfo.textContent = "Draw anything! This will be used in later rounds.";
        } else {
          gameHeader.innerHTML = "Now draw from memory!";
          copycatInfo.textContent = `Draw ${sourcePlayerNickname}'s drawing from memory!`;
        }
        
        isDrawer = true;
        isCopying = currentRoom.copycatRound > 0;
        isViewingReference = false;
        canDraw = true;
        wordIpt.style.display = "none";
        sendBtn.style.display = "none";
        showToolBar();
      } 
      else if (currentRoom.copycatPhase === "viewing") {
        gameHeader.innerHTML = `Memorize this drawing! (${currentRoom.viewingTimeRemaining}s)`;
        copycatInfo.textContent = `Memorize ${sourcePlayerNickname}'s drawing!`;
        
        isDrawer = false;
        isCopying = false;
        isViewingReference = true;
        canDraw = false;
        wordIpt.style.display = "none";
        sendBtn.style.display = "none";
        hideToolBar();
        
        referenceContainer.style.display = "block";
      }
    }
  }
  function stopTimer() {
    timer.innerHTML = "0:00"
    imgClock.classList.add("animate")
    wordIpt.value = ""
    wordIpt.style.display = "none"
    sendBtn.style.display = "none"
    isDrawer = false
    isCopying = false
    canDraw = false

    // For copycat mode, save the drawing at the end of the round
    if (currentRoom && currentRoom.gameMode === "copycat") {
      saveCurrentDrawing()
    }

    socket.emit("endRound", player)
    clearInterval(timerInterval)
  }

  function saveCurrentDrawing() {
    // Save the current drawing for copycat mode
    const drawingData = gameCanvas.toDataURL()
    socket.emit("saveDrawing", drawingData, player)
  }

  function initTimer() {
    rightWord.innerHTML = ""
    rightWord.style.display = "none"
    timerInterval = setInterval(() => {
      cont--
      const time = new Date(cont * 1000).toISOString().substr(15, 4)
      timer.innerHTML = time

      socket.emit("updateTimeRemaining", roomCode, cont)

      if (cont <= 0) {
        stopTimer()
      }
    }, 1000)
  }

  function guessedRight() {
    wordIpt.style.display = "none"
    sendBtn.style.display = "none"
    rightWord.innerHTML = wordIpt.value
    rightWord.style.display = "block"
    rightWord.style.color = "green"
  }

  function guessedWrong() {
    wordIpt.value = ""
    wordIpt.style.color = "red"
    setTimeout(() => {
      wordIpt.style.color = "" 
    }, 1000)
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

  function relMouseCoords(e, position) {
    let totalOffsetX = 0
    let totalOffsetY = 0
    let currentElement = e.target

    do {
      totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft
      totalOffsetY += currentElement.offsetTop - currentElement.scrollTop
      currentElement = currentElement.offsetParent
    } while (currentElement)

    position.x = (e.pageX || (e.touches && e.touches[0] ? e.touches[0].pageX : 0)) - totalOffsetX
    position.y = (e.pageY || (e.touches && e.touches[0] ? e.touches[0].pageY : 0)) - totalOffsetY
  }

  // Save canvas state to history
  function saveCanvasState() {
    // If we're not at the end of the history, truncate it
    if (currentStep < drawHistory.length - 1) {
      drawHistory = drawHistory.slice(0, currentStep + 1)
      redoStack = []
    }

    // Add current state to history
    drawHistory.push(gameCanvas.toDataURL())

    // Limit history size
    if (drawHistory.length > maxHistorySteps) {
      drawHistory.shift()
    }

    currentStep = drawHistory.length - 1

    // Update undo/redo buttons
    updateUndoRedoButtons()
  }

  // Update undo/redo buttons state
  function updateUndoRedoButtons() {
    undoBtn.disabled = currentStep < 0
    redoBtn.disabled = redoStack.length === 0

    if (undoBtn.disabled) {
      undoBtn.classList.add("disabled")
    } else {
      undoBtn.classList.remove("disabled")
    }

    if (redoBtn.disabled) {
      redoBtn.classList.add("disabled")
    } else {
      redoBtn.classList.remove("disabled")
    }
  }

  // Undo last drawing action
  function undoAction() {
    if (currentStep > 0) {
      redoStack.push(drawHistory[currentStep])
      currentStep--

      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        context.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
        context.drawImage(img, 0, 0)

        // Emit the canvas state to other players
        socket.emit("canvasState", { imageData: drawHistory[currentStep], roomCode }, player)
      }
      img.src = drawHistory[currentStep]

      updateUndoRedoButtons()
    }
  }

  // Redo previously undone action
  function redoAction() {
    if (redoStack.length > 0) {
      const redoState = redoStack.pop()
      currentStep++
      drawHistory[currentStep] = redoState

      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        context.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
        context.drawImage(img, 0, 0)

        // Emit the canvas state to other players
        if (!currentRoom || currentRoom.gameMode !== "copycat" || (currentRoom.gameMode === "guess" && isDrawer)) {
          socket.emit("canvasState", { imageData: drawHistory[currentStep], roomCode }, player)
        }
      }
      img.src = redoState

      updateUndoRedoButtons()
    }
  }

  // Fill an area with color (paint bucket tool)
  function floodFill(startX, startY, fillColor) {
    // Get canvas pixel data
    const imageData = context.getImageData(0, 0, gameCanvas.width, gameCanvas.height)
    const data = imageData.data

    // Get the color at the start position
    const startPos = (startY * gameCanvas.width + startX) * 4
    const startR = data[startPos]
    const startG = data[startPos + 1]
    const startB = data[startPos + 2]
    const startA = data[startPos + 3]

    // Convert fill color from hex to RGBA
    const fillColorObj = hexToRgb(fillColor)

    // Don't fill if the color is the same
    if (startR === fillColorObj.r && startG === fillColorObj.g && startB === fillColorObj.b) {
      return
    }

    // Perform flood fill using queue-based approach
    const pixelsToCheck = []
    pixelsToCheck.push([startX, startY])

    while (pixelsToCheck.length > 0) {
      const [x, y] = pixelsToCheck.pop()

      // Check if pixel is within canvas bounds
      if (x < 0 || y < 0 || x >= gameCanvas.width || y >= gameCanvas.height) {
        continue
      }

      // Get current pixel position in the data array
      const currentPos = (y * gameCanvas.width + x) * 4

      // Check if this pixel has the target color
      if (
        data[currentPos] === startR &&
        data[currentPos + 1] === startG &&
        data[currentPos + 2] === startB &&
        data[currentPos + 3] === startA
      ) {
        // Set the color
        data[currentPos] = fillColorObj.r
        data[currentPos + 1] = fillColorObj.g
        data[currentPos + 2] = fillColorObj.b
        data[currentPos + 3] = 255

        // Add adjacent pixels to check
        pixelsToCheck.push([x + 1, y])
        pixelsToCheck.push([x - 1, y])
        pixelsToCheck.push([x, y + 1])
        pixelsToCheck.push([x, y - 1])
      }
    }

    // Put the modified pixel data back on the canvas
    context.putImageData(imageData, 0, 0)

    // Save state for undo/redo
    saveCanvasState()

    // Emit the fill action to other players
    if (!currentRoom || currentRoom.gameMode !== "copycat" || (currentRoom.gameMode === "guess" && isDrawer)) {
      socket.emit("fillAction", { startX, startY, fillColor, roomCode }, player)
    }
  
  }

  // Get color at specific pixel (color dropper tool)
  function getColorAtPixel(x, y) {
    const pixel = context.getImageData(x, y, 1, 1).data
    const color = rgbToHex(pixel[0], pixel[1], pixel[2])
    return color
  }

  // Convert RGB to Hex color
  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
  }

  // Convert Hex to RGB color
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 }
  }

  function drawLine(x0, y0, x1, y1, color, size, tool, emit) {
    const rect = gameCanvas.getBoundingClientRect()
    const widthMultiplier = gameCanvas.width / rect.width

    context.beginPath()
    context.moveTo(x0 * widthMultiplier, y0 * widthMultiplier)
    context.lineTo(x1 * widthMultiplier, y1 * widthMultiplier)

    if (tool === "eraser") {
      context.strokeStyle = "#FFFFFF"
    } else {
      context.strokeStyle = color
    }

    context.lineWidth = size
    context.lineCap = "round"
    context.lineJoin = "round"
    context.stroke()
    context.closePath()

    if (emit && (!currentRoom || currentRoom.gameMode !== "copycat" || (currentRoom.gameMode === "guess" && isDrawer))) {
      socket.emit(
        "gameDrawing",
        {
          x0,
          y0,
          x1,
          y1,
          color,
          size,
          tool,
        },
        player,
      )
    }
  }

  function onSubmitBtnClick() {
    const text = wordIpt.value
    if (text) {
      const normalizedGuess = text.toLowerCase().trim()
    const normalizedWord = currentRoom.word.toLowerCase().trim()
    if (normalizedGuess === normalizedWord) {
      socket.emit("guessWord", player, text)
    } else {
      // Optional: Provide feedback that the guess was wrong
      guessedWrong()
    }
  }
    }
  }

  function onResetBtnClick() {
    socket.emit("clearBoard", player)

    // Save the cleared state for undo/redo
    if (isDrawer || isCopying) {
      saveCanvasState()
    }
  }

  function changeColor(event) {
    if (currentTool !== "eraser") {
      currentPos.color = event.target.value
      lastColor = event.target.value

      // Update selected swatch
      updateSelectedSwatch(event.target.value)
    }
  }

  function updateSelectedSwatch(color) {
    colorSwatches.forEach((swatch) => {
      if (swatch.dataset.color === color) {
        swatch.classList.add("selected")
      } else {
        swatch.classList.remove("selected")
      }
    })
  }

  function selectColor() {
    const penColor = document.querySelector("#pen-color")
    penColor.value = currentPos.color
    penColor.addEventListener("input", changeColor, false)
  }

  function changeBrushSize() {
    currentPos.size = brushSize.value
    targetPos.size = brushSize.value
    sizeDisplay.textContent = `${brushSize.value}px`
  }

  function onMouseDown(e) {
    if (!canDraw) return

    drawing = true
    selectColor()
    relMouseCoords(e, currentPos)

    // Handle different tools
    if (currentTool === "bucket") {
      floodFill(Math.floor(currentPos.x), Math.floor(currentPos.y), currentPos.color)
    } else if (currentTool === "dropper") {
      const color = getColorAtPixel(Math.floor(currentPos.x), Math.floor(currentPos.y))
      currentPos.color = color
      lastColor = color
      const penColor = document.querySelector("#pen-color")
      penColor.value = color
      updateSelectedSwatch(color)

      // Switch back to pencil after picking a color
      setActiveTool("pencil")
    }
  }

  function onMouseUp(e) {
    if (!canDraw || !drawing) return

    drawing = false

    if (currentTool === "pencil" || currentTool === "eraser") {
      relMouseCoords(e, targetPos)
      drawLine(
        currentPos.x,
        currentPos.y,
        targetPos.x,
        targetPos.y,
        currentPos.color,
        currentPos.size,
        currentTool,
        true,
      )

      // Save state for undo/redo after completing a stroke
      saveCanvasState()
    }
  }

  function onMouseMove(e) {
    if (!canDraw || !drawing) return

    if (currentTool === "pencil" || currentTool === "eraser") {
      relMouseCoords(e, targetPos)
      drawLine(
        currentPos.x,
        currentPos.y,
        targetPos.x,
        targetPos.y,
        currentPos.color,
        currentPos.size,
        currentTool,
        true,
      )
      relMouseCoords(e, currentPos)
    }
  }

  function setActiveTool(tool) {
    currentTool = tool

    // Update UI
    const toolButtons = document.querySelectorAll(".tool-btn")
    toolButtons.forEach((btn) => {
      btn.classList.remove("active")
    })

    document.getElementById(`${tool}-tool`).classList.add("active")

    // Handle special tool behaviors
    if (tool === "eraser") {
      gameCanvas.style.cursor = "url('../img/game/eraser-cursor.png'), auto"
    } else if (tool === "bucket") {
      gameCanvas.style.cursor = "url('../img/game/bucket-cursor.png'), auto"
    } else if (tool === "dropper") {
      gameCanvas.style.cursor = "url('../img/game/dropper-cursor.png'), auto"
    } else {
      gameCanvas.style.cursor = "crosshair"
    }
  }

  function guessEnter(e) {
    if (e.key === "Enter") {
      onSubmitBtnClick()
    }
  }

  function onPlayersChanged(data) {
    currentRoom = data
    updatePlayerList()
  }

  function onJoinComplete(data) {
    currentRoom = data
    player = currentRoom.mostRecentPlayer
    roomCodeHeader.innerHTML = `Room ${currentRoom.roomCode}`
    updatePlayerList()
    getDrawer()

    // Initialize drawing history
    saveCanvasState()
  }

  function onJoinFailed() {
    gameHeader.innerHTML = "Room not found!"
    setTimeout(() => {
      window.location.href = "/"
    }, 2000)
  }

  function onJoinFailedMaxPlayers() {
    gameHeader.innerHTML = "Room is full!"
    setTimeout(() => {
      window.location.href = "/"
    }, 2000)
  }

  function onDrawingEvent(data) {
    if (!currentRoom || currentRoom.gameMode !== "copycat" || isViewingReference) {
      drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.tool, false)
    }
  }

  function onFillAction(data) {
    if (!currentRoom || currentRoom.gameMode !== "copycat" || isViewingReference) {
      floodFill(data.startX, data.startY, data.fillColor)
    }
  }

  function onCanvasState(data) {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      context.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
      context.drawImage(img, 0, 0)
    }
    img.src = data.imageData
  }function onCanvasState(data) {
    if (!currentRoom || currentRoom.gameMode !== "copycat" || isViewingReference) {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        context.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
        context.drawImage(img, 0, 0)
      }
      img.src = data.imageData
    }
  }

  function onDrawingToCopy(data) {
    if (currentRoom.gameMode === "copycat" && currentRoom.copycatRound > 0) {
      // Store the reference drawing data
      referenceDrawingData = data.drawingData
      sourcePlayerNickname = data.sourcePlayer

      // If we're in the viewing phase, show the reference drawing
      if (currentRoom.copycatPhase === "viewing") {
        // Show in the reference canvas
        const refImg = new Image()
        refImg.onload = () => {
          if (referenceContext) {
            referenceContext.clearRect(0, 0, referenceContext.canvas.width, referenceContext.canvas.height)
            referenceContext.drawImage(refImg, 0, 0, referenceContext.canvas.width, referenceContext.canvas.height)
          }
        }
        refImg.src = referenceDrawingData
      }
    }
  }

  function onCopycatPhaseChange(data) {
    currentRoom = data.room

    if (currentRoom.gameMode === "copycat") {
      if (currentRoom.copycatPhase === "viewing") {
        // Show the reference drawing if we have it
        if (referenceDrawingData) {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.onload = () => {
            context.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
            context.drawImage(img, 0, 0)
          }
          img.src = referenceDrawingData

          // Also show in the reference canvas
          const refImg = new Image()
          refImg.crossOrigin = "anonymous"
          refImg.onload = () => {
            if (referenceContext) {
              referenceContext.clearRect(0, 0, referenceContext.canvas.width, referenceContext.canvas.height)
              referenceContext.drawImage(refImg, 0, 0, referenceContext.canvas.width, referenceContext.canvas.height)
            }
          }
          refImg.src = referenceDrawingData
        }
      } else if (currentRoom.copycatPhase === "drawing") {
        // Clear the canvas for drawing
        context.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
      }

      // Update UI
      getDrawer()
    }
  }

  function onViewingTimeUpdate(data) {
    if (currentRoom.gameMode === "copycat" && currentRoom.copycatPhase === "viewing") {
      currentRoom.viewingTimeRemaining = data.timeRemaining
      gameHeader.innerHTML = `Memorize this drawing! (${currentRoom.viewingTimeRemaining}s)`
    }
  }

  function onClearBoard() {
    context.clearRect(0, 0, gameCanvas.width, gameCanvas.height)

    // If we're not the drawer, we should update our history
    if (!isDrawer) {
      saveCanvasState()
    }function onCanvasState(data) {
      if (!currentRoom || currentRoom.gameMode !== "copycat" || isViewingReference) {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          context.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
          context.drawImage(img, 0, 0)
        }
        img.src = data.imageData
      }
    }
  }

  // Add this function to handle the album review system
  function showAlbumReview(drawings) {
    // Hide the game canvas and show the album review
    if (canvasDiv) canvasDiv.style.display = "none"
    albumReviewContainer.style.display = "block"

    // Store the drawings
    albumDrawings = drawings
    currentAlbumIndex = 0

    // Initialize ratings object
    ratings = {}

    // Update the drawing counter
    drawingCounter.textContent = `1/${albumDrawings.length}`

    // Display the first drawing
    if (albumDrawings.length > 0) {
      displayDrawingInAlbum(0)
    }

    // Reset star ratings
    resetStarRatings()

    // Set album mode flag
    albumMode = true
  }

  // Function to display a drawing in the album
  function displayDrawingInAlbum(index) {
    if (index < 0 || index >= albumDrawings.length) return

    const drawing = albumDrawings[index]

    // Clear the canvas
    albumContext.clearRect(0, 0, albumCanvas.width, albumCanvas.height)

    // Load and display the drawing
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      albumContext.drawImage(img, 0, 0)
    }
    img.src = drawing.drawingData

    // Update drawer name
    drawerNameElement.textContent = `Artist: ${drawing.playerNickname}`

    // Update drawing counter
    drawingCounter.textContent = `${index + 1}/${albumDrawings.length}`

    // Update star ratings to reflect any previous rating
    updateStarRatingDisplay(drawing.playerNickname)
  }

  // Function to navigate to the previous drawing
  function navigateToPrevDrawing() {
    if (currentAlbumIndex > 0) {
      currentAlbumIndex--
      displayDrawingInAlbum(currentAlbumIndex)
    }
  }

  // Function to navigate to the next drawing
  function navigateToNextDrawing() {
    if (currentAlbumIndex < albumDrawings.length - 1) {
      currentAlbumIndex++
      displayDrawingInAlbum(currentAlbumIndex)
    }
  }

  // Function to reset all star ratings display
  function resetStarRatings() {
    starRating.forEach((star) => {
      star.classList.remove("active")
    })
  }

  // Function to update star rating display for a specific drawer
  function updateStarRatingDisplay(drawerNickname) {
    // Reset all stars first
    resetStarRatings()

    // If this drawing has been rated, show the rating
    if (ratings[drawerNickname]) {
      const rating = ratings[drawerNickname]
      starRating.forEach((star) => {
        if (Number.parseInt(star.dataset.rating) <= rating) {
          star.classList.add("active")
        }
      })
    }
  }

  // Function to rate a drawing
  function rateDrawing(rating) {
    if (currentAlbumIndex >= 0 && currentAlbumIndex < albumDrawings.length) {
      const drawerNickname = albumDrawings[currentAlbumIndex].playerNickname
      ratings[drawerNickname] = rating

      // Update the display
      updateStarRatingDisplay(drawerNickname)

      // Send the rating to the server
      socket.emit("rateDrawing", {
        roomCode: currentRoom.roomCode,
        drawerNickname: drawerNickname,
        rating: rating,
        raterNickname: player.nickname,
      })

      showServerLog(`You rated ${drawerNickname}'s drawing ${rating} stars`)
    }
  }

  // Function to continue from album review
  function continueFromAlbum() {
    // Hide album review and show game canvas
    albumReviewContainer.style.display = "none"
    if (canvasDiv) canvasDiv.style.display = "block"

    // Set album mode flag
    albumMode = false

    // Tell the server we're ready for the next round
    socket.emit("playerReadyChanged", {
      nickname: player.nickname,
      roomCode: player.roomCode,
      character: player.character,
      ready: true,
      socketId: socket.id,
    })

    showServerLog("Ready for next round")
  }

  function onNewGame(data) {
    startGameSeconds = initialStartGameSeconds
    const startGameTimer = setInterval(() => {
      if (startGameSeconds === 0) {
        clearInterval(startGameTimer)
        cont = initialCont
        currentRoom = data
        context.clearRect(0, 0, gameCanvas.width, gameCanvas.height)

        // Make sure album review is hidden and game canvas is shown
        albumReviewContainer.style.display = "none"
        if (canvasDiv) canvasDiv.style.display = "block"

        getDrawer()
        initTimer()

        // Reset drawing history for new game
        drawHistory = []
        redoStack = []
        currentStep = -1
        saveCanvasState()
      } else {
        gameHeader.innerHTML = `New Game starting in ${startGameSeconds}`
        if (wordIpt.value !== rightWordwas) {
          rightWord.innerHTML = rightWordwas
          rightWord.style.display = "block"
          rightWord.style.color = "black"
        }
        rightWord.style.display = "block"
        startGameSeconds--
      }
    }, 1000)
  }

  function onEndGame() {
    gameHeader.innerHTML = "Game has been ended"
    setTimeout(() => {
      window.location.href = "/"
    }, 2000)
  }

  function onGuessedRight(updatedRoom, playerRight, pointsEarned) {
    currentRoom = updatedRoom

    updatePlayerList()

    if (player.nickname === playerRight.nickname) {
      guessedRight()

      const playerElement = document.getElementById(`player-${playerRight.nickname}`)
      if (playerElement) {
        playerElement.classList.add("points-animation")
        setTimeout(() => {
          playerElement.classList.remove("points-animation")
        }, 800)

        showPointsIndicator(pointsEarned, playerElement)
      }
    }

    if (currentRoom.drawer) {
      const drawerElement = document.getElementById(`player-${currentRoom.drawer.nickname}`)
      if (drawerElement) {
        drawerElement.classList.add("points-animation")
        setTimeout(() => {
          drawerElement.classList.remove("points-animation")
        }, 800)

        showPointsIndicator(1, drawerElement)
      }
    }
  }

  function onGuessedWrong(updatedRoom, playerWrong) {
    if (player.nickname === playerWrong.nickname) {
      guessedWrong()
    }
  }

  function onWordWas(wordWas) {
    rightWordwas = wordWas
  }

  function setupSocket() {
    // io is expected to be defined globally by socket.io
    socket = io()

    socket.on("joinComplete", onJoinComplete)
    socket.on("joinFailed", onJoinFailed)
    socket.on("joinFailedMaxPlayers", onJoinFailedMaxPlayers)

    socket.on("playersChanged", onPlayersChanged)
    socket.on("playerDrawing", onDrawingEvent)
    socket.on("fillAction", onFillAction)
    socket.on("canvasState", onCanvasState)
    socket.on("drawingToCopy", onDrawingToCopy)
    socket.on("copycatPhaseChange", onCopycatPhaseChange)
    socket.on("viewingTimeUpdate", onViewingTimeUpdate)
    socket.on("drawingToCopy", onDrawingToCopy)

    socket.on("newGame", onNewGame)
    socket.on("endGame", onEndGame)

    socket.on("guessedRight", onGuessedRight)
    socket.on("guessedWrong", onGuessedWrong)
    socket.on("wordWas", onWordWas)
    socket.on("pointsUpdated", (updatedRoom) => {
      currentRoom = updatedRoom
      updatePlayerList()
    })
    socket.on("resetBoard", onClearBoard)

    // Add this event listener in the setupSocket function
    socket.on("serverLog", (message) => {
      console.log(`[Server Log] ${message}`)
      showServerLog(message)
    })

    // Add this to the socket event handlers section
    socket.on("showAlbum", showAlbumReview)
  }

  function checkParameters() {
    // Only redirect if we're on the game page and missing required parameters
    if (isGamePage && (!playerId || !roomCode)) {
      console.log("Missing required parameters, redirecting to home page")
      window.location.href = "/"
    }
  }

  function initializeClient() {
    const gameOptions = { playerId, roomCode }
    socket.emit("joinGame", gameOptions)
  }

  function setupToolListeners() {
    // Tool selection
    pencilTool?.addEventListener("click", () => setActiveTool("pencil"))
    eraserTool?.addEventListener("click", () => setActiveTool("eraser"))
    bucketTool?.addEventListener("click", () => setActiveTool("bucket"))
    dropperTool?.addEventListener("click", () => setActiveTool("dropper"))

    // Undo/Redo
    undoBtn?.addEventListener("click", undoAction)
    redoBtn?.addEventListener("click", redoAction)

    // Brush size
    brushSize?.addEventListener("input", changeBrushSize)

    // Color swatches
    colorSwatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        const color = swatch.dataset.color
        currentPos.color = color
        lastColor = color
        const penColor = document.querySelector("#pen-color")
        penColor.value = color
        updateSelectedSwatch(color)
      })
    })
  }

  // Declare io before using it
  const io = window.io

  // Initialize the game
  setupSocket()
  checkParameters()
  initializeClient()
  initTimer()
  setupToolListeners()

  // Set initial brush size
  changeBrushSize()

  // Set initial tool
  setActiveTool("pencil")

  // Save initial canvas state
  setTimeout(() => {
    saveCanvasState()
  }, 500)

  // Add event listeners
  resetCanvaBtn?.addEventListener("click", onResetBtnClick)
  sendBtn?.addEventListener("click", onSubmitBtnClick)
  wordIpt?.addEventListener("keydown", guessEnter)

  gameCanvas?.addEventListener("mousedown", onMouseDown, false)
  gameCanvas?.addEventListener("mouseup", onMouseUp, false)
  gameCanvas?.addEventListener("mouseout", onMouseUp, false)
  gameCanvas?.addEventListener("mousemove", throttle(onMouseMove, 10), false)

  gameCanvas?.addEventListener("touchstart", onMouseDown, false)
  gameCanvas?.addEventListener("touchend", onMouseUp, false)
  gameCanvas?.addEventListener("touchcancel", onMouseUp, false)
  gameCanvas?.addEventListener("touchmove", throttle(onMouseMove, 10), false)

  // Add these event listeners at the end of the file where other event listeners are added
  prevDrawingBtn?.addEventListener("click", navigateToPrevDrawing)
  nextDrawingBtn?.addEventListener("click", navigateToNextDrawing)
  continueFromAlbumBtn?.addEventListener("click", continueFromAlbum)

  // Add event listeners for star ratings
  starRating.forEach((star) => {
    star.addEventListener("click", function () {
      const rating = Number.parseInt(this.dataset.rating)
      rateDrawing(rating)
    })
  })

