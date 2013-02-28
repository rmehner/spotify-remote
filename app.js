#!/usr/bin/env node

'use strict';

var app                 = require('http').createServer(handleRequest);
var io                  = require('socket.io').listen(app);
var fs                  = require('fs');
var spotify             = require('spotify-node-applescript');
var SpotifyRemoteServer = require('./lib/spotify_remote_server');

io.enable('browser client minification');
io.enable('browser client etag');
io.enable('browser client gzip');
io.set('log level', 0);

var mimeTypes = {
  'css': 'text/css',
  'html': 'text/html;charset=UTF-8',
  'ico': 'image/x-icon',
  'js': 'text/javascript',
  'png': 'image/png'
};

function handleRequest(req, res) {
  var fileName = req.url === '/' ? 'index.html' : req.url.split('/').splice(-1)[0];
  var filePath = __dirname + '/public/' + fileName;

  fs.exists(filePath, function(exists) {
    if (!exists) {
      res.writeHead(404);
      res.end("404 Not Found\n");
    } else {
      var extension = filePath.split('.').splice(-1)[0];

      res.writeHead(200, {'Content-Type': mimeTypes[extension]});
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

app.on('listening', function() {
  console.log('Your spotify remote is awaiting commands on: http://localhost:' + app.address().port);
  console.log('CTRL+C to quit.');

  new SpotifyRemoteServer(io, spotify);
});

app.on('error', function(err) {
  console.log('ERROR: ' + err.message);
  console.log('Shutting down...');
  process.exit(1);
});

spotify.isRunning(function(err, isRunning) {
  if (err || !isRunning) {
    console.log('Could not launch spotify-remote. Please make sure Spotify is running.');
    return process.exit(1);
  }

  app.listen(process.env.PORT || 3333);
});
