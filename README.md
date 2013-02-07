# spotify-remote — Control Spotify from the browser

[![Build Status](https://travis-ci.org/rmehner/spotify-remote.png?branch=master)](https://travis-ci.org/rmehner/spotify-remote)

## Synopsis

spotify-remote allows you to control Spotify from a browser. Currently it works
by talking to Spotify via its AppleScript interface, so only OS X is supported
at the moment.

## Aim

spotify-remote tries to be a lightweight client-server solution for controlling
your Spotify, being as battery-friendly and mobile-friendly as possible.

One of the major issues regarding performance at the moment is the usage of
AppleScript to poll the Spotify client. The aim is to either optimize the usage
of AppleScript to shrink its CPU consumption or find a different solution
altogether.

## Installation

1. Install [Node.js](http://nodejs.org/)
2. Install spotify-remote in a shell:

    ```
    $ npm install -g spotify-remote
    ```

## Update

```
$ npm install -g spotify-remote
```

## Starting and using spotify-remote

1. Make sure Spotify is running.
2. Start the spotify-remote server in a shell:

    ```
    $ spotify-remote
    ```
3. Open `http://localhost:3333` in your browser

If you need a different port, just use the PORT environment variable:

```
$ PORT=1337 spotify-remote
```

## Credits

* [Robin Mehner](http://coding-robin.de)
* [Thorsten Ball](http://mrnugget.github.com)
* [Matti Besser](http://mattibesser.com) for the first design
* [André Haveman](https://github.com/andrehaveman) for [spotify-node-applescript](https://github.com/andrehaveman/spotify-node-applescript)

## Todo

This thing is work in progress and the result of a hack day. It's working relatively
well, but of course there's a lot to do. Things that come to mind are:

* Linux support (Spotify is supposed to have a DBUS-Interface)
* Windows support (if anyone is up to it)
* Make it even more battery friendly
* Test & fix on Android devices
* Search for tracks
* Play arbitrary tracks
* Playlist support (as in: see the current track in the playlist)

## Contributing

Pull requests are very welcome, hack away and contribute! There is a tiny test
suite which you can run with:

```
$ npm test
```

If you need any help, don't hesitate to ask!

## License

MIT, see [LICENSE](LICENSE)

[Spotify](http://www.spotify.com) is a registered trademark of Spotify Ltd.
spotify-remote is in no way affiliated with Spotify, we're just a little
tool sitting on top of the Spotify.app and their webservices.

We come in peace.
