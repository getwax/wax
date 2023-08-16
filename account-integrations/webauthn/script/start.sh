#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

set -meuo pipefail

function cleanup {
  docker stop $CONTAINER || true
  jobs -p | xargs kill
}

trap cleanup EXIT
trap cleanup INT

docker pull ethereum/client-go:v1.10.26

CONTAINER=geth$RANDOM

docker run --rm -i --name $CONTAINER -p 8545:8545 ethereum/client-go:v1.10.26 \
  --miner.gaslimit 100000000 \
  --http \
  --http.api personal,eth,net,web3,debug \
  --http.vhosts '*,localhost,host.docker.internal' \
  --http.corsdomain='*' \
  --http.addr "0.0.0.0" \
  --ignore-legacy-receipts \
  --allow-insecure-unlock \
  --rpc.allow-unprotected-txs \
  --rpc.txfeecap 2 \
  --dev \
  --verbosity 2 \
  --nodiscover \
  --maxpeers 0 \
  --mine \
  --miner.threads 1 \
  --networkid 1337 \
  &

echo $SCRIPT_DIR

"$SCRIPT_DIR/wait-for-rpc.sh"

docker exec $CONTAINER geth \
  --exec "$(cat "$SCRIPT_DIR/fundAccounts.js")" \
  attach 'http://localhost:8545'

yarn hardhat run "$SCRIPT_DIR/deploy_all.ts" --network localhost

fg
