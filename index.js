var spawn = require('child_process').spawn;
var prompt = require('prompt');

function stringifySorted(obj) {
  if (typeof obj !== 'object' || obj === null)
    return JSON.stringify(obj);

  return '{' + Object.keys(obj).sort().filter(function(key) {
    return obj[key] !== undefined;
  }).map(function(key) {
    return JSON.stringify(key) + ':' + stringifySorted(obj[key]);
  }).join(',') + '}';
}

function gpgAction(action, passphrase, input, cb) {
  var args = action.concat([ '--no-tty', '--armor', '--passphrase-fd', '3' ]);

  var child = spawn('gpg', args, {
    stdio: [ 'pipe', 'pipe', 'pipe', 'pipe' ]
  });
  child.stdio[3].write(passphrase + '\n');
  child.stdin.end(input);

  var output = '';
  var err = '';
  child.stdout.on('data', function(chunk) {
    output += chunk;
  });
  child.stderr.on('data', function(chunk) {
    err += chunk;
  });
  child.once('close', function(code) {
    if (code === 0)
      cb(null, output);
    else
      cb(new Error('gpg call failed:\n' + err), null);
  });
}

function getPassphrase(cb) {
  prompt.start();
  prompt.get({
    properties: {
      passphrase: {
        hidden: true,
        required: true,
        message: 'Passphrase required to sign object with GPG.\n' +
                 'Enter passphrase'
      }
    }
  }, function(err, result) {
    if (err)
      return cb(err);
    cb(null, result.passphrase);
  });
}

exports.sign = function sign(object, cb) {
  getPassphrase(function(err, passphrase) {
    if (err)
      return cb(err);
    gpgAction([ '--sign' ], passphrase, stringifySorted(object), cb);
  });
};

exports.verify = function verify(object, signature, cb) {
  getPassphrase(function(err, passphrase) {
    if (err)
      return cb(err);
    gpgAction([ '--decrypt' ], passphrase, signature, function(err, result) {
      if (err)
        return cb(err);
      cb(null, result === stringifySorted(object));
    });
  });
};