#!/bin/bash

# Runs a geth node and deploys contracts in one script, ensuring proper cleanup
# when errors occur.
#
# Advantages of using geth:
# - Exposes special trace methods needed to run the bundler, enabling testing of
#   the bundler's restrictions on user ops
# - Fast
#
# Note: If this does not shutdown correctly on exit, you will need to manually
# stop the containers. See https://github.com/getwax/wax/issues/144
#
# Stop all running containers:
# $ docker stop $(docker container ls -q)
#
# Stop only containers for this script:
# $ docker ps # for container ids/names
# $ docker stop BUNDLER_CONTAINER_ID_OR_NAME GETH_CONTAINER_ID_OR_NAME

DOCKER_NETWORK=account-integrations-safe-docker-network

GETH_IMAGE=ethereum/client-go:v1.13.5
BUNDLER_IMAGE=accountabstraction/bundler:0.6.2

GETH_CONTAINER=geth${RANDOM}
BUNDLER_CONTAINER=bundler${RANDOM}

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

set -meuo pipefail

# Cleanup on script exit
function cleanup {
  docker stop ${GETH_CONTAINER} || true
  docker stop ${BUNDLER_CONTAINER} || true
  docker network rm ${DOCKER_NETWORK} || true
  jobs -p | xargs kill
}

trap cleanup EXIT
trap cleanup INT

# Create docker network if it does not exist
docker network inspect ${DOCKER_NETWORK} >/dev/null 2>&1 || \
  docker network create ${DOCKER_NETWORK}

# Start geth rpc container
docker pull ${GETH_IMAGE}

docker run --rm -i --name ${GETH_CONTAINER} -p 8545:8545 --network=${DOCKER_NETWORK} ${GETH_IMAGE} \
  --miner.gaslimit 100000000 \
  --http \
  --http.api personal,eth,net,web3,debug \
  --http.vhosts '*,localhost,host.docker.internal' \
  --http.corsdomain='*' \
  --http.addr "0.0.0.0" \
  --allow-insecure-unlock \
  --rpc.allow-unprotected-txs \
  --rpc.txfeecap 2 \
  --dev \
  --verbosity 2 \
  --nodiscover \
  --maxpeers 0 \
  --mine \
  --networkid 1337 \
  &

echo ${SCRIPT_DIR}

"${SCRIPT_DIR}/wait-for-rpc.sh"

# Fund initial accounts
docker exec ${GETH_CONTAINER} geth \
  --exec "$(cat "${SCRIPT_DIR}/fundAccounts.js")" \
  attach 'http://localhost:8545'

# Deploy common contracts
yarn hardhat run "${SCRIPT_DIR}/deploy_all.ts" --network localhost

# Start ERC-4337 bundler
docker pull ${BUNDLER_IMAGE}

docker run --rm -i --name ${BUNDLER_CONTAINER} -p 3000:3000 -v "$PWD"/config:/app/workdir:ro --network=${DOCKER_NETWORK} ${BUNDLER_IMAGE} \
  --network http://${GETH_CONTAINER}:8545 \
  &

fg
