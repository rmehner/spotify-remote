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
    this.io = io;

    this.connect();
    this.bindDOMEvents();
    this.bindVisibilityEvents();
  };

  SpotifyRemoteClient.prototype.connect = function() {
    if (this.socket && this.socket.socket.connected) return;

    if (!this.socket) {
      this.socket = this.io.connect(this.host);
    } else {
      this.socket.socket.connect(); // reuse previous socket and simply reconnect
    }

    this.socket.on('currentTrack', this.showCurrentTrack.bind(this));
    this.socket.on('currentState', this.showCurrentState.bind(this));
    this.socket.on('currentArtwork', this.showCurrentArtwork.bind(this));
  };

  SpotifyRemoteClient.prototype.disconnect = function() {
    this.socket.disconnect();
    this.socket.removeAllListeners();
  };

  SpotifyRemoteClient.prototype.bindDOMEvents = function() {
    var self = this;

    document.addEventListener(this._canTouchThis ? 'touchstart' : 'click', function(event) {
      var command = {
        'previous': 'previous',
        'next': 'next',
        'current-play-state': 'playPause'
      }[event.target.id];

      if (!command) return;

      self.emit(command);
      event.preventDefault();
    });

    document.addEventListener('keyup', function(event) {
      var command = {
        32: 'playPause',   // space
        78: 'next',        // n
        80: 'previous',    // p
        107: 'volumeUp',   // + on numpad
        109: 'volumeDown', // - on numpad
        187: 'volumeUp',   // +
        189: 'volumeDown'  // -
      }[event.keyCode];

      if (command) self.emit(command);
    });

    // volume control
    this.$('current-volume').addEventListener('change', function(event) {
      self.emit('setVolume', event.target.value);
    });

    this.$('current-volume').addEventListener(this._canTouchThis ? 'touchstart' : 'mousedown', function() {
      self._volumeRangeBlocked = true;
    });

    this.$('current-volume').addEventListener(this._canTouchThis ? 'touchend' : 'mouseup', function() {
      self._volumeRangeBlocked = false;
    });

    // position control
    this.$('position').addEventListener(this._canTouchThis ? 'touchstart' : 'mousedown', function() {
      self._positionRangeBlocked = true;
    });

    this.$('position').addEventListener(this._canTouchThis ? 'touchend' : 'mouseup', function(event) {
      self.emit('jumpTo', event.target.value);
      self._positionRangeBlocked = false;
    });

    this.$('new-search').addEventListener('submit', function(event) {
      event.preventDefault();
      var $searchInput = self.$('search-term');
      var searchTerm   = $searchInput.value;

      $searchInput.blur();

      if (searchTerm === '') return;

      self.getAndDisplaySearchResults('tracks', searchTerm);
      self.getAndDisplaySearchResults('albums', searchTerm);
      self.getAndDisplaySearchResults('artists', searchTerm);
    });

    document.addEventListener('click', function(event) {
      var handler = {
        'tracks': self.handleTracksResultClick,
        'albums': self.handleAlbumsResultClick,
        'artists': self.handleArtistsResultClick
      }[event.target.dataset.resulttype];

      if (!handler) return;

      event.preventDefault();
      handler.call(self, event.target);
    });

    document.addEventListener(this._canTouchThis ? 'touchstart' : 'click', function(event) {
      var showPage = {
        'search': self.showSearchPage,
        'remote': self.showRemotePage,
        'artist-detail': self.showArtistDetailPage
      }[event.target.dataset.showPage];

      if (!showPage) return;

      event.preventDefault();

      if (event.target.dataset.deleteLastVisited === '') delete self.lastVisitedPage;
      showPage.call(self);
    });

    document.addEventListener('click', function(event) {
      if (event.target.className !== 'show-more') return;
      event.preventDefault();

      self.showMoreResults(event.target.rel);
    });
  };

  SpotifyRemoteClient.prototype.showMoreResults = function(resultsId) {
    var $results        = document.getElementById(resultsId);
    var $showMoreButton = $results.querySelectorAll('.show-more')[0];
    var visibleResults  = 0;

    Array.prototype.forEach.call($results.children, function($result, index) {
      if ($result.className.match(/-search-result/)) {
        if ($result.style.display === 'block') {
          visibleResults++;
        } else if (index <= (visibleResults + 3)) {
          $result.style.display = 'block';
        }

        if ($results.children.length === visibleResults + 3) $showMoreButton.style.display = 'none';
      }
    });
  };

  SpotifyRemoteClient.prototype.showSearchPage = function() {
    this.showPage(this.lastVisitedPage || 'search', {savePage: true});
  };

  SpotifyRemoteClient.prototype.showRemotePage = function() {
    this.showPage('remote', {savePage: false});
  };

  SpotifyRemoteClient.prototype.showArtistDetailPage = function() {
    this.showPage('artist-detail', {savePage: true});
  };

  SpotifyRemoteClient.prototype.showPage = function(pageId, options) {
    var pages = document.getElementsByClassName('page');

    if (options && options.savePage) this.lastVisitedPage = pageId;

    Array.prototype.forEach.call(pages, function(page) {
      page.style.display = page.id === pageId ? 'block' : 'none';
    }.bind(this));
  };

  SpotifyRemoteClient.prototype.handleTracksResultClick = function(target) {
    this.socket.emit('playTrack', target.dataset.spotifyurl);
    this.showRemotePage();
  };

  SpotifyRemoteClient.prototype.handleAlbumsResultClick = function(target) {
    var spotifyUrl = target.dataset.spotifyurl;
    var lookupUrl  = 'http://ws.spotify.com/lookup/1/.json?uri=' + spotifyUrl + '&extras=track';
    var xhr        = new XMLHttpRequest();

    xhr.open('GET', lookupUrl, true)
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            var parsedResponse = JSON.parse(xhr.responseText);
          } catch(e) {
            this.displayAlbumDetailError('Woah, something went wrong!');
            return;
          }
          this.displayAlbumDetails(parsedResponse);
        } else {
          this.displayAlbumDetailError('Woah, something went wrong!');
        }
      }
    }.bind(this);

    xhr.send()
  };

  SpotifyRemoteClient.prototype.handleArtistsResultClick = function(target) {
    var spotifyUrl = target.dataset.spotifyurl;
    var lookupUrl  = 'http://ws.spotify.com/lookup/1/.json?uri=' + spotifyUrl + '&extras=album';
    var xhr        = new XMLHttpRequest();

    xhr.open('GET', lookupUrl, true)
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            var parsedResponse = JSON.parse(xhr.responseText);
          } catch(e) {
            this.displayArtistDetailError('Woah, something went wrong!');
            return;
          }
          this.displayArtistDetails(parsedResponse);
        } else {
          this.displayArtistDetailError('Woah, something went wrong!');
        }
      }
    }.bind(this);

    xhr.send()
  };

  SpotifyRemoteClient.prototype.getAndDisplaySearchResults = function(type, term) {
    var xhr = new XMLHttpRequest();
    var searchUrl = {
      albums: 'http://ws.spotify.com/search/1/album.json?q=' + term,
      artists: 'http://ws.spotify.com/search/1/artist.json?q=' + term,
      tracks: 'http://ws.spotify.com/search/1/track.json?q=' + term
    }[type];

    xhr.open('GET', searchUrl, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            var parsedResponse = JSON.parse(xhr.responseText);
          } catch(e) {
            this.displaySearchError(type, 'Woah, something went wrong!');
            return;
          }
          this.displaySearchResults(type, parsedResponse);
        } else {
          this.displaySearchError(type, 'Woah, something went wrong!');
        }
      }
    }.bind(this);

    xhr.send()
  };

  SpotifyRemoteClient.prototype.displayAlbumDetails = function(albumDetails) {
    var albumDetailName    = albumDetails.album.artist + ' - ' + albumDetails.album.name;
    var $albumDetailParent = document.getElementById('album-detail');
    var $oldTracks         = document.getElementById('album-detail-tracks');
    var $newTracks         = document.createElement('div');
    $newTracks.id          = 'album-detail-tracks';
    var $albumDetail       = document.getElementById('album-detail-album');

    this.createSearchResultElements('tracks', albumDetails.album.tracks, function(elements) {
      elements.map(function(el) {
        el.style.display = 'block';
        $newTracks.appendChild(el);
      });

      $oldTracks.parentNode.replaceChild($newTracks, $oldTracks);
      $albumDetail.textContent = albumDetailName;

      if (this.lastVisitedPage === 'artist-detail') {
        var $backButton = $albumDetailParent.querySelectorAll('.go-back')[0];

        $backButton.textContent = 'Back';
        $backButton.dataset.showPage = 'artist-detail';
        $backButton.dataset.deleteLastVisited = undefined;
      }

      this.showPage('album-detail', {savePage: true});
    }.bind(this));
  };

  SpotifyRemoteClient.prototype.displayAlbumDetailError = function(error) {
    var $albumDetail         = document.getElementById('album-detail-album');
    $albumDetail.textContent = error;

    var $albumTracks         = document.getElementById('album-detail-tracks');
    $albumTracks.textContent = '';

    this.showPage('album-detail', {savePage: true});
  };

  SpotifyRemoteClient.prototype.displayArtistDetails = function(artistDetails) {
    var $artistDetail = document.getElementById('artist-detail-artist');
    var $oldAlbums    = document.getElementById('artist-detail-albums');
    var $newAlbums    = document.createElement('div');
    $newAlbums.id     = 'artist-detail-albums';

    this.createArtistDetailAlbumResults(artistDetails.artist.albums, function(elements) {
      elements.map(function(el) {
        el.style.display = 'block';
        $newAlbums.appendChild(el);
      });

      $oldAlbums.parentNode.replaceChild($newAlbums, $oldAlbums);
      $artistDetail.textContent = artistDetails.artist.name;

      this.showPage('artist-detail', {savePage: true});
    }.bind(this));
  };

  SpotifyRemoteClient.prototype.displayArtistDetailError = function(error) {
    var $artistAlbums         = document.getElementById('artist-detail-albums');
    $artistAlbums.textContent = error;
    this.showPage('artist-detail', {savePage: true});
  };

  SpotifyRemoteClient.prototype.displaySearchResults = function(type, result) {
    var results           = result[type];
    var searchResultsId   = type + '-search-results';
    var $oldSearchResults = document.getElementById(searchResultsId);
    var $newSearchResults = document.createElement('div');
    $newSearchResults.id  = searchResultsId;

    this.createSearchResultElements(type, results, function(elements) {
      if (elements.length) {
        elements.map(function(el, index) {
          if (index <= 2) el.style.display = 'block';
          $newSearchResults.appendChild(el);
        });

        if (elements.length >= 3) {
          var $showMore         = document.createElement('a');
          $showMore.className   = 'show-more';
          $showMore.href        = '#';
          $showMore.textContent = 'Show more';
          $showMore.rel         = searchResultsId;
          $newSearchResults.appendChild($showMore);
        }
      } else {
        $newSearchResults.appendChild(this.createNoSearchResultElement());
      }

      $oldSearchResults.parentNode.replaceChild($newSearchResults, $oldSearchResults);
    }.bind(this));
  };

  SpotifyRemoteClient.prototype.displaySearchError = function(type, errorMsg) {
    var $searchResults         = document.getElementById(type + '-search-results');
    $searchResults.textContent = errorMsg;
  };

  SpotifyRemoteClient.prototype.createNoSearchResultElement = function() {
    var el       = document.createElement('div');
    el.className = 'no-search-result';
    el.innerHTML = 'Woah! No search results!';
    return el;
  };

  SpotifyRemoteClient.prototype.createSearchResultElements = function(type, results, cb) {
    var elementCreator = {
      'tracks': this.createTrackSearchResultElement,
      'albums': this.createAlbumSearchResultElement,
      'artists': this.createArtistSearchResultElement
    }[type];

    cb(results.map(elementCreator));
  };

  SpotifyRemoteClient.prototype.createAlbumSearchResultElement = function(result) {
    var el                = document.createElement('a');
    el.href               = '#';
    el.className          = 'albums-search-result';
    el.style.display      = 'none';
    el.innerHTML          = result.artists[0].name + ' - ' + result.name;
    el.dataset.spotifyurl = result.href;
    el.dataset.resulttype = 'albums';

    return el;
  };

  SpotifyRemoteClient.prototype.createArtistDetailAlbumResults = function(results, cb) {
    var elements = results.map(function(result) {
      var el                = document.createElement('a');
      el.href               = '#';
      el.className          = 'albums-search-result';
      el.innerHTML          = result.album.artist + ' - ' + result.album.name;
      el.dataset.spotifyurl = result.album.href;
      el.dataset.resulttype = 'albums';

      return el;
    });

    return cb(elements);
  };

  SpotifyRemoteClient.prototype.createTrackSearchResultElement = function(result) {
    var el                = document.createElement('a');
    el.href               = '#';
    el.className          = 'tracks-search-result';
    el.innerHTML          = result.artists[0].name + ' - ' + result.name;
    el.style.display      = 'none';
    el.dataset.spotifyurl = result.href;
    el.dataset.resulttype = 'tracks';

    return el;
  };

  SpotifyRemoteClient.prototype.createArtistSearchResultElement = function(result) {
    var el                = document.createElement('a');
    el.href               = '#';
    el.className          = 'artists-search-result';
    el.innerHTML          = result.name;
    el.style.display      = 'none';
    el.dataset.spotifyurl = result.href;
    el.dataset.resulttype = 'artists';

    return el;
  };

  SpotifyRemoteClient.prototype.bindVisibilityEvents = function() {
    var self                 = this;
    var bindVisibilityChange = function(eventName, propertyName) {
      document.addEventListener(eventName, function() {
        document[propertyName] ? self.disconnect() : self.connect();
      });
    };

    if (typeof document.hidden !== 'undefined') {
      return bindVisibilityChange('visibilitychange', 'hidden');
    } else if (typeof document.webkitHidden !== 'undefined') {
      return bindVisibilityChange('webkitvisibilitychange', 'webkitHidden');
    } else if (typeof document.msHidden !== 'undefined') {
      return bindVisibilityChange('msvisibilitychange', 'msHidden');
    }

    if (typeof window.onpagehide !== 'undefined') {
      window.addEventListener('pagehide', this.disconnect.bind(this));
      window.addEventListener('pageshow', this.connect.bind(this));
    }
  };

  SpotifyRemoteClient.prototype.showCurrentTrack = function(track) {
    // don't rerender stuff when nothing has changed
    if (this.currentTrack && this.currentTrack.id === track.id) return;

    this.$('artist').textContent   = track.artist;
    this.$('name').textContent     = track.name;
    this.$('duration').textContent = this.formatTime(track.duration);
    this.$('position').setAttribute('max', track.duration);

    this.currentTrack = track;
  };

  SpotifyRemoteClient.prototype.showCurrentState = function(state) {
    if (!this.currentState || this.currentState.position !== state.position) {
      this.$('played-time').textContent = this.formatTime(state.position);

      if (!this._positionRangeBlocked) this.$('position').value = state.position;
    }

    if (!this.currentState || this.currentState.state !== state.state) {
      this.$('current-play-state').textContent = state.state === 'paused' ? 'Play' : 'Pause';
    }

    if (!this._volumeRangeBlocked && (!this.currentState || this.currentState.volume !== state.volume)) {
      this.$('current-volume').value = state.volume;
    }

    this.currentState = state;
  };

  SpotifyRemoteClient.prototype.showCurrentArtwork = function(artwork) {
    this.$('artwork').src = 'data:image/png;base64,' + artwork;
  };

  SpotifyRemoteClient.prototype.emit = function(event, data) {
    if (this.socket) this.socket.emit(event, data);
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

  new SpotifyRemoteClient().init(io);
})();
