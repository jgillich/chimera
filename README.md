# Chimera [![Build Status](https://travis-ci.org/jgillich/chimera.svg)](https://travis-ci.org/jgillich/chimera)

Chimera allows you to run your tests on multiple Linux distributions. It is designed
to work with any language, testing library and any CI platform that supports Docker.

## Getting Started

First, you'll need to install the chimera cli:

```javascript
npm install -g chimera-cli
```

Then, create a `.chimera.yml` configuration file in your project root. For a
Node.js project, something like this is a good starting point:

```yaml
install:
  - npm install
script:
  - npm test
docker:
  socketPath: /var/run/docker.sock
targets:
  ubuntu:
    tags:
      - "14.04"
      - "15.10"
    install:
      - apt-get update -qq
      - apt-get upgrade -y -qq
      - apt-get install nodejs nodejs-legacy npm -y -qq
  fedora:
    tags:
      - "22"
      - "23"
    install:
      - dnf update -y -q
      - dnf install node npm -y -q
```

To execute the configuration, simply invoke `chimera`.

## Configuration

* `install` is where you install dependencies.

* `env` sets environment variables.

* `script` defines your main test commands.

* `docker` is the Docker client configuration passed to [dockerode](https://github.com/apocas/dockerode).

* `targets` defines the images you want to test on.

    * `image` is name of the image (optional, defaults to target name)
    * `tags` sets the tags
    * `install` runs before the top level install
    * `env` sets environment variables

## Templating

Chimera renders `install` and `env` as Handlebar templates, allowing you to
modify your container based in variables like tag. For example, to install EPEL
on CentOS, you add this:

```
yum install https://dl.fedoraproject.org/pub/epel/epel-release-latest-{{ tag }}.noarch.rpm -y -q
```

The following template variables are available:

* `name`: image name
* `tag`: image tag
* `id`: unique container id

## Options

Run `chimera --help` to get the full list of available options.

* `-f, --file <path>` sets configuration file, by default `.chimera.yml` in the current directory.

* `-p, --project <path>` sets the project directory that is copied to `/project` inside containers.
  By default, this is the current directory.

* `-t, --target <image:tag>` sets the target(s) to run, either in the form of `image`
  (run all tags  of image) or `image:tag` (single tag). You can also set this
  option using the environment variable `CHIMERA_TARGET`.

## CI services

### Travis
Use `chimera generate travis` to generate a `.travis.yml` based on your Chimera
configuration. Here is a example:
```
language: node_js
sudo: required
services:
  - docker
install:
  - npm install -g chimera-cli
script:
  - chimera
env:
  matrix:
    - CHIMERA_TARGET=ubuntu:14.04
    - CHIMERA_TARGET=ubuntu:15.10
    - CHIMERA_TARGET=fedora:22
    - CHIMERA_TARGET=fedora:23
```
