const mongoose = require('mongoose');
require('dotenv').config();

const feedbackSchema = new mongoose.Schema({
    customerName: String,
    phone: String,
    rating: Number,
    comment: String,
    isApproved: Boolean
}, { timestamps: true });

const Feedback = mongoose.model('Feedback', feedbackSchema);

const seedFeedback = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const sample = {
            customerName: "Ahmet Yılmaz",
            phone: "05555555555",
            rating: 5,
            comment: "Harika bir deneyimdi, Ramazan bey işinin ehli. Kesinlikle tavsiye ederim!",
            isApproved: true
        };

        await Feedback.create(sample);
        console.log('Sample Feedback Added!');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedFeedback();
