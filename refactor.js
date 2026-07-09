const fs = require('fs');

const current = fs.readFileSync('client/src/pages/BookingPage.jsx', 'utf-8');
const old = fs.readFileSync('client/src/pages/BookingPage.old.jsx', 'utf-8');

const accordionMatch = current.match(/const AccordionSection =.*?\n};/s);
const accordionStr = accordionMatch[0];

const bookingFlowMatch = current.match(/const BookingPage = \(\) => {.*?return \(.*?\);\n};/s);
let bookingFlowStr = bookingFlowMatch[0];
bookingFlowStr = bookingFlowStr.replace('const BookingPage = () => {', 'const BookingFlow = ({ onBack, services, barbers, settings }) => {');
bookingFlowStr = bookingFlowStr.replace(/const loadData = async.*?loadData\(\);/s, '');
bookingFlowStr = bookingFlowStr.replace(/if \(isLoading\) \{.*?return \(.*?\);\n    \}/s, '');
bookingFlowStr = bookingFlowStr.replace(/window\.location\.reload\(\)/g, 'onBack()');
bookingFlowStr += '\n\nexport default BookingFlow;';

const bookingFlowComponent = `import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { format, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import GrainOverlay from '../components/GrainOverlay';
import CustomCursor from '../components/CustomCursor';

${accordionStr}

${bookingFlowStr}
`;

fs.writeFileSync('client/src/components/BookingFlow.jsx', bookingFlowComponent);

const startIndex = old.indexOf('const BookingFlow =');
const endIndex = old.indexOf('const AboutSection =');
let oldWithoutFlow = old.substring(0, startIndex) + old.substring(endIndex);

oldWithoutFlow = oldWithoutFlow.replace("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef } from 'react';\nimport BookingFlow from \"../components/BookingFlow\";");

oldWithoutFlow = oldWithoutFlow.replace(
    'const [step, setStep] = useState(0); // 0: Landing, 1: Booking Flow',
    'const [step, setStep] = useState(0); // 0: Landing, 1: Booking Flow\n    useEffect(() => {\n        const isStandalone = window.matchMedia(\'(display-mode: standalone)\').matches || window.navigator.standalone;\n        if (isStandalone) setStep(1);\n    }, []);'
);

oldWithoutFlow = oldWithoutFlow.replace('const [services, setServices] = useState([]);', 'const [services, setServices] = useState([]);\n    const [barbers, setBarbers] = useState([]);');
oldWithoutFlow = oldWithoutFlow.replace("API.get('/appointments/services'),", "API.get('/appointments/services'),\n                    API.get('/appointments/barbers'),");
oldWithoutFlow = oldWithoutFlow.replace('const [servicesRes, feedbacksRes, settingsRes]', 'const [servicesRes, barbersRes, feedbacksRes, settingsRes]');
oldWithoutFlow = oldWithoutFlow.replace('setServices(servicesRes.data);', 'setServices(servicesRes.data);\n                setBarbers(barbersRes.data);');
oldWithoutFlow = oldWithoutFlow.replace('<BookingFlow key="booking" onBack={() => setStep(0)} services={services} settings={settings} />', '<BookingFlow key="booking" onBack={() => setStep(0)} services={services} barbers={barbers} settings={settings} />');

fs.writeFileSync('client/src/pages/BookingPage.jsx', oldWithoutFlow);

console.log("Refactoring complete");
