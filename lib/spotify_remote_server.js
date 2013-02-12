var fs = require('fs');

module.exports = SpotifyRemoteServer;

function SpotifyRemoteServer(io, spotify, opts) {
  this.io               = io;
  this.spotify          = spotify;
  this.sockets          = [];
  this.interval         = opts && 'interval' in opts ? opts.interval : 500;
  this.tries            = {};
  this.resetTimeouts    = {};
  this.spotifyIsRunning = true;

  this.io.sockets.on('connection', this.handleConnection.bind(this));
}

SpotifyRemoteServer.prototype.startPolling = function() {
  if (!this.currentStateInterval) {
    this.currentStateInterval = setInterval(this.getCurrentState.bind(this), this.interval);
  }
};

SpotifyRemoteServer.prototype.stopPolling = function() {
  clearInterval(this.currentStateInterval);
  delete this.currentStateInterval;
};

SpotifyRemoteServer.prototype.handleConnection = function(socket) {
  this.sockets.push(socket);
  this.getCurrentState();
  this.getCurrentTrack();
  this.getCurrentArtwork();
  this.startPolling();

  var self = this;

  ['next', 'previous', 'playPause', 'volumeUp', 'volumeDown'].forEach(function(event) {
    socket.on(event, function() {
      if (self.spotifyIsRunning) {
        self.spotify[event].call(undefined, self.getCurrentState.bind(self));
      }
    });
  });

  socket.on('disconnect', this.handleDisconnect.bind(this, socket));
  socket.on('setVolume', this.setVolume.bind(this));
  socket.on('jumpTo', this.jumpTo.bind(this));
};

SpotifyRemoteServer.prototype.handleDisconnect = function(socket) {
  this.sockets = this.sockets.filter(function(closedSocket) {
    return closedSocket !== socket;
  });

  if (this.sockets.length === 0) this.stopPolling();
};

SpotifyRemoteServer.prototype.setVolume = function(volume) {
  if (this.spotifyIsRunning) {
    this.spotify.setVolume(volume, this.getCurrentState.bind(this));
  }
};

SpotifyRemoteServer.prototype.jumpTo = function(second) {
  if (this.spotifyIsRunning) {
    this.spotify.jumpTo(second, this.getCurrentState.bind(this));
  }
};

SpotifyRemoteServer.prototype.getCurrentTrack = function() {
  var sendTrack = this.emitToAllSockets.bind(this, 'currentTrack');

  if (this.currentTrack) {
    sendTrack(this.currentTrack);
    return;
  }

  this.spotify.getTrack(function(err, track) {
    if (err) {
      this.retry(this.getCurrentTrack);
      return;
    }

    if (track === false) {
      this.emitToAllSockets('spotifyNotRunning');
      this.spotifyIsRunning = false;
      return;
    } else {
      this.spotifyIsRunning = true;
    }

    this.currentTrack = track;
    sendTrack(this.currentTrack);
  }.bind(this));
};

SpotifyRemoteServer.prototype.getCurrentState = function() {
  this.spotify.getState(function(err, state) {
    if (state === false) {
      this.emitToAllSockets('spotifyNotRunning');
      this.spotifyIsRunning = false;
      return;
    } else {
      this.spotifyIsRunning = true;
    }

    if (!err) {
      this.emitToAllSockets('currentState', state);
      if (!this.currentTrack || this.currentTrack.id !== state.track_id) {
        this.trackHasChanged();
      }
    }
  }.bind(this));
};

SpotifyRemoteServer.prototype.getCurrentArtwork = function() {
  var self        = this;
  var sendArtwork = this.emitToAllSockets.bind(this, 'currentArtwork');

  if (this.currentArtwork) {
    sendArtwork(this.currentArtwork);
    return;
  }

  this.spotify.getArtwork(function(err, artworkPath) {
    // for some weird reason the artwork path applescript likes to return undefined
    // every once in a while, just ignore that and retry
    if (err || typeof artworkPath === 'undefined') {
      if (err) console.error(err);
      self.retry(self.getCurrentArtwork);
      return;
    }

    if (artworkPath === false) {
      this.emitToAllSockets('spotifyNotRunning');
      this.spotifyIsRunning = false;
      return;
    } else {
      this.spotifyIsRunning = true;
    }

    fs.readFile(artworkPath, function(err, artwork) {
      if (err) {
        console.error(err);
        self.retry(self.getCurrentArtwork);
        return;
      }

      self.currentArtwork = artwork.toString('base64');
      sendArtwork(self.currentArtwork);
    });
  });
};

SpotifyRemoteServer.prototype.emitToAllSockets = function(name, data) {
  this.sockets.forEach(function(socket) {
    socket.emit(name, data);
  });
};

SpotifyRemoteServer.prototype.trackHasChanged = function() {
  delete this.currentTrack;
  delete this.currentArtwork;
  this.getCurrentTrack();
  this.getCurrentArtwork();
};

SpotifyRemoteServer.prototype.retry = function(fn, timeout) {
  this.tries[fn] = this.tries[fn] || 0;

  if (this.tries[fn]++ >= 5) return;

  setTimeout(fn.bind(this), timeout || 250);
  if (this.resetTimeouts[fn]) clearTimeout(this.resetTimeouts[fn]);

  this.resetTimeouts[fn] = setTimeout(function() {
    this.tries[fn] = 0;
  }.bind(this), 10000);
};
