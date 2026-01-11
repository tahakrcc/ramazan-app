const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true // Faster lookups for "My Appointments"
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD']
  },
  hour: {
    type: String, // Format: HH:00
    required: true,
    match: [/^\d{2}:00$/, 'Hour must be HH:00']
  },
  service: {
    type: String,
    required: true,
    default: 'Haircut'
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled'],
    default: 'confirmed'
  },
  createdFrom: {
    type: String,
    enum: ['web', 'whatsapp', 'admin'],
    required: true
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// ZERO-TOLERANCE UNIQUE INDEX
// Creates a compound unique index on date and hour.
// If two requests try to book the same slot, MongoDB will reject one with code 11000.
appointmentSchema.index({ date: 1, hour: 1 }, { unique: true });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
