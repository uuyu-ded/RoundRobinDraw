class RoomUtils {
  /**
   * Checks for the existence of a player with the same nickname in the given
   * players list.
   *
   * @param {Object} playerToCheck the player with the nickname to check
   * @param {Object[]} players the players list to check
   * @returns
   */
  static checkRepeatedNicknames(playerToCheck, playersList) {
    for (let i = 0; i < playersList.length; i++) {
      if (playersList[i].nickname === playerToCheck.nickname) return false
    }
    return true
  }

  /**
   * Returns a random index between min (inclusive) and max (inclusive).
   *
   * @param {number} min the minimum index value
   * @param {number} max the maximum index value
   * @returns the random index
   */
  static randomIndex(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}

module.exports = RoomUtils
