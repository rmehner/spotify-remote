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
var server;

describe('SpotifyRemoteServer', function() {
  beforeEach(function() {
    fs.readFile = function(path, cb) {
      cb(null, artworkBuffer);
    };

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

  afterEach(function() {
    server.stopPolling();
    fs.readFile = originalReadFile;
  });

  describe('#handleConnection', function() {
    it('sends the current track to the client', function() {
      var track = {artist: 'Led Zeppelin'};
      spotify.getTrack.callsArgWith(0, null, track);

      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      assert(emitSpy.calledWith('currentTrack', track));
    });

    it('sends the current state to the client', function() {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      assert(emitSpy.calledWith('currentState', state));
    });

    it('pushes the current state to the client every X ms', function(done) {
      var state = {volume: 100};
      spotify.getState.callsArgWith(0, null, state);

      server = new SpotifyRemoteServer(io, spotify, {interval: 10});
      server.handleConnection(socket);

      setTimeout(function() {
        assert.equal(emitSpy.withArgs('currentState', state).callCount, 3);
        done();
      }, 25);
    });

    it('sends artwork of the track to the client', function() {
      var artwork = '/path/to/artwork';
      spotify.getArtwork.callsArgWith(0, null, artwork);

      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      assert(emitSpy.calledWith('currentArtwork', artworkBuffer.toString('base64')));
    });

    it('sends the current state on the sockets "volumeUp" event', function(done) {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalVolumeUp = spotify.volumeUp;
      spotify.volumeUp = function(cb) { cb.call(server); }

      socket.trigger('volumeUp');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);

        spotify.volumeUp = originalVolumeUp;
        done();
      });
    });

    it('sends the current state on the sockets "volumeDown" event', function(done) {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalVolumeDown = spotify.volumeDown;
      spotify.volumeDown = function(cb) { cb.call(server); }

      socket.trigger('volumeDown');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);

        spotify.volumeDown = originalVolumeDown;
        done();
      });
    });

    it('sends the current state and track on the sockets "next" event', function(done) {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      var track = {artist: 'Led Zeppelin'};
      spotify.getTrack.callsArgWith(0, null, track);

      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalNext = spotify.next;
      spotify.next = function(cb) { cb.call(server); }

      socket.trigger('next');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);
        assert.equal(emitSpy.withArgs('currentTrack').callCount, 2);

        spotify.next = originalNext;
        done();
      });
    });

    it('sends the current state and track on the sockets "previous" event', function(done) {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      var track = {artist: 'Led Zeppelin'};
      spotify.getTrack.callsArgWith(0, null, track);

      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalPrevious = spotify.previous;
      spotify.previous = function(cb) { cb.call(server); }

      socket.trigger('previous');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);
        assert.equal(emitSpy.withArgs('currentTrack').callCount, 2);

        spotify.previous = originalPrevious;
        done()
      });
    });

    it('sends the current state and track on the sockets "playPause" event', function(done) {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      var track = {artist: 'Led Zeppelin'};
      spotify.getTrack.callsArgWith(0, null, track);

      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalPlayPause = spotify.playPause;
      spotify.playPause = function(cb) { cb.call(server); }

      socket.trigger('playPause');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);
        assert.equal(emitSpy.withArgs('currentTrack').callCount, 2);

        spotify.playPause = originalPlayPause;
        done();
      });
    });
  });

  describe('#getCurrentArtwork', function() {
    var clock;

    beforeEach(function() {
      clock = sinon.useFakeTimers();
    });

    afterEach(function() {
      clock.restore();
    });

    it('retries to get the artwork if it failed', function() {
      spotify.getArtwork.callsArgWith(0, true);

      server = new SpotifyRemoteServer(io, spotify);
      server.getCurrentArtwork();

      clock.tick(251);

      assert.equal(spotify.getArtwork.callCount, 2);
    });

    it('retries to get the artwork if the path is undefined', function() {
      spotify.getArtwork.callsArgWith(0, null, undefined);

      server = new SpotifyRemoteServer(io, spotify);
      server.getCurrentArtwork();

      clock.tick(251);

      assert.equal(spotify.getArtwork.callCount, 2);
    });

    it('retries to get the artwork if it cannot read the path', function() {
      fs.readFile = function(path, cb) {
        cb(true);
      };

      spotify.getArtwork.callsArgWith(0, null, '/path/to/artwork');

      server = new SpotifyRemoteServer(io, spotify);
      server.getCurrentArtwork();

      clock.tick(251);

      assert.equal(spotify.getArtwork.callCount, 2);
    });
  });

  describe('#getCurrentTrack', function() {
    var clock;

    beforeEach(function() {
      clock = sinon.useFakeTimers();
    });

    afterEach(function() {
      clock.restore();
    });

    it('retries to get the track from spotify if it failed', function() {
      spotify.getTrack.callsArgWith(0, true);

      server = new SpotifyRemoteServer(io, spotify);
      server.getCurrentTrack();

      clock.tick(251);

      assert.equal(spotify.getTrack.callCount, 2);
    });
  });

  describe('#handleDisconnect', function() {
    it('stops polling spotify when there is no connection', function(done) {
      server = new SpotifyRemoteServer(io, spotify, {interval: 0});
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
      server = new SpotifyRemoteServer(io, spotify);
      spotify.getState.callsArgWith(0, null, {});

      server.handleConnection(socket);
      server.handleDisconnect(socket);

      emitSpy.reset();

      server.handleConnection({emit: function() {}, on: function(){}});

      assert(emitSpy.notCalled);
    });
  });

  describe('#retry', function() {
    var clock;

    beforeEach(function() {
      clock = sinon.useFakeTimers();
    });

    afterEach(function() {
      clock.restore();
    });

    it('automatically retries the given function after X ms', function() {
      server = new SpotifyRemoteServer(io, spotify);
      var fn = sinon.spy();

      server.retry(fn, 10);

      clock.tick(11);

      assert(fn.called);
    });

    it('does not retry the same function more than 5 times within 10 seconds', function() {
      server = new SpotifyRemoteServer(io, spotify);
      var fn = sinon.spy();

      for(var i = 0; i < 6; i++) {
        server.retry(fn, 10);
      }

      clock.tick(100);

      assert.equal(fn.callCount, 5);
    });

    it('retries the same function more again after 10 seconds', function() {
      server = new SpotifyRemoteServer(io, spotify);
      var fn = sinon.spy();

      for(var i = 0; i < 6; i++) {
        server.retry(fn, 10);
      }

      // trigger reset of block
      clock.tick(11000);

      server.retry(fn, 10);

      clock.tick(11);

      assert.equal(fn.callCount, 6);
    });
  });
});
