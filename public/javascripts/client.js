(function() {
  "use strict";

  var SpotifyRemoteClient = function(host) {
    this.host = host || window.location.hostname;
  };

  SpotifyRemoteClient.prototype.init = function(io, container) {
    this.socket    = io.connect(this.host);
    this.container = container;

    this.socket.on('currentTrack', this.showCurrentTrack.bind(this));
    this.socket.on('currentState', this.showCurrentState.bind(this));
    this.socket.on('currentArtwork', this.showCurrentArtwork.bind(this));

    var body = document.getElementsByTagName('body')[0];
    var self = this;

    body.addEventListener(
      'click',
      function(event) {
        var idsToFunctions = {
          'previous': self.playPrevious,
          'next': self.playNext,
          'current-play-state': self.playPause
        };

        var id = event.target.id;

        if (id && id in idsToFunctions) {
          idsToFunctions[id].call(self);
        }

        event.preventDefault();
      },
      false
    );

    body.addEventListener(
      'keyup',
      function(event) {
        var keyCodesToFunctions = {
          32: self.playPause,
          78: self.playNext,
          80: self.playPrevious,
          107: self.volumeUp,
          109: self.volumeDown
        };

        if (event.keyCode in keyCodesToFunctions) {
          keyCodesToFunctions[event.keyCode].call(self);
        }
      },
      false
    );
  };

  SpotifyRemoteClient.prototype.showCurrentTrack = function(track) {
    // don't rerender stuff when nothing has changed
    if (this.currentTrack && this.currentTrack.id == track.id) {
      return;
    }

    this.currentTrack = track;
    document.getElementById('current-track-artist').innerText   = track.artist;
    document.getElementById('current-track-name').innerText     = track.name;
    document.getElementById('current-track-duration').innerText = formatTime(track.duration);
  };

  SpotifyRemoteClient.prototype.showCurrentState = function(state) {
    if (!this.currentState || this.currentState.position !== state.position) {
      document.getElementById(
        'current-track-played-time'
      ).innerText = formatTime(parseInt(state.position, 10));
    }

    if (!this.currentState || this.currentState.state !== state.state) {
      document.getElementById(
        'current-play-state'
      ).innerText = state.state == 'paused' ? 'Play' : 'Pause';
    }

    if (!this.currentState || this.currentState.volume !== state.volume) {
      document.getElementById(
        'current-volume'
      ).innerText = state.volume;
    }

    this.currentState = state;
  };

  SpotifyRemoteClient.prototype.showCurrentArtwork = function(artwork) {
    document.getElementById('current-track-artwork').src = 'data:image/png;base64,' + artwork;
  };

  SpotifyRemoteClient.prototype.playPause = function() {
    this.socket.emit('playPause');
  };

  SpotifyRemoteClient.prototype.playNext = function() {
    this.socket.emit('next');
  };

  SpotifyRemoteClient.prototype.playPrevious = function() {
    this.socket.emit('previous');
  };

  SpotifyRemoteClient.prototype.volumeUp = function() {
    this.socket.emit('volumeUp');
  };

  SpotifyRemoteClient.prototype.volumeDown = function() {
    this.socket.emit('volumeDown');
  };

  function formatTime(totalSeconds) {
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;

    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    return minutes + ":" + seconds;
  };

  var client = new SpotifyRemoteClient();
  client.init(io, document.getElementById('remote-control'));
})();
