#!/bin/bash
package=`jq '.name' metadata.json`
package=${package//\"/}
version=`jq '.version' metadata.json`
uuid=`jq '.uuid' metadata.json`
uuid=${uuid//\"/}

if [ ! -f po/messages.pot ];then
    touch po/messages.pot
fi
find schemas/ -iname "*.xml" | xargs xgettext -j -L GSettings --from-code=UTF-8 -k_ -kN_ -o po/messages.pot
find . -iname "*.js" | xargs xgettext -j -L JavaScript --from-code=UTF-8 -k_ -kN_ -o po/messages.pot
if [ -d locale ];then
    rm -rf locale/
fi
for i in po/*.po;do
    echo "=== $i ==="
    filename=$(basename "$i")
    lang=${filename/.po}
    file_size=`wc -c < $i`
    if [ $file_size -gt 0 ];then
        msgmerge -U $i po/messages.pot
    else
        msginit --output-file=$i --input=po/messages.pot --locale=$lang
    fi
    sed -i -e 's/charset=ASCII/charset=UTF-8/g' $i
    sed -i -e "s/PACKAGE VERSION/$package - $version/g" $i
    sed -i -e "s/PACKAGE package/$package package/g" $i
    ## Translations
    if [ ! -d locale/$lang ];then
        mkdir -p locale/$lang/LC_MESSAGES
    fi
    msgfmt $i -o locale/$lang/LC_MESSAGES/$uuid.mo
done
for i in po/*.po~;do
    if [ -f $i ];then
        rm $i
    fi
done
