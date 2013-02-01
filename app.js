var express             = require('express');
var http                = require('http');
var path                = require('path');
var app                 = require('express')();
var server              = require('http').createServer(app);
var io                  = require('socket.io').listen(server);
var spotify             = require('spotify-node-applescript');
var SpotifyRemoteServer = require('./lib/spotify_remote_server');

io.enable('browser client minification');
io.enable('browser client etag');
io.enable('browser client gzip');
io.set('log level', 1);

app.configure(function() {
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function() {
  app.use(express.errorHandler());
});

app.get('/', function(req, res) {
  res.render('index', {title: 'Spotify-Remote'});
});

server.listen(app.get('port'), function() {
  console.log("Express server listening on port " + app.get('port'));
});

new SpotifyRemoteServer(io, spotify);
