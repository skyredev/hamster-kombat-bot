const axios = require('axios');
const readline = require('readline');
const ascii = require('ascii-table');

const url = 'https://api.hamsterkombatgame.io/clicker/tap';

let bearerToken = 'YOUR_TOKEN_HERE'  // Enter your bearer token here

const response_store_fields = ['id', 'totalCoins', 'balanceCoins', 'level', 'availableTaps', 'exchangeId', 'maxTaps', 'earnPerTap', 'tapsRecoverPerSec'];

const extractFields = (response, fields) => {
    let result = {};
    fields.forEach(field => {
        if (response.hasOwnProperty(field)) {
            result[field] = response[field];
        }
    });
    return result;
};

const sendTableReport = (data, title = 'Tap Bot Report') => {
    const ascii_table = new ascii(title);
    ascii_table.setHeading('Field', 'Value');
    Object.keys(data).forEach(key => {
        ascii_table.addRow(key, data[key]);
    });
    console.log(ascii_table.toString());
};

const sendPostRequest = async (count) => {
    try {
        const data = {
            "count": count,
            "availableTaps": 0,
            "timestamp": (new Date()).getTime()
        };

        const resp = await axios.post(url, data, {
            headers: {
                'Authorization': bearerToken,
                'Content-Type': 'application/json'
            }
        });

        return extractFields(resp.data.clickerUser, response_store_fields);

    } catch (err) {
        if (err.response && (err.response.status === 401 || err.response.status === 403 || err.response.status === 500)) {
            console.error('Authorization failed. Please enter a new bearer token.');
            await handleUnauthorizedError();
            return sendPostRequest(count); // Retry the request with the new token
        } else {
            console.error(err);
        }
    }
};

const calculateRecoverTime = (availableTaps, tapsRecoverPerSec, maxTaps) => {
    return (maxTaps - availableTaps) / tapsRecoverPerSec;
};

const getBoost = async () => {
    try {
        const data = {
            "boostId": "BoostFullAvailableTaps",
            "timestamp": (new Date()).getTime()
        };

        const resp = await axios.post('https://api.hamsterkombatgame.io/clicker/buy-boost', data, {
            headers: {
                'Authorization': bearerToken,
                'Content-Type': 'application/json'
            }
        });

        return -1;

    }catch (err) {
        if (err.response && (err.response.status === 401 || err.response.status === 403 || err.response.status === 500)) {
            console.error('Authorization failed. Please enter a new bearer token.');
            await handleUnauthorizedError();
            return getBoost(); // Retry the request with the new token
        }else if(err.response && err.response.status === 400){
            const message = err.response.data.error_message;
            let cooldown = message.split(" ")[message.split(" ").length - 2];
            cooldown = parseInt(cooldown);
            return cooldown;
        } else {
            throw err;
        }
    }
}

const claimDailyCipher = async (cipher) => {
    try {
        const data = {
            "cipher": cipher
        };

        const resp = await axios.post('https://api.hamsterkombatgame.io/clicker/claim-daily-cipher', data, {
            headers: {
                'Authorization': bearerToken,
                'Content-Type': 'application/json'
            }
        });

        return resp.data

    } catch (err) {
        if (err.response && (err.response.status === 401 || err.response.status === 403 || err.response.status === 500)) {
            console.error('Authorization failed. Please enter a new bearer token.');
            await handleUnauthorizedError();
            return claimDailyCipher(cipher); // Retry the request with the new token
        } else {
            throw err;
        }
    }
};

const handleUnauthorizedError = async () => {
    const newToken = await promptUser('Enter new bearer token: ');
    bearerToken = `Bearer ${newToken}`;
};

const promptUser = (question) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

const boosting = async number => {
    try {
        const cooldown = await getBoost();
        if(isNaN(cooldown)){
            console.error(`Boost Limit per day is reached. Repeat the process in 30 minutes.`);
            await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 30));
            void boosting();
        }
        else if (cooldown !== -1){
            console.log(`Boost is on cooldown. Next boost will be available in ${cooldown} seconds.`);
            await new Promise(resolve => setTimeout(resolve, cooldown * 1000));
            void boosting();
        }
        else {
            let receivedData = await sendPostRequest(3500); // Taps Request After Boost Activation
            sendTableReport(receivedData, 'Post-Boost Tap Report');
            await new Promise(resolve => setTimeout(resolve, 1000));
            void boosting();
        }

    }catch (e){
        console.error(`Error while boosting`)
    }
}
const main = async () => {
    let receivedData = await sendPostRequest(3500);
    void boosting();
    sendTableReport(receivedData);

    // Start listening for user commands
    listenForCommands();


    while (true) {
        const recoverTime = calculateRecoverTime(receivedData.availableTaps, receivedData.tapsRecoverPerSec, receivedData.maxTaps);
        const incomePerHour = receivedData.maxTaps * 3600 / recoverTime;

        console.log(`Next request will be sent in ${recoverTime.toFixed(2)} seconds.`);
        console.log(`Estimated income per hour: ${incomePerHour.toFixed(2)} coins.`);
        console.log(`Estimated income per day: ${(incomePerHour * 24).toFixed(2)} coins.`)

        await new Promise(resolve => setTimeout(resolve, recoverTime * 1000));

        receivedData = await sendPostRequest(Math.ceil(receivedData.maxTaps / receivedData.earnPerTap));
        sendTableReport(receivedData);
    }
};

const listenForCommands = () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on('line', async (input) => {
        const [command, ...args] = input.trim().split(' ');

        if (command === 'claim') {
            try {
                if (args.length === 0) {
                    throw new Error('Please provide the daily cipher.');
                }
                const cipher = args[0]
                const resp_data = await claimDailyCipher(cipher);
                sendTableReport(extractFields(resp_data.clickerUser, response_store_fields), 'Claimed Daily Cipher');
                sendTableReport(resp_data.dailyCipher, 'Daily Cipher Result');
            } catch (err) {
                console.log(`Cipher is invalid or already claimed.`);
            }

        } else if (command === 'token') {
            try {
                if (args.length === 0) {
                    throw new Error('Please provide a new bearer token.');
                }
                const newToken = args[0]
                bearerToken = `Bearer ${newToken}`;
                console.log('Bearer token updated successfully.');
            }
            catch (err) {
                console.error(`Bearer token was not provided. Please provide a new token.`);
            }
        } else if (command === 'exit') {
            console.log('Exiting...');
            rl.close();
            process.exit(0);
        }
    });
};

main();
