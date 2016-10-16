var fork = require('child_process').fork;

module.exports = (mode, config, callback) => {
  var child = fork(__dirname + '/child');

  // How we should handle client messages depends
  // on what Pipeline is being ran.
  var handle = require('./' + mode + 'Handler');

  var message = {
    what: 'start',
    mode: mode,
    config: config
  }

  child.on('message', function(m) {

    if(m === 'ready')
      return child.send(message);

    handle.message(m);
  });

  child.on('exit', function(status) {
    handle.exit(status, callback);
  });
}