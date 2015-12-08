#!/usr/bin/env node

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

var argv = (function(argv) {
  return {
    help: argv.h || argv.help,
    version: argv.v || argv.version,
    config: path.resolve(process.cwd(), argv.f || argv.file || '.chimera.yml'),
    project: path.resolve(process.cwd(), argv.p || argv.project || './'),
    target: argv.t || argv.target || process.env.CHIMERA_TARGET,
    verbose: argv.V || argv.verbose,
    _: argv._
  };
}(minimist(process.argv.slice(2))));
var verbose = argv.verbose ?
  function(arg) { console.log(arg); return arg;} :
  function(arg) { return arg; };
var docker;

Handlebars.registerHelper('render', function(template, data) {
  return new Handlebars.SafeString(Handlebars.compile(template)(data));
});
var dockerfile = Handlebars.compile([
  'FROM {{baseImage}}:{{tag}}',
  'COPY project/ /project',
  'WORKDIR /project',
  '',
  'ENV CHIMERA_TARGET={{name}}:{{tag}}',
  'ENV CHIMERA_TARGET_NAME={{name}}',
  'ENV CHIMERA_TARGET_TAG={{tag}}',
  '{{#each env}}',
  'ENV {{render this ../this}}',
  '{{/each}}',
  '',
  '{{#each install}}',
  'RUN {{render this ../this}}',
  '{{/each}}',
  'CMD {{script}}'
].join('\n'));

if (argv.help) {
  console.log([
    '',
    'Usage: chimera [options]',
    '       chimera generate <ci-service>',
    '',
    'Easy multi-container testing with Docker',
    '',
    'Options:',
    '',
    '  -h, --help               output usage information',
    '  -v, --version            output version',
    '  -c, --config <path>      set configuration file',
    '  -p, --project <path>     set project directory',
    '  -t, --target <image:tag> set target',
    '  -V, --verbose            verbose mode'
  ].join('\n'));
  process.exit(0);
}

if(argv.version) {
  console.log('chimera version ' + require('./package.json').version);
  process.exit(0);
}

fs.readFile(argv.config, 'utf8', function(err, raw) {
  fail(err);

  var config = yaml.safeLoad(raw);

  docker = new Docker(config.docker);

  targets(config, function(err, targets) {
    fail(err);

    switch (argv._[0]) {
    case 'generate':
      generate(targets);
      break;
    case 'run':
    case undefined:
      run(targets);
      break;
    default:
      console.error('unknown command, see --help');
    };
  });
});

function generate(targets) {
  switch (argv._[1]) {
  case 'travis':
    console.log(Handlebars.compile([
      'language: node_js',
      'sudo: required',
      'services:',
      '  - docker',
      'install:',
      '  - npm install -g chimera-cli',
      'script:',
      '  - chimera',
      'env:',
      '  matrix:',
      '{{#each this}}',
      '    - CHIMERA_TARGET={{name}}:{{tag}}',
      '{{/each}}'
    ].join('\n'))(targets));
    break;
  default:
    console.error('unknown ci service, example: chimera generate travis');
  };


};

function run(targets) {
  async.eachSeries(targets, function(target, cb) {
    console.log(('executing target ' + target.image).green);
    async.applyEachSeries([bundle, build, test, clean], target, cb);
  }, fail);
};

function targets(config, cb) {
  cb(null, _.map(config.targets, function(target, name) {
    return target.tags.map(function(tag) {
      var id = crypto.randomBytes(5).toString('hex');

      return {
        name: name,
        tag: tag,
        id: id,
        dir: path.join(os.tmpdir(), id),
        tar: path.join(os.tmpdir(), id + '.tar'),
        baseImage: target.image || name,
        image: name + '-' + tag + '-' + id,
        install: (target.install || []).concat(config.install || []),
        env: (target.env || []).concat(config.env || []),
        script: config.script.join(' && ') // TODO is this a good idea?
      };
    });
  }).reduce(function(a, b) {
    return a.concat(b);
  }).filter(function(target) {
    return !argv.target ||
      target.name.indexOf(argv.target) === 0 ||
      (target.name + ':' + target.tag).indexOf(argv.target) === 0;
  }));
}

function bundle(target, cb) {
  async.series([
    fs.mkdir.bind(fs, target.dir),
    fs.writeFile.bind(fs,
      path.join(target.dir, 'Dockerfile'), verbose(dockerfile(target))),
    fs.symlink.bind(fs, argv.project, path.join(target.dir, 'project')),
    function(cb) {
      tar.pack(target.dir, {dereference: true})
        .pipe(fs.createWriteStream(target.tar))
        .on('error', cb)
        .on('finish', cb);
    }
  ], cb);
}

function build(target, cb) {
  docker.buildImage(target.tar, {t: target.image}, function(err, res) {
    if(err) {
      return cb(err);
    }

    res.on('data', function(data) {
      var msg = JSON.parse(data);

      if(msg.error) {
        console.error(msg.error);
        cb = cb.bind(null, new Error('failed to build image ' + target.image));
      } else if(msg.stream || msg.status) {
        verbose(msg.stream || msg.status);
      }
    });
    res.on('end', cb);
  });
}

function test(target, cb) {
  docker.run(target.image, [], process.stdout, function(err, data, container) {
    if(err) {
      return cb(err);
    }
    if(data.StatusCode != 0) {
      return cb(new Error('tests failed on ' + target.image));
    }

    target.container = container.id;
    cb();
  });
}

function clean(target, cb) {
  var container = docker.getContainer(target.container);
  var image = docker.getImage(target.image);

  async.series([
    rimraf.bind(rimraf, target.dir),
    rimraf.bind(rimraf, target.tar),
    container.remove.bind(container),
    image.remove.bind(image)
  ], cb);
}

function fail(err) {
  if(err) {
    console.error(err.message.red);
    process.exit(1);
  }
}
