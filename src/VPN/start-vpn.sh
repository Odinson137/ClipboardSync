#!/bin/bash

set -e

echo "Starting IPsec..."
ipsec start

echo "Starting xl2tpd..."
xl2tpd

echo "Bringing up IPsec connection..."
ipsec up myvpn

sleep 5

echo "Connecting L2TP..."
echo "c myvpn" > /var/run/xl2tpd/l2tp-control

# Оставляем контейнер работать и выводим логи
tail -f /var/log/syslog

docker run \
    --name ipsec-vpn-server \
    --restart=always \
    -v ikev2-vpn-data:/etc/ipsec.d \
    -v /lib/modules:/lib/modules:ro \
    -p 500:500/udp \
    -p 4500:4500/udp \
    -d --privileged \
    hwdsl2/ipsec-vpn-server
