const http = require('http');

const createAppointment = (i) => {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            customerName: `Customer ${i}`,
            phone: `555123456${i}`,
            date: '2025-05-20',
            hour: '14:00' // Everyone wants this slot!
        });

        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/appointments',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body: JSON.parse(body) });
            });
        });

        req.on('error', error => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
};

const runTest = async () => {
    console.log('--- Race Condition Test ---');
    console.log('Sending 5 concurrent requests for the SAME slot...');

    const promises = [];
    for (let i = 0; i < 5; i++) {
        promises.push(createAppointment(i));
    }

    const results = await Promise.all(promises);

    let successCount = 0;
    let failCount = 0;

    results.forEach((res, index) => {
        console.log(`Request ${index}: Status ${res.status} - ${JSON.stringify(res.body)}`);
        if (res.status === 201) successCount++;
        else failCount++;
    });

    console.log('---------------------------');
    console.log(`Success: ${successCount}`);
    console.log(`Fail: ${failCount}`);

    if (successCount === 1 && failCount === 4) {
        console.log('✅ TEST PASSED: Only 1 appointment was created.');
    } else {
        console.log('❌ TEST FAILED: Race condition detected or all failed.');
    }
};

// Wait for server to start manually or check if running
// For this script to work, SERVER MUST BE RUNNING (npm start)
runTest();
