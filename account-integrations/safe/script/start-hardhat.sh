#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

set -meuo pipefail

function cleanup {
  docker stop $CONTAINER || true
  jobs -p | xargs kill
}

trap cleanup EXIT
trap cleanup INT

yarn hardhat node &

echo $SCRIPT_DIR

"$SCRIPT_DIR/wait-for-rpc.sh"

yarn hardhat run "$SCRIPT_DIR/deploy_all.ts" --network localhost

fg
