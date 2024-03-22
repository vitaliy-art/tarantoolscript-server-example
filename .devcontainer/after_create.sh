#!/bin/bash

npm install

curl -L https://tarantool.io/knVRRof/release/3/installer.sh | bash
sudo apt-get -y install tarantool tt
sudo cp -f ./tt.yaml /etc/tarantool
apt-get install -y tarantool-dev
tt rocks install --tree ./build/.rocks http
