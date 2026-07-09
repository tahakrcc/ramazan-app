const fs = require('fs');

// Refactor BookingFlow.jsx
let flow = fs.readFileSync('client/src/components/BookingFlow.jsx', 'utf-8');

// 1. Rename to BookingFlow
flow = flow.replace('const BookingPage = () => {', 'const BookingFlow = ({ onBack, services, barbers, settings }) => {');

// 2. Remove loadData and the declarations that are now props
flow = flow.replace(/const \[services, setServices\] = useState\(\[\]\);\n\s*const \[barbers, setBarbers\] = useState\(\[\]\);\n\s*const \[settings, setSettings\] = useState\(\{ bookingRangeDays: 14, closedWeekDays: \[\] \}\);/s, '');

flow = flow.replace(/const loadData = async.*?loadData\(\);/s, '');

// 3. Remove isLoading check
flow = flow.replace(/if \(isLoading\) \{.*?return \([\s\S]*?\);\n\s*\}/s, '');

// 4. Change window.location.reload() to onBack()
flow = flow.replace(/window\.location\.reload\(\)/g, 'onBack()');

// 5. Remove Navbar from BookingFlow
flow = flow.replace(/<nav className="fixed top-0[\s\S]*?<\/nav>/s, '');
// Also remove WhatsApp button since LandingView handles it
flow = flow.replace(/<a href=\{`https:\/\/wa.me[\s\S]*?<\/a>/s, '');

// 6. Export BookingFlow instead of BookingPage
flow = flow.replace('export default BookingPage;', 'export default BookingFlow;');

fs.writeFileSync('client/src/components/BookingFlow.jsx', flow, 'utf-8');


// Refactor BookingPage.jsx
let page = fs.readFileSync('client/src/pages/BookingPage.jsx', 'utf-8');

// 1. Add import BookingFlow
page = page.replace(/import React, { useState, useEffect, useRef } from 'react';/, "import React, { useState, useEffect, useRef } from 'react';\nimport BookingFlow from '../components/BookingFlow';");

// 2. Remove old BookingFlow component
const startFlowIdx = page.indexOf('const BookingFlow = ');
const endFlowIdx = page.indexOf('const AboutSection = ');
if (startFlowIdx !== -1 && endFlowIdx !== -1) {
    page = page.substring(0, startFlowIdx) + page.substring(endFlowIdx);
}

// 3. Update component state and data fetching
page = page.replace('const [services, setServices] = useState([]);', 'const [services, setServices] = useState([]);\n    const [barbers, setBarbers] = useState([]);');
page = page.replace("API.get('/appointments/services'),", "API.get('/appointments/services'),\n                    API.get('/appointments/barbers'),");
page = page.replace('const [servicesRes, feedbacksRes, settingsRes] = await Promise.all', 'const [servicesRes, barbersRes, feedbacksRes, settingsRes] = await Promise.all');
page = page.replace('setServices(servicesRes.data);', 'setServices(servicesRes.data);\n                setBarbers(barbersRes.data);');

// 4. Update standalone detection to setStep(1)
page = page.replace(
    'const [step, setStep] = useState(0); // 0: Landing, 1: Booking Flow',
    'const [step, setStep] = useState(0); // 0: Landing, 1: Booking Flow\n\n    useEffect(() => {\n        const isStandalone = window.matchMedia(\'(display-mode: standalone)\').matches || window.navigator.standalone;\n        if (isStandalone) setStep(1);\n    }, []);'
);

// 5. Update the BookingFlow render inside BookingPage
page = page.replace(/<BookingFlow key="booking".*?\/>/, '<BookingFlow key="booking" onBack={() => setStep(0)} services={services} barbers={barbers} settings={settings} />');

fs.writeFileSync('client/src/pages/BookingPage.jsx', page, 'utf-8');
console.log('Refactoring finished cleanly.');
