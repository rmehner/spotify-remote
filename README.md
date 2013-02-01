spotify-remote — Control Spotify from the browser
==============

## Synopsis
spotify-remote allows you to control Spotify from a browser. Currently it works
by talking to Spotify via its AppleScript interface, so only OS X is supported
at the moment.

The aim is to be as mobile & battery-friendly as possible.

## Installation

1. Install [Node.js](http://nodejs.org/)
2. Install spotify-remote in a shell:

    ```
    $ npm install -g spotify-remote
    ```

## Starting and using spotify-remote

1. Make sure Spotify is running.
2. Start the spotify-remote server in a shell:

    ```
    $ spotify-remote
    ```
3. Open `http://localhost:3000` in your browser

## Credits

* [Robin Mehner](http://coding-robin.de)
* [Thorsten Ball](http://thorstenball.github.com)
* [André Haveman](https://github.com/andrehaveman) for [spotify-node-applescript](https://github.com/andrehaveman/spotify-node-applescript)

## Todo

This thing is work in progress and the result of a hack day. It's working relatively
well, but of course there's a lot to do. Things that come to mind are:

* Linux support (Spotify is supposed to have a DBUS-Interface)
* Windows support (if anyone is up to it)
* Give this thing a nice design
* Make it even more battery friendly
* Test & fix on Android devices
* Search for Tracks
* Play arbitrary tracks
* Playlist support (as in: see the current track in the playlist)

## Contributing

Pull requests are very welcome, hack away and contribute! There is a tiny test
suite which you can run with:

```
$ npm test
```

If you need any help, don't hesitate to ask!
