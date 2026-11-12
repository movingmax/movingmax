#!/usr/bin/env bash
# Netlify-Build: kopiert die Seite nach dist/ und holt Schriften und Weltkarte auf den eigenen Server,
# damit Besucher keine Verbindung zu Google oder jsDelivr aufbauen. Klappt ein Download nicht,
# bleiben die externen Links stehen und die Seite funktioniert trotzdem.
set -u
rm -rf dist && mkdir -p dist/fonts dist/vendor
cp -r index.html community-ride.html spiel.html impressum.html datenschutz.html robots.txt sitemap.xml img downloads en dist/

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
GF='https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600&display=swap'
if curl -fsSL -A "$UA" "$GF" -o dist/fonts/fonts.css; then
  ok=1; i=0
  for url in $(grep -o 'https://fonts.gstatic.com/[^)]*' dist/fonts/fonts.css | sort -u); do
    i=$((i+1)); f="f$i.woff2"
    if curl -fsSL "$url" -o "dist/fonts/$f"; then sed -i "s#$url#$f#g" dist/fonts/fonts.css; else ok=0; fi
  done
  if [ "$ok" = 1 ]; then
    for h in dist/*.html dist/en/*.html; do
      pre=""; case "$h" in dist/en/*) pre="../";; esac
      sed -i "s#<link href=\"https://fonts.googleapis.com/css2[^\"]*\" rel=\"stylesheet\">#<link href=\"${pre}fonts/fonts.css\" rel=\"stylesheet\">#" "$h"
      sed -i '/fonts.googleapis.com\|fonts.gstatic.com/d' "$h"
    done
    echo "Schriften lokal eingebunden"
  fi
fi
if curl -fsSL https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/js/world.js -o dist/vendor/world.js; then
  sed -i 's#https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/js/world.js#vendor/world.js#' dist/index.html
  sed -i 's#https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/js/world.js#../vendor/world.js#' dist/en/index.html
  echo "Weltkarte lokal eingebunden"
fi
