var test = require('tape');
var fs = require('fs');

test('env', function(t) {
  t.equal(process.env.TEST_ALL, 'true');
  t.equal(process.env.TEST_ENV_TARGET, process.env.CHIMERA_TARGET);
});

test('install', function(t) {
  t.doesNotThrow(fs.statSync.bind(fs, '/test-install-all'));
  t.doesNotThrow(fs.statSync.bind(fs, '/test-install-target'));
});
