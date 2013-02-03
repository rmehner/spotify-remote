#!/usr/bin/env node

var express             = require('express');
var app                 = express();
var server              = require('http').createServer(app);
var io                  = require('socket.io').listen(server);
var spotify             = require('spotify-node-applescript');
var SpotifyRemoteServer = require('./lib/spotify_remote_server');

io.enable('browser client minification');
io.enable('browser client etag');
io.enable('browser client gzip');
io.set('log level', 0);

app.configure(function() {
  app.set('port', process.env.PORT || 3333);
  app.use(express.favicon());
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res) {
  res.sendfile(__dirname + '/public/index.html');
});

server.listen(app.get('port'), function() {
  console.log('Your spotify remote is awaiting commands on: http://localhost:' + app.get('port'));
});

new SpotifyRemoteServer(io, spotify);
