# Changelog

## 0.0.5 (Released 11th February, 2013)

* Fix Lion compatibility by using upstream patch from @andrehavemann in spotify-node-applescript
* The height should have a cap now, so it doesn't grow beyond sense

## 0.0.4 (Released 8th February, 2013)

* introduce a design, thank you @mbesser
* stop polling for artwork when there is no active socket connection
* reduce polling interval for state, reducing CPU usage, thank you @mrnugget
* make this thing homescreen friendly
* reduce CPU usage by only polling for track and artwork when it actually has changed

## 0.0.3 (Released 4th February, 2013)

* use simple static file server instead of express
* use touchstart instead of click for touch devices (should be more responsive now)

## 0.0.2 (Released 1st February, 2013)

* change default port to 3333
* fix display for Firefox (sans input type range) by using textContent instead of innerText

## 0.0.1 (Released 1st February, 2013)

* initial release
* play/pause track
* next/previous track
* control volume
* control position in song
* see the artwork
