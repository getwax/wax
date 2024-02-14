#!/bin/bash

CONFIG_SOURCE="./src/config/config.template.ts"
CONFIG_DESTINATION="./src/config/config.ts"

ARTIFACT_SOURCE="../../safe/out/SafeZkEmailRecoveryPlugin.sol/SafeZkEmailRecoveryPlugin.json"
ARTIFACT_DESTINATION="./src/config/SafeZkEmailRecoveryPlugin.json"

if [ ! -f $CONFIG_DESTINATION ]; then
    cp $CONFIG_SOURCE $CONFIG_DESTINATION

    echo "$CONFIG_DESTINATION can be edited to suit your needs"
else
    echo "Config already exists at $CONFIG_DESTINATION"
fi

if [ ! -f $ARTIFACT_SOURCE ]; then
    echo "$ARTIFACT_SOURCE does not exist, generate contract artifacts with 'forge build' in 'account-integrations/safe'"
else
    cp $ARTIFACT_SOURCE $ARTIFACT_DESTINATION

    echo "Setup success 🔥"
fi

echo "Use yarn dev to start the relayer"

exit 0