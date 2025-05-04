const joinRoomBtn = document.getElementById("joinBtn")
const createRoomBtn = document.getElementById("createBtn")

const joinRoomModal = document.getElementById("joinRoomModal")
const roomCodeIpt = document.getElementById("roomCodeIpt")
const joinNicknameIpt = document.getElementById("joinNicknameIpt")
const confirmJoinModalBtn = document.getElementById("confirmJoinModalBtn")
const joinSelectedCharacter = document.getElementById("joinSelectedCharacter")

const createRoomModal = document.getElementById("createRoomModal")
const createNicknameIpt = document.getElementById("createNicknameIpt")
const confirmCreateModalBtn = document.getElementById("confirmCreateModalBtn")
const createSelectedCharacter = document.getElementById("createSelectedCharacter")

const spanBtns = document.getElementsByClassName("cancelModal")

const joinCharacterOptions = joinRoomModal.querySelectorAll(".character-option")
const createCharacterOptions = createRoomModal.querySelectorAll(".character-option")

const prevButtons = document.querySelectorAll(".prev-btn")
const nextButtons = document.querySelectorAll(".next-btn")

const joinCharacterIndicator = joinRoomModal.querySelector(".character-number")
const createCharacterIndicator = createRoomModal.querySelector(".character-number")

let currentOpenModal = null
let whichOpen = null

let joinCurrentCharacter = 1
let createCurrentCharacter = 1
const totalCharacters = 7

function generateRoomCode(roomCodeLength) {
  let result = ""
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const charactersLength = characters.length
  for (let i = 0; i < roomCodeLength; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

function resetInputValues() {
  joinNicknameIpt.value = ""
  createNicknameIpt.value = ""
  roomCodeIpt.value = ""

  joinSelectedCharacter.value = "1"
  createSelectedCharacter.value = "1"

  joinCurrentCharacter = 1
  createCurrentCharacter = 1

  updateCharacterDisplay("join", 1)
  updateCharacterDisplay("create", 1)
}

function hideModal() {
  currentOpenModal.style.display = "none"
  resetInputValues()
  whichOpen = null
}

function updateCharacterDisplay(modalType, characterIndex) {
  const options = modalType === "join" ? joinCharacterOptions : createCharacterOptions
  const indicator = modalType === "join" ? joinCharacterIndicator : createCharacterIndicator
  const hiddenInput = modalType === "join" ? joinSelectedCharacter : createSelectedCharacter

  options.forEach((option) => {
    option.style.display = "none"
    option.classList.remove("selected")
  })

  const currentOption = options[characterIndex - 1]
  currentOption.style.display = "block"
  currentOption.classList.add("selected")

  indicator.textContent = `Character ${characterIndex}/${totalCharacters}`

  hiddenInput.value = characterIndex.toString()
}

function prevCharacter(modalType) {
  if (modalType === "join") {
    joinCurrentCharacter = joinCurrentCharacter > 1 ? joinCurrentCharacter - 1 : totalCharacters
    updateCharacterDisplay("join", joinCurrentCharacter)
  } else {
    createCurrentCharacter = createCurrentCharacter > 1 ? createCurrentCharacter - 1 : totalCharacters
    updateCharacterDisplay("create", createCurrentCharacter)
  }
}

function nextCharacter(modalType) {
  if (modalType === "join") {
    joinCurrentCharacter = joinCurrentCharacter < totalCharacters ? joinCurrentCharacter + 1 : 1
    updateCharacterDisplay("join", joinCurrentCharacter)
  } else {
    createCurrentCharacter = createCurrentCharacter < totalCharacters ? createCurrentCharacter + 1 : 1
    updateCharacterDisplay("create", createCurrentCharacter)
  }
}

function onCreateRoomBtnClick() {
  createRoomModal.style.display = "block"
  currentOpenModal = createRoomModal
  whichOpen = 1

  createCurrentCharacter = 1
  updateCharacterDisplay("create", createCurrentCharacter)
}

function onJoinRoomBtnClick() {
  joinRoomModal.style.display = "block"
  currentOpenModal = joinRoomModal
  whichOpen = 2

  joinCurrentCharacter = 1
  updateCharacterDisplay("join", joinCurrentCharacter)
}

function onConfirmCreateRoomBtnClick() {
  const nickname = createNicknameIpt.value
  const characterId = createSelectedCharacter.value
  window.location.href = `/lobby?type=create&nickname=${nickname}&roomCode=${generateRoomCode(6)}&character=${characterId}`
}

function onConfirmJoinRoomBtnClick() {
  const nickname = joinNicknameIpt.value
  const roomCode = roomCodeIpt.value
  const characterId = joinSelectedCharacter.value
  window.location.href = `/lobby?type=join&nickname=${nickname}&roomCode=${roomCode}&character=${characterId}`
}

createRoomBtn.onclick = onCreateRoomBtnClick
joinRoomBtn.onclick = onJoinRoomBtnClick

confirmCreateModalBtn.onclick = onConfirmCreateRoomBtnClick
confirmJoinModalBtn.onclick = onConfirmJoinRoomBtnClick

prevButtons.forEach((button) => {
  button.addEventListener("click", () => {
    prevCharacter(button.dataset.modal)
  })
})

nextButtons.forEach((button) => {
  button.addEventListener("click", () => {
    nextCharacter(button.dataset.modal)
  })
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideModal()
  }
  if (event.key === "Enter") {
    if (whichOpen === 1) {
      onConfirmCreateRoomBtnClick()
    } else if (whichOpen === 2) {
      onConfirmJoinRoomBtnClick()
    }
  }

  if (whichOpen === 1) {
    if (event.key === "ArrowLeft") {
      prevCharacter("create")
    } else if (event.key === "ArrowRight") {
      nextCharacter("create")
    }
  } else if (whichOpen === 2) {
    if (event.key === "ArrowLeft") {
      prevCharacter("join")
    } else if (event.key === "ArrowRight") {
      nextCharacter("join")
    }
  }
})

window.onclick = (event) => {
  if (event.target === currentOpenModal) {
    hideModal()
  }
}

Array.from(spanBtns).forEach((spanBtn) => {
  spanBtn.onclick = hideModal
})

updateCharacterDisplay("join", 1)
updateCharacterDisplay("create", 1)
