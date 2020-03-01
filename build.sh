#!/bin/bash

# ---- CONFIGURATION ----

OUTPUTDIR="public"

# SCRIPTS
OUTPUT="$OUTPUTDIR/ragen.js"
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

LIBS="
seedrandom
three
three/stats
ammo
socket.io-client/socket.io
"
OUTPUTDIRLIBS="$OUTPUTDIR/libs"

# STYLESHEETS
CSSDIR="views"

# ---- BUILDING SCRIPT ----
echo "Start build"

# STYLESHEETS
# TODO minify css
# for now just copy the file
cp $CSSDIR/*.css $OUTPUTDIR/
echo "CSS done"

# SCRIPTS
# Libs
rm -r $OUTPUTDIRLIBS
mkdir $OUTPUTDIRLIBS
for l in $LIBS; do
    echo "Searching lib $l"
    # Libs with a / 
    p=( $( echo $l | tr "/" "\n" ))
    d=${p[0]}
    c=${p[1]}
    if [ -z "$c" ]; then c=$l; fi

    # find and copy file
    if [ -d "./node_modules/$d" ]; then
        min=$( find ./node_modules/$d -name $c.min.js )
        max=$( find ./node_modules/$d -name $c.js )
        if [ -n "$min" ]; then cp $min $OUTPUTDIRLIBS; 
        elif [ -n "$max" ]; then cp $max $OUTPUTDIRLIBS; 
        else echo "$l not found"; fi
    else
        other=$( find $DIR -name $l.js -o -name $l.min.js )
        if [ -n "$other" ]; then cp $other $OUTPUTDIRLIBS; fi
    fi
done

# Sources
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

echo "JS done"
echo "End build"