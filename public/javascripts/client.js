(function() {
  "use strict";

  var SpotifyRemoteClient = function(host) {
    this.host                  = host || window.location.hostname;
    this.elements              = [];
    this._canTouchThis         = 'ontouchstart' in window || 'createTouch' in document;
    this._volumeRangeBlocked   = false;
    this._positionRangeBlocked = false;
  };

  SpotifyRemoteClient.prototype.init = function(io) {
    this.socket = io.connect(this.host);

    this.socket.on('currentTrack', this.showCurrentTrack.bind(this));
    this.socket.on('currentState', this.showCurrentState.bind(this));
    this.socket.on('currentArtwork', this.showCurrentArtwork.bind(this));

    document.addEventListener(
      this._canTouchThis ? 'touchstart' : 'click',
      function(event) {
        var command = {
          'previous': 'previous',
          'next': 'next',
          'current-play-state': 'playPause'
        }[event.target.id];

        if (!command) return;

        this.socket.emit(command);
        event.preventDefault();
      }.bind(this)
    );

    document.addEventListener(
      'keyup',
      function(event) {
        var command = {
          32: 'playPause',   // space
          78: 'next',        // n
          80: 'previous',    // p
          107: 'volumeUp',   // + on numpad
          109: 'volumeDown', // - on numpad
          187: 'volumeUp',   // +
          189: 'volumeDown'  // -
        }[event.keyCode];

        if (command) this.socket.emit(command);
      }.bind(this)
    );

    // volume control
    this.$('current-volume').addEventListener(
      'change',
      function(event) {
        this.socket.emit('setVolume', event.target.value);
      }.bind(this)
    );

    this.$('current-volume').addEventListener(
      this._canTouchThis ? 'touchstart' : 'mousedown',
      function() {
        this._volumeRangeBlocked = true;
      }.bind(this)
    );

    this.$('current-volume').addEventListener(
      this._canTouchThis ? 'touchend' : 'mouseup',
      function() {
        this._volumeRangeBlocked = false;
      }.bind(this)
    );

    // position control
    this.$('position').addEventListener(
      this._canTouchThis ? 'touchstart' : 'mousedown',
      function() {
        this._positionRangeBlocked = true;
      }.bind(this)
    );

    this.$('position').addEventListener(
      this._canTouchThis ? 'touchend' : 'mouseup',
      function(event) {
        this.socket.emit('jumpTo', event.target.value);
        this._positionRangeBlocked = false;
      }.bind(this)
    );
  };

  SpotifyRemoteClient.prototype.showCurrentTrack = function(track) {
    // don't rerender stuff when nothing has changed
    if (this.currentTrack && this.currentTrack.id == track.id) {
      return;
    }

    this.$('artist').textContent   = track.artist;
    this.$('name').textContent     = track.name;
    this.$('duration').textContent = this.formatTime(track.duration);
    this.$('position').setAttribute('max', track.duration);

    this.currentTrack = track;
  };

  SpotifyRemoteClient.prototype.showCurrentState = function(state) {
    if (!this.currentState || this.currentState.position !== state.position) {
      this.$('played-time').textContent = this.formatTime(parseInt(state.position, 10));

      if (!this._positionRangeBlocked) {
        this.$('position').value = state.position.replace(',', '.');
      }
    }

    if (!this.currentState || this.currentState.state !== state.state) {
      this.$('current-play-state').textContent = state.state == 'paused' ? 'Play' : 'Pause';
    }

    if (!this._volumeRangeBlocked && (!this.currentState || this.currentState.volume !== state.volume)) {
      this.$('current-volume').value = state.volume;
    }

    this.currentState = state;
  };

  SpotifyRemoteClient.prototype.showCurrentArtwork = function(artwork) {
    this.$('artwork').src = 'data:image/png;base64,' + artwork;
  };

  // jQuery.
  SpotifyRemoteClient.prototype.$ = function(id) {
    this.elements[id] = this.elements[id] || document.getElementById(id);

    return this.elements[id];
  };

  SpotifyRemoteClient.prototype.formatTime = function(totalSeconds) {
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;

    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    return minutes + ":" + seconds;
  };

  var client = new SpotifyRemoteClient();
  client.init(io);
})();
