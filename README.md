# snow-scan

This is a simple nodejs script to demonstrate how one could scan servicenow instances and try standard login/password combinations to import malevolent code to import data or code, add extension points, make a botnet, run cryptomining code, get mid servers addresses, make them execute arbitraty code, ...

>&#9888; This code is for educational purpose only, to show how easy an attacker could take control of a poorly secured instance.

>&#128161; Conclusion: make sure you use a [good password](https://www.howtogeek.com/195430/how-to-create-a-strong-password-and-remember-it/) for your admin account; even better, disable the OOB admin account and create specific accounts. Only use a token based ID management tool (SAML) when possible.

## Download required modules with:
```
npm install
```

## Usage:
```
scan.js -o [{dev|host}] options

Options:
  --help            Show help                                          [boolean]
  --version         Show version number                                [boolean]
  --operation, -o   dev,host                                          [required]
  --target, -t      if o=host, target should be the fqdn
  --numStart, -s    if o=dev, lower limit of the dev scan range
  --numEnd, -e      if o=dev, higher limit of the dev scan range
  --testAuth, -a    try to authenticate using common passwords
  --getVersion, -v  if authenticated, get version
```

## Examples

get informations on specific instance xxxxx:
```javascript
node scan.js -o host -t xxxxx.service-now.com

Scanning target instance xxxxx.service-now.com, WITHOUT authentication
{
  'xxxxx.service-now.com': {
    name: 'xxxxx.service-now.com',
    address: [ 'xxx.xx.x.xxx' ],
    active: true,
    found: true,
    connected: false,
    password: '',
    version: ''
  }
}
```

scan a range of developper instances from number aaaaa to number bbbbb, and try to login as admin, get version:
```javascript
node scan.js -o dev -s aaaaa -e bbbbb -a -v
Scanning dev instances from aaaaa to bbbbb, WITH authentication

{
  'aaaaa.service-now.com': {
    name: 'aaaaa.service-now.com',
    address: [ 'xxx.xx.x.xxx' ],
    active: true,
    found: true,
    connected: false,
    password: '',
    version: ''
  },
  ...,
  'bbbbb.service-now.com': {
    name: 'bbbbb.service-now.com',
    address: [ 'xxx.xx.x.xxx' ],
    active: true,
    found: true,
    connected: true,
    password: 'password',
    version: 'glide-madrid-12-18-2018__patch4-05-29-2019_06-05-2019_1042.zip'
  }
}
```

