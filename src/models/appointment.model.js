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
  barberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  barberName: {
    type: String,
    trim: true
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
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  feedbackRequested: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// ZERO-TOLERANCE UNIQUE INDEX
// Creates a compound unique index on date, hour and barber.
// If two requests try to book the same slot for the same barber, MongoDB will reject.
// UPDATE: Added partialFilterExpression to allow 'cancelled' appointments to exist without blocking new ones.
appointmentSchema.index({ date: 1, hour: 1, barberId: 1 }, {
  unique: true,
  partialFilterExpression: { status: 'confirmed' }
});

// Try to drop old index (Best effort, runs once on module load? No, models load on startup)
// We rely on Mongoose sync or manual migration.
// If this causes issues, user might need to drop index manually.
// appointmentSchema.add({ barberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' } });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
