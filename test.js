var test = require('tape');
var fs = require('fs');

test('env', function(t) {
  t.plan(2);
  t.equal(process.env.TEST_ENV_ALL, 'true');
  t.equal(process.env.TEST_ENV_TARGET, process.env.CHIMERA_TARGET);
});

test('install', function(t) {
  t.plan(2);
  t.doesNotThrow(fs.statSync.bind(fs, '/test-install-all'));
  t.doesNotThrow(fs.statSync.bind(fs, '/test-install-target'));
});
