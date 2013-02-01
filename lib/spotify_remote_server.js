var fs = require('fs');

module.exports = SpotifyRemoteServer;

function SpotifyRemoteServer(io, spotify, opts) {
  this.io       = io;
  this.spotify  = spotify;
  this.sockets  = [];
  this.noop     = function(){};
  this.interval = opts && 'interval' in opts ? opts.interval : 250;

  this.io.sockets.on('connection', this.handleConnection.bind(this));
}

SpotifyRemoteServer.prototype.startIntervals = function() {
  if (!this.currentTrackInterval) {
    this.currentTrackInterval = setInterval(this.getCurrentTrack.bind(this), 1000);
  }

  if (!this.currentStateInterval) {
    this.currentStateInterval = setInterval(this.getCurrentState.bind(this), this.interval);
  }

  setInterval(this.getCurrentArtwork.bind(this), 3000);
};

SpotifyRemoteServer.prototype.stopIntervals = function() {
  clearInterval(this.currentTrackInterval);
  clearInterval(this.currentStateInterval);

  delete this.currentTrackInterval;
  delete this.currentStateInterval;
};

SpotifyRemoteServer.prototype.handleConnection = function(socket) {
  this.sockets.push(socket);
  this.getCurrentTrack();
  this.getCurrentState();
  this.getCurrentArtwork();
  this.startIntervals();

  var self = this;

  ['playPause', 'next', 'previous', 'volumeUp', 'volumeDown'].forEach(function(event) {
    socket.on(event, function() {
      self.spotify[event].call(undefined, self.noop);
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

  if (this.sockets.length === 0) this.stopIntervals();
};

SpotifyRemoteServer.prototype.setVolume = function(volume) {
  this.spotify.setVolume(volume, function() {});
};

SpotifyRemoteServer.prototype.jumpTo = function(second) {
  this.spotify.jumpTo(second, function() {});
};

SpotifyRemoteServer.prototype.getCurrentTrack = function() {
  this.spotify.getTrack(function(err, track) {
    if (!err) this.emitToAllSockets('currentTrack', track);
  }.bind(this));
};

SpotifyRemoteServer.prototype.getCurrentState = function() {
  this.spotify.getState(function(err, state) {
    if (!err) this.emitToAllSockets('currentState', state);
  }.bind(this));
};

SpotifyRemoteServer.prototype.getCurrentArtwork = function() {
  var self = this;

  this.spotify.getArtwork(function(err, artworkPath) {
    // for some weird reason the artwork path applescript likes to return undefined
    // every once in a while, just ignore that and wait for the next turn
    if (err || typeof artworkPath === 'undefined') {
      if (err) console.error(err);
      return;
    }

    fs.readFile(artworkPath, function(err, artwork) {
      if (err) {
        console.error(err);
        return;
      }

      self.emitToAllSockets('currentArtwork', artwork.toString('base64'));
    });
  });
};

SpotifyRemoteServer.prototype.emitToAllSockets = function(name, data) {
  this.sockets.forEach(function(socket) {
    socket.emit(name, data);
  });
};
