#!/bin/bash

# Runs a hardhat node and deploys contracts in one script, ensuring proper
# cleanup when errors occur.
#
# Advantages of using hardhat:
# - Good debug output
# - Support for console.log
#
# Disadvantages:
# - Bundler needs to be run in unsafe mode, so its restrictions on user ops
#   are not tested
# - Slower than geth

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
