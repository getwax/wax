#!/bin/bash

SOURCE_FILE="./src/config/config.template.ts"
DESTINATION_FILE="./src/config/config.ts"

if [ ! -f $DESTINATION_FILE ]; then
    cp $SOURCE_FILE $DESTINATION_FILE

    echo "$DESTINATION_FILE can be edited to suit your needs"
else
    echo "Config already exists at $DESTINATION_FILE"
fi

echo "Setup success 🔥"

echo "Use yarn dev to start the relayer"

exit 0