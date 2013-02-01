var assert               = require('assert');
var sinon                = require('sinon');
var fs                   = require('fs');
var SpotifyRemoteServer  = require('../lib/spotify_remote_server');

var originalReadFile = fs.readFile;
var artworkBuffer    = new Buffer('artwork');
var emitSpy          = sinon.spy();
var io               = {sockets: {on: function(){}}};
var socket           = {emit: emitSpy, on: function(){}};
var spotify;

describe('SpotifyRemoteServer', function() {
  before(function() {
    fs.readFile = function(path, cb) {
      cb(null, artworkBuffer);
    };
  });

  beforeEach(function() {
    // that's the minimal spotify interface we use
    spotify = sinon.stub({
      getTrack: function() {},
      getArtwork: function() {},
      getState: function() {},
      playPause: function() {},
      next: function() {},
      previous: function() {},
      volumeUp: function() {},
      volumeDown: function() {}
    });
    emitSpy.reset();
  });

  after(function() {
    fs.readFile = originalReadFile;
  });

  describe('#handleConnection', function() {
    it('sends the current track to the client', function() {
      var track = {artist: 'Led Zeppelin'};
      spotify.getTrack.callsArgWith(0, null, track);

      var server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      assert(emitSpy.calledWith('currentTrack', track));
    });

    it('sends the current state to the client', function() {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      var server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      assert(emitSpy.calledWith('currentState', state));
    });

    it('pushes the current state to the client every X ms', function(done) {
      var state = {volume: 100};
      spotify.getState.callsArgWith(0, null, state);

      var server = new SpotifyRemoteServer(io, spotify, {interval: 10});
      server.handleConnection(socket);

      setTimeout(function() {
        assert.equal(emitSpy.withArgs('currentState', state).callCount, 3);
        done();
      }, 25);
    });

    it('sends artwork of the track to the client', function() {
      var artwork = '/path/to/artwork';
      spotify.getArtwork.callsArgWith(0, null, artwork);

      var server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      assert(emitSpy.calledWith('currentArtwork', artworkBuffer.toString('base64')));
    });
  });

  describe('#getCurrentTrack', function() {
    it('does not emit the track to the client if it has not changed since last time', function() {
      
    });
  });

  describe('#handleDisconnect', function() {
    it('stops polling spotify when there is no connection', function(done) {
      var server = new SpotifyRemoteServer(io, spotify, {interval: 0});
      server.handleConnection(socket);

      assert(spotify.getState.called);

      server.handleDisconnect(socket);
      spotify.getState.reset();

      setTimeout(function() {
        assert(!spotify.getState.called);
        done();
      }, 15);
    });

    it('does not send to disconnected sockets', function() {
      var server = new SpotifyRemoteServer(io, spotify);
      spotify.getState.callsArgWith(0, null, {});

      server.handleConnection(socket);
      server.handleDisconnect(socket);

      emitSpy.reset();

      server.handleConnection({emit: function() {}, on: function(){}});

      assert(emitSpy.notCalled);
    });
  });
});
