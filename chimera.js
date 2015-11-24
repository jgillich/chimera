var fs          = require('fs');
var os          = require('os');
var path        = require('path');
var crypto      = require('crypto');
var _           = require('underscore');
var Handlebars  = require('handlebars');
var async       = require('async');
var tar         = require('tar-fs');
var Docker      = require('dockerode');
var rimraf      = require('rimraf');
var yaml        = require('js-yaml');
var minimist    = require('minimist');
var colors      = require('colors');

var docker;
var argv = minimist(process.argv.slice(2));
var verbose = argv.verbose ? console.log : function () {};
var dockerfile = Handlebars.compile([
  'FROM {{name}}:{{tag}}',
  'COPY project/ /project',
  'WORKDIR /project',
  '{{#each install}}',
    'RUN {{this}}',
  '{{/each}}',
  'CMD {{script}}'
].join('\n'));

fs.readFile(path.join(process.cwd(), '.chimera.yml'), 'utf8', function (err, raw) {
  if(err) fail(err.message);

  var config = yaml.safeLoad(raw);
  docker = Docker(config.docker);

  targets(config, function (err, targets) {
    if(err) fail(err.message);
    async.eachSeries(targets, function (target, cb) {
      console.log(('executing target ' + target.image).green);
      async.applyEachSeries([bundle, build, test, clean], target, cb);
    }, function (err) {
      if(err) fail(err.message);
    });
  });
});

function targets(config, cb) {
  cb(null, _.map(config.images, function (image, name) {
    return image.tags.map(function (tag) {
      var id = crypto.randomBytes(5).toString('hex');
      var imageName = image.image || name;
      return {
        name: name,
        image: imageName,
        tag: tag,
        id: id,
        dir: path.join(os.tmpdir(), id),
        tar: path.join(os.tmpdir(), id + '.tar'),
        image: 'chimera-' + imageName + '-' + tag + '-' + id,
        install: (image.install || []).concat(config.install || []),
        script: config.script.join(' && ') // TODO is this a good idea?
      };
    });
  }).reduce(function(a, b) {
    return a.concat(b);
  }));
}

function bundle(target, cb) {
  async.series([
    fs.mkdir.bind(fs, target.dir),
    fs.writeFile.bind(fs, path.join(target.dir, 'Dockerfile'), dockerfile(target)),
    fs.symlink.bind(fs, process.cwd(), path.join(target.dir, 'project')),
    function (cb) {
      tar.pack(target.dir, { dereference: true })
        .pipe(fs.createWriteStream(target.tar))
        .on('error', cb)
        .on('finish', cb);
    }
  ], cb);
}

function build(target, cb) {
  docker.buildImage(target.tar, { t: target.image }, function (err, response) {
    if(err) cb(err);

    response.on('data', function (d) {
      var resp = JSON.parse(d);
      if(resp.error) {
        console.error(resp.error);
        cb = cb.bind(null, new Error('failed to build image ' + target.image));
      }
      else if(resp.stream || resp.status) {
        verbose(resp.stream || resp.status);
      }
    });
    response.on('end', cb);
  });
}

function test(target, cb) {
  docker.run(target.image, [], process.stdout, function (err, data, container) {
    if(err) return cb(err);
    if(data.StatusCode != 0) return cb(new Error('tests failed on ' + target.image));
    cb();
  });
}

function clean(target, cb) {
  async.parallel([
    rimraf.bind(rimraf, target.dir),
    rimraf.bind(rimraf, target.tar)
    // docker.getContainer(container.Id).remove(callback);
  ], cb);
}

function fail(message) {
  console.error(message.red);
  process.exit(1);
}
