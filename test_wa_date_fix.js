const { format, addDays } = require('date-fns');

// Mock data and logic from whatsapp.baileys.service.js
const turkeyNow = new Date('2026-03-17T15:45:00+03:00'); 
const todayStr = '2026-03-17';
const maxDateStr = '2026-03-31';
const maxDays = 14;

const session = {
    dateOptions: [
        { number: 1, label: '1️⃣ Bugün (2026-03-17)', date: '2026-03-17' },
        { number: 2, label: '2️⃣ Yarın (2026-03-18)', date: '2026-03-18' },
        { number: 3, label: '3️⃣ 19/03 (Perşembe) (2026-03-19)', date: '2026-03-19' }
    ]
};

function testInput(text) {
    const lowerText = text.toLowerCase().trim();
    let selectedDate = null;
    const sessionDateOptions = session.dateOptions || [];

    console.log(`\nTesting input: "${text}"`);

    // 1. Check for keywords
    if (lowerText.includes('bugün')) {
        selectedDate = todayStr;
        console.log('Matched keyword: bugün');
    } else if (lowerText.includes('yarın')) {
        selectedDate = '2026-03-18'; // Simulated
        console.log('Matched keyword: yarın');
    } 
    // 2. Check for explicit YYYY-MM-DD format
    else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text.trim())) {
        let inputDate = text.trim();
        const [y, m, d] = inputDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const isValidDate = dateObj.getFullYear() === y &&
            dateObj.getMonth() === m - 1 &&
            dateObj.getDate() === d;

        if (isValidDate) {
            const yearStr = y.toString();
            const monthStr = m.toString().padStart(2, '0');
            const dayStr = d.toString().padStart(2, '0');
            inputDate = `${yearStr}-${monthStr}-${dayStr}`;

            if (inputDate < todayStr) {
                console.log('FAILED: Past date');
                return null;
            }
            if (inputDate > maxDateStr) {
                console.log('FAILED: Future date');
                return null;
            }
            selectedDate = inputDate;
            console.log('Matched format: YYYY-MM-DD');
        } else {
            console.log('FAILED: Invalid date');
            return null;
        }
    }
    // 3. Finally, check for numerical index selection
    else if (!isNaN(parseInt(lowerText))) {
        const numInput = parseInt(lowerText);
        const matchedOption = sessionDateOptions.find(opt => opt.number === numInput);
        if (matchedOption) {
            selectedDate = matchedOption.date;
            console.log(`Matched index: ${numInput}`);
        }
    }

    if (selectedDate) {
        console.log(`RESULT: Success - Selected Date: ${selectedDate}`);
    } else {
        console.log('RESULT: Not understood');
    }
    return selectedDate;
}

// Tests
testInput('1');           // Should be 2026-03-17 (Index 1)
testInput('2');           // Should be 2026-03-18 (Index 2)
testInput('2026-03-19');  // Should be 2026-03-19 (Regex)
testInput('bugün');       // Should be 2026-03-17 (Keyword)
testInput('20');          // Should fail (Not in list)
testInput('abcd');        // Should fail
