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
terrain.js
circuit_utils.js
circuit.js
car.js
leaderboard_table.js
leaderboard.js
driver.js
controls.js
podiumScene.js
ghost.js
gameplay.js
client.js
menu.js
mainView.js
minimapView.js
responsive.js
main.js
"

LIBS="
seedrandom
three
three/stats
WebGL
ammo
socket.io-client/socket.io
"
OUTPUTDIRLIBS="$OUTPUTDIR/libs"

# STYLESHEETS
CSSDIR="views"

# ---- BUILDING SCRIPT ----
echo "Start build"

rm -r $OUTPUTDIR
mkdir $OUTPUTDIR

# STYLESHEETS
# TODO minify css
# for now just copy the file
cp $CSSDIR/*.css $OUTPUTDIR/
echo "CSS done"

# SCRIPTS
# Libs
mkdir $OUTPUTDIRLIBS
for l in $LIBS; do
    echo "Loading lib $l"
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
    echo "" >> $OUTPUT;
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
echo

# ----- ITCHIO BUILD ---------

if [ "$1" == "itchio" ] ; then
    echo "Concat everything in one file for itchio"
    #SERVER="my-project-24674.appspot.com"
    SERVER="localhost:8080"

    # itchio specific in ragen.js 
    cp public/ragen.js public/ragen.js.bak
    sed "s/window.location.host/\"${SERVER}\"/" public/ragen.js > res
    mv res public/ragen.js

    # sessionid
    cp views/index.ejs public/index.html
    sed 's/<%= sessionid %>//' public/index.html > res
    mv res public/index.html
    # fullscreen button
    sed 's/id="fullscreen"/id="fullscreen" style="display: none;"/' public/index.html > res
    mv res public/index.html

    # css
    grepline=` grep -n "main.css" public/index.html | awk -F ':' '{print $1}' `
    head -$(( ${grepline} - 1 )) public/index.html > res
    echo "<style>" >> res
    cat views/main.css >> res
    echo "</style>" >> res
    awk "NR>${grepline}" public/index.html >> res

    # scripts
    grep "<script src=" res > scr_list
    while read line ; do
        
        scr_src=` echo $line | awk -F '"' '{print $2}' `
        scr_line=` grep -n "${scr_src}" res | awk -F ':' '{print $1}' `

        head -$(( ${scr_line} - 1 )) res > res2
        echo "<script>" >> res2
        cat public/$scr_src >> res2
        echo "" >> res2
        echo "</script>" >> res2
        awk "NR>${scr_line}" res >> res2

        mv res2 res

    done < scr_list
    rm scr_list

    mv res public/index.html
    mv public/ragen.js.bak public/ragen.js
fi