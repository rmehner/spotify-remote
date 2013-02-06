var assert               = require('assert');
var sinon                = require('sinon');
var fs                   = require('fs');
var SpotifyRemoteServer  = require('../lib/spotify_remote_server');

var originalReadFile = fs.readFile;
var artworkBuffer    = new Buffer('artwork');
var emitSpy          = sinon.spy();
var io               = {sockets: {on: function(){}}};
var socket = {
  emit: emitSpy,
  events: {},
  on: function(event, cb) {
    this.events[event] = cb;
  },
  trigger: function(event) {
    this.events[event]();
  }
};
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
    socket.events = {};
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
      server.stopIntervals();
    });

    it('sends the current state to the client', function() {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      var server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      assert(emitSpy.calledWith('currentState', state));
      server.stopIntervals();
    });

    it('pushes the current state to the client every X ms', function(done) {
      var state = {volume: 100};
      spotify.getState.callsArgWith(0, null, state);

      var server = new SpotifyRemoteServer(io, spotify, {interval: 10});
      server.handleConnection(socket);

      setTimeout(function() {
        assert.equal(emitSpy.withArgs('currentState', state).callCount, 3);
        server.stopIntervals();
        done();
      }, 25);
    });

    it('sends artwork of the track to the client', function() {
      var artwork = '/path/to/artwork';
      spotify.getArtwork.callsArgWith(0, null, artwork);

      var server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      assert(emitSpy.calledWith('currentArtwork', artworkBuffer.toString('base64')));
      server.stopIntervals();
    });

    it('sends the current state on the sockets "volumeUp" event', function(done) {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      var server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalVolumeUp = spotify.volumeUp;
      spotify.volumeUp = function(cb) { cb.call(server); }

      socket.trigger('volumeUp');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);

        spotify.volumeUp = originalVolumeUp;
        server.stopIntervals();
        done();
      });
    });

    it('sends the current state on the sockets "volumeDown" event', function(done) {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      var server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalVolumeDown = spotify.volumeDown;
      spotify.volumeDown = function(cb) { cb.call(server); }

      socket.trigger('volumeDown');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);

        spotify.volumeDown = originalVolumeDown;
        server.stopIntervals();
        done();
      });
    });

    it('sends the current state and track on the sockets "next" event', function(done) {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      var track = {artist: 'Led Zeppelin'};
      spotify.getTrack.callsArgWith(0, null, track);

      var server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalNext = spotify.next;
      spotify.next = function(cb) { cb.call(server); }

      socket.trigger('next');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);
        assert.equal(emitSpy.withArgs('currentTrack').callCount, 2);

        spotify.next = originalNext;
        server.stopIntervals();
        done();
      });
    });

    it('sends the current state and track on the sockets "previous" event', function(done) {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      var track = {artist: 'Led Zeppelin'};
      spotify.getTrack.callsArgWith(0, null, track);

      var server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalPrevious = spotify.previous;
      spotify.previous = function(cb) { cb.call(server); }

      socket.trigger('previous');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);
        assert.equal(emitSpy.withArgs('currentTrack').callCount, 2);

        spotify.previous = originalPrevious;
        server.stopIntervals();
        done()
      });
    });

    it('sends the current state and track on the sockets "playPause" event', function(done) {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      var track = {artist: 'Led Zeppelin'};
      spotify.getTrack.callsArgWith(0, null, track);

      var server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalPlayPause = spotify.playPause;
      spotify.playPause = function(cb) { cb.call(server); }

      socket.trigger('playPause');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);
        assert.equal(emitSpy.withArgs('currentTrack').callCount, 2);

        spotify.playPause = originalPlayPause;
        server.stopIntervals();
        done();
      });
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

        server.stopIntervals();
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

      server.stopIntervals();
    });
  });
});
