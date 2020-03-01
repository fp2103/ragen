#!/bin/bash

# ---- CONFIGURATION ----

OUTPUT="public/ragen.js"
# Input:
DIR="src"
FILES="
physics.js
line.js
particles.js
leaderboard.js
terrain.js
circuit_utils.js
circuit.js
car.js
driver.js
gameplay.js
menu.js
mainVue.js
minimap.js
main.js
"

# ---- BUILDING SCRIPT ----
echo "Start build"

echo "'use strict';" > $OUTPUT
for f in $FILES; do
    echo "Adding $DIR/$f to $OUTPUT";
    echo "// *-*-*-*- $DIR/$f -*-*-*-*" >> $OUTPUT
    cat $DIR/$f >> $OUTPUT;
done

# Uglify
if [ "$PROD_ENABLED" ] ; then
    echo -n "Uglify..."
    ./node_modules/uglify-es/bin/uglifyjs -c -m --toplevel $OUTPUT > $OUTPUT.ugly
    mv $OUTPUT.ugly $OUTPUT
    echo "OK"
fi;

echo "End build"