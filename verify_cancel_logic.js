const mongoose = require('mongoose');
const Appointment = require('./src/models/appointment.model');
const appointmentService = require('./src/services/appointment.service');
const Settings = require('./src/models/settings.model');
require('dotenv').config();

const verify = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const testDate = '2026-06-01'; // Future date to avoid conflicts
        const testHour = '14:00';
        const phone = '5551112233';

        // 1. Cleanup
        await Appointment.deleteMany({ date: testDate });
        console.log('Cleaned up test date.');

        // 2. Create Confirmed Appointment
        console.log('Creating Confirmed Appointment...');
        const appt1 = await appointmentService.createAppointment({
            customerName: 'Test User 1',
            phone: phone,
            date: testDate,
            hour: testHour,
            createdFrom: 'admin',
            status: 'confirmed'
        });
        console.log(`Created: ${appt1._id}, Status: ${appt1.status}`);

        // 3. Check Availability (Should be blocked)
        let slots = await appointmentService.getAvailableSlots(testDate);
        if (slots.includes(testHour)) {
            console.error('FAIL: Slot should be BLOCKED but is Available.');
        } else {
            console.log('PASS: Slot is blocked correctly.');
        }

        // 4. Cancel the Appointment (Soft Delete)
        console.log('Cancelling Appointment...');
        appt1.status = 'cancelled';
        await appt1.save();
        console.log('Status updated to cancelled.');

        // 5. Check Availability (Should be free)
        slots = await appointmentService.getAvailableSlots(testDate);
        if (slots.includes(testHour)) {
            console.log('PASS: Slot is now AVAILABLE (after cancel).');
        } else {
            console.error('FAIL: Slot is still BLOCKED after cancellation.');
        }

        // Debug: Check what is in the DB
        const allAppts = await Appointment.find({ date: testDate });
        console.log('DEBUG: All Appointments on date:', allAppts.map(a => ({ _id: a._id, status: a.status, hour: a.hour })));

        // 6. Try to Book Again (Should succeed)
        console.log('Attempting to book same slot...');
        try {
            const appt2 = await appointmentService.createAppointment({
                customerName: 'Test User 2',
                phone: '5559998877',
                date: testDate,
                hour: testHour,
                createdFrom: 'admin',
                status: 'confirmed'
            });
            console.log(`PASS: Successfully re-booked slot! New ID: ${appt2._id}`);
        } catch (e) {
            console.error(`FAIL: Could not re-book slot. Error: ${e.message}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

verify();
