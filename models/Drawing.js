const mongoose = require("mongoose")

const DrawingSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    index: true,
  },
  playerNickname: {
    type: String,
    required: true,
  },
  round: {
    type: Number,
    required: true,
  },
  drawingData: {
    type: String,
    required: true,
  },
  originalDrawer: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model("Drawing", DrawingSchema)
