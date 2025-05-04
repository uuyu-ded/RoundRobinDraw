class Player {
  constructor(nickname, roomCode, character = "1") {
    this.socketId = undefined
    this.nickname = nickname
    this.roomCode = roomCode
    this.character = character
    this.ready = false
    this.points = 0
    this.alreadyPointed = false
  }
}
