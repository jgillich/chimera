# chimera

Chimera allows you to run your tests on multiple Linux distributions with very
little effort.

## Getting Started

First, you'll need to install the chimera cli:

```
npm install -g chimera-cli
```

Then, create a `.chimera.yml` configuration file in your project root. For a
Node.js project, something like this is a good starting point:

```
install:
  - npm install
script:
  - npm test
docker:
  socketPath: /var/run/docker.sock
images:
  ubuntu:
    image: ubuntu
    tags:
      - "14.04"
      - "15.10"
    install:
      - apt-get update -qq
      - apt-get upgrade -y -qq
      - apt-get install nodejs nodejs-legacy npm -y -qq
  fedora:
    image: fedora
    tags:
      - "22"
      - "23"
    install:
      - dnf update -y -q
      - dnf install node npm -y -q
```

To execute the configuration, simply invoke `chimera`.

## Configuration

### install
List of commands to install any dependencies. Also available for each image.

### script
The main test commands.

### docker
Docker client configuration passed to [dockerode](https://github.com/apocas/dockerode).

### images
The images you want to test on.

## CI services

### Travis
Chimera on Travis requires you to use the VM infrastructure. In your `.travis.yml`:
```
sudo: required
services:
  - docker
install:
  - npm install -g chimera
script:
  - chimera
```
