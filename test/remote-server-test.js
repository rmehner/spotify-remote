"use strict";

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
var clock;

describe('SpotifyRemoteServer', function() {
  beforeEach(function() {
    fs.readFile = function(path, cb) {
      cb(null, artworkBuffer);
    };

    clock = sinon.useFakeTimers();

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
    clock.restore();
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

    it('pushes the current state to the client every 500 ms', function() {
      var state = {volume: 100};
      spotify.getState.callsArgWith(0, null, state);

      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      // enough time for two more ticks
      clock.tick(1001);

      assert.equal(emitSpy.withArgs('currentState', state).callCount, 3);
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
      spotify.volumeUp = function(cb) { cb.call(server); };

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
      spotify.volumeDown = function(cb) { cb.call(server); };

      socket.trigger('volumeDown');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);

        spotify.volumeDown = originalVolumeDown;
        done();
      });
    });

    it('sends the current state with mute state on the sockets "muteUnmute" event', function() {
      var state = {volume: 0, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalMuteVolume   = spotify.muteVolume;
      var originalUnmuteVolume = spotify.unmuteVolume;
      spotify.muteVolume = function(cb) { cb.call(server); };
      spotify.unmuteVolume = function(cb) { cb.call(server); };

      socket.trigger('muteUnmute');

      assert(emitSpy.lastCall.args[1].muted);

      socket.trigger('muteUnmute');

      assert(!emitSpy.lastCall.args[1].muted);

      assert.equal(emitSpy.withArgs('currentState').callCount, 3);

      spotify.muteVolume = originalMuteVolume;
      spotify.unmuteVolume = originalUnmuteVolume;
    });

    it('sends the current state and track on the sockets "next" event', function(done) {
      var state = {volume: 100, position: 13.37, state: 'paused'};
      spotify.getState.callsArgWith(0, null, state);

      var track = {artist: 'Led Zeppelin'};
      spotify.getTrack.callsArgWith(0, null, track);

      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      var originalNext = spotify.next;
      spotify.next = function(cb) { cb.call(server); };

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
      spotify.previous = function(cb) { cb.call(server); };

      socket.trigger('previous');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);
        assert.equal(emitSpy.withArgs('currentTrack').callCount, 2);

        spotify.previous = originalPrevious;
        done();
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
      spotify.playPause = function(cb) { cb.call(server); };

      socket.trigger('playPause');

      process.nextTick(function() {
        assert.equal(emitSpy.withArgs('currentState').callCount, 2);
        assert.equal(emitSpy.withArgs('currentTrack').callCount, 2);

        spotify.playPause = originalPlayPause;
        done();
      });
    });
  });

  describe('#getCurrentState', function() {
    it('only gets the track once when it has not changed', function() {
      var state = {track_id: 'spotify:track:1'};
      spotify.getState.callsArgWith(0, null, state);

      var track = {id: 'spotify:track:1'};
      spotify.getTrack.callsArgWith(0, null, track);

      server = new SpotifyRemoteServer(io, spotify);
      server.getCurrentState();
      server.getCurrentState();

      assert.equal(spotify.getTrack.callCount, 1);
    });

    it('gets the track information when the track has changed', function() {
      var calls = 0;

      spotify.getState = function(cb) {
        cb(null, {track_id: 'spotify:track:' + calls++});
      };

      var track = {id: 'spotify:track:0'};
      spotify.getTrack.callsArgWith(0, null, track);

      server = new SpotifyRemoteServer(io, spotify);
      server.getCurrentState();
      server.getCurrentState();

      assert.equal(spotify.getTrack.callCount, 2);
    });
  });

  describe('#getCurrentArtwork', function() {
    it('retries to get the artwork if it failed', function() {
      spotify.getArtwork.callsArgWith(0, 'testerror');

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
        cb('testerror');
      };

      spotify.getArtwork.callsArgWith(0, null, '/path/to/artwork');

      server = new SpotifyRemoteServer(io, spotify);
      server.getCurrentArtwork();

      clock.tick(251);

      assert.equal(spotify.getArtwork.callCount, 2);
    });
  });

  describe('#getCurrentTrack', function() {
    it('retries to get the track from spotify if it failed', function() {
      spotify.getTrack.callsArgWith(0, true);

      server = new SpotifyRemoteServer(io, spotify);
      server.getCurrentTrack();

      clock.tick(251);

      assert.equal(spotify.getTrack.callCount, 2);
    });
  });

  describe('#handleDisconnect', function() {
    it('stops polling spotify when there is no connection', function() {
      server = new SpotifyRemoteServer(io, spotify);
      server.handleConnection(socket);

      assert(spotify.getState.called);

      server.handleDisconnect(socket);
      spotify.getState.reset();

      clock.tick(501);

      assert(!spotify.getState.called);
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
