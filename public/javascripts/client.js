(function(d) {
  "use strict";

  var SpotifyRemoteClient = function(host) {
    this.host                  = host || window.location.hostname;
    this.elements              = [];
    this._canTouchThis         = 'ontouchstart' in window || 'createTouch' in d;
    this._volumeRangeBlocked   = false;
    this._positionRangeBlocked = false;
  };

  SpotifyRemoteClient.prototype.init = function(io, container) {
    this.socket    = io.connect(this.host);
    this.container = container;

    this.socket.on('currentTrack', this.showCurrentTrack.bind(this));
    this.socket.on('currentState', this.showCurrentState.bind(this));
    this.socket.on('currentArtwork', this.showCurrentArtwork.bind(this));

    var body = d.getElementsByTagName('body')[0];

    body.addEventListener(
      'click',
      function(event) {
        var command = {
          'previous': 'previous',
          'next': 'next',
          'current-play-state': 'playPause'
        }[event.target.id];

        if (command) this._emit(command);

        event.preventDefault();
      }.bind(this),
      false
    );

    body.addEventListener(
      'keyup',
      function(event) {
        var command = {
          32: 'playPause', // space
          78: 'next', // n
          80: 'previous', // p
          107: 'volumeUp', // + on numpad
          109: 'volumeDown', // - on numpad
          187: 'volumeUp', // +
          189: 'volumeDown' // -
        }[event.keyCode];

        if (command) this._emit(command);
      }.bind(this),
      false
    );

    // volume control
    this.$('current-volume').addEventListener(
      'change',
      function(event) {
        this.socket.emit('setVolume', event.target.value);
      }.bind(this),
      false
    );

    this.$('current-volume').addEventListener(
      this._canTouchThis ? 'touchstart' : 'mousedown',
      function() {
        this._volumeRangeBlocked = true;
      }.bind(this),
      false
    );

    this.$('current-volume').addEventListener(
      this._canTouchThis ? 'touchend' : 'mouseup',
      function() {
        this._volumeRangeBlocked = false;
      }.bind(this),
      false
    );

    // position control
    this.$('position').addEventListener(
      this._canTouchThis ? 'touchstart' : 'mousedown',
      function() {
        this._positionRangeBlocked = true;
      }.bind(this),
      false
    );

    this.$('position').addEventListener(
      this._canTouchThis ? 'touchend' : 'mouseup',
      function(event) {
        this.socket.emit('jumpTo', event.target.value);
        this._positionRangeBlocked = false;
      }.bind(this),
      false
    );
  };

  SpotifyRemoteClient.prototype.showCurrentTrack = function(track) {
    // don't rerender stuff when nothing has changed
    if (this.currentTrack && this.currentTrack.id == track.id) {
      return;
    }

    this.$('artist').innerText   = track.artist;
    this.$('name').innerText     = track.name;
    this.$('duration').innerText = formatTime(track.duration);
    this.$('position').setAttribute('max', track.duration);

    this.currentTrack = track;
  };

  SpotifyRemoteClient.prototype.showCurrentState = function(state) {
    if (!this.currentState || this.currentState.position !== state.position) {
      this.$('played-time').innerText = formatTime(parseInt(state.position, 10));

      if (!this._positionRangeBlocked) {
        this.$('position').value = state.position.replace(',', '.');
      }
    }

    if (!this.currentState || this.currentState.state !== state.state) {
      this.$('current-play-state').innerText = state.state == 'paused' ? 'Play' : 'Pause';
    }

    if (!this._volumeRangeBlocked && (!this.currentState || this.currentState.volume !== state.volume)) {
      this.$('current-volume').value = state.volume;
    }

    this.currentState = state;
  };

  SpotifyRemoteClient.prototype.showCurrentArtwork = function(artwork) {
    this.$('artwork').src = 'data:image/png;base64,' + artwork;
  };

  SpotifyRemoteClient.prototype._emit = function(command) {
    this.socket.emit(command);
  };

  // jQuery.
  SpotifyRemoteClient.prototype.$ = function(id) {
    this.elements[id] = this.elements[id] || d.getElementById(id);

    return this.elements[id];
  };

  function formatTime(totalSeconds) {
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;

    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    return minutes + ":" + seconds;
  };

  var client = new SpotifyRemoteClient();
  client.init(io, d.getElementById('remote-control'));
})(document);
