#!/bin/bash

npm install

curl -L https://tarantool.io/knVRRof/release/3/installer.sh | bash
sudo apt-get -y install tarantool tt

sudo cp -f ./.devcontainer/tt.yaml /etc/tarantool
