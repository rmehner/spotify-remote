(function() {
  "use strict";

  var SpotifyRemoteClient = function(host) {
    this.host                  = host || window.location.hostname;
    this.elements              = [];
    this.numberOfSearchResults = 3;
    this._canTouchThis         = 'ontouchstart' in window || 'createTouch' in document;
    this._volumeRangeBlocked   = false;
    this._positionRangeBlocked = false;
    this._sendPosition         = false;
    this._rememberedPosition   = 0;
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
      if (event.target.tagName === 'INPUT') return;

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

    this.$('mute-unmute').addEventListener(this._canTouchThis ? 'touchstart' : 'click', function() {
      self.emit('muteUnmute');
    });

    // position control
    this.$('position').addEventListener(this._canTouchThis ? 'touchstart' : 'mousedown', function() {
      clearInterval(self._positionInterval);
      self._positionRangeBlocked = true;
    });

    this.$('position').addEventListener(this._canTouchThis ? 'touchend' : 'mouseup', function() {
      self._sendPosition = true;
    });

    this.$('position').addEventListener('change', function(event) {
      clearInterval(self._positionInterval);
      self._rememberedPosition = event.target.value;

      self._positionInterval = setInterval(function() {
        if (self._sendPosition) {
          self.emit('jumpTo', self._rememberedPosition);
          self._positionRangeBlocked = false;
          self._sendPosition         = false;
          clearInterval(self._positionInterval);
        }
      }, 100);
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

    if (!this._volumeRangeBlocked && (!this.currentState || (this.currentState.muted !== state.muted || this.currentState.volume !== state.volume))) {
      this.$('current-volume').value = state.volume;

      if (state.muted) {
        this.$('mute-unmute').src = 'mute-icon.png';
      } else {
        this.$('mute-unmute').src = state.volume === 0 ? 'novolume-icon.png' : 'volume-icon.png';
      }
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

  SpotifyRemoteClient.prototype.forEach = function(obj, iterator, context) {
    Array.prototype.forEach.call(obj, iterator, context);
  };

  SpotifyRemoteClient.prototype.formatTime = function(totalSeconds) {
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;

    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;

    return minutes + ":" + seconds;
  };

  SpotifyRemoteClient.prototype.showMoreResults = function(resultsId) {
    var $results          = document.getElementById(resultsId);
    var $showMoreButton   = $results.querySelector('.show-more');
    var visibleResults    = 0;
    var moreResultsToShow = false;

    this.forEach($results.children, function($result, index) {
      // skip when item is not a search result or we are already done and can return early
      if (!$result.dataset.resulttype || moreResultsToShow) return;

      if ($result.style.display === 'block') {
        visibleResults++;
      } else if (index < (visibleResults + this.numberOfSearchResults)) {
        $result.style.display = 'block';
      } else {
        moreResultsToShow = true;
      }
    }, this);

    if (!moreResultsToShow) {
      $showMoreButton.style.display = 'none';
    }
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

    this.forEach(pages, function(page) {
      page.style.display = page.id === pageId ? 'block' : 'none';
    });
  };

  SpotifyRemoteClient.prototype.handleTracksResultClick = function(target) {
    this.socket.emit('playTrack', target.dataset.spotifyurl);
    this.showRemotePage();
  };

  SpotifyRemoteClient.prototype.getFromSpotify = function(url, successHandler, errorHandler) {
    var xhr = new XMLHttpRequest();
    var parsedResponse;

    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            parsedResponse = JSON.parse(xhr.responseText);
            successHandler(parsedResponse);
          } catch(e) {
            errorHandler('Woah! Something went wrong!');
            if (typeof console === 'object') console.error(e);
          }
        } else {
          errorHandler('Woah! Something went wrong!');
        }
      }
    };

    xhr.send();
  };

  SpotifyRemoteClient.prototype.handleAlbumsResultClick = function(target) {
    this.getFromSpotify(
      'http://ws.spotify.com/lookup/1/.json?uri=' + target.dataset.spotifyurl + '&extras=track',
      this.displayAlbumDetails.bind(this),
      this.displayAlbumDetailError.bind(this)
    );
  };

  SpotifyRemoteClient.prototype.handleArtistsResultClick = function(target) {
    this.getFromSpotify(
      'http://ws.spotify.com/lookup/1/.json?uri=' + target.dataset.spotifyurl + '&extras=album',
      this.displayArtistDetails.bind(this),
      this.displayArtistDetailError.bind(this)
    );
  };

  SpotifyRemoteClient.prototype.getAndDisplaySearchResults = function(type, term) {
    var searchUrl = {
      albums: 'http://ws.spotify.com/search/1/album.json?q=' + term,
      artists: 'http://ws.spotify.com/search/1/artist.json?q=' + term,
      tracks: 'http://ws.spotify.com/search/1/track.json?q=' + term
    }[type];

    this.getFromSpotify(
      searchUrl,
      this.displaySearchResults.bind(this, type),
      this.displaySearchError.bind(this, type)
    );
  };

  SpotifyRemoteClient.prototype.displayAlbumDetails = function(albumDetails) {
    var $oldTracks      = document.getElementById('album-detail-tracks');
    var $newTracks      = document.createElement('div');
    $newTracks.id       = 'album-detail-tracks';
    var $albumDetail    = document.getElementById('album-detail-album');

    this.createSearchResultElements('tracks', albumDetails.album.tracks, function(elements) {
      elements.map(function(el) {
        el.style.display = 'block';
        $newTracks.appendChild(el);
      });

      $oldTracks.parentNode.replaceChild($newTracks, $oldTracks);
      $albumDetail.textContent = albumDetails.album.artist + ' - ' + albumDetails.album.name;

      if (this.lastVisitedPage === 'artist-detail') {
        var $backButton                       = document.querySelector('#album-detail .go-back');
        $backButton.dataset.showPage          = 'artist-detail';
        $backButton.dataset.deleteLastVisited = undefined;
      }

      this.showPage('album-detail', {savePage: true});
    }.bind(this));
  };

  SpotifyRemoteClient.prototype.displayAlbumDetailError = function(error) {
    document.getElementById('album-detail-album').textContent  = error;
    document.getElementById('album-detail-tracks').textContent = '';

    this.showPage('album-detail', {savePage: true});
  };

  SpotifyRemoteClient.prototype.displayArtistDetails = function(artistDetails) {
    var $oldAlbums = document.getElementById('artist-detail-albums');
    var $newAlbums = document.createElement('div');
    $newAlbums.id  = 'artist-detail-albums';

    this.createArtistDetailAlbumResults(artistDetails.artist.albums, function(elements) {
      elements.map(function(el) {
        el.style.display = 'block';
        $newAlbums.appendChild(el);
      });

      $oldAlbums.parentNode.replaceChild($newAlbums, $oldAlbums);
      document.getElementById('artist-detail-artist').textContent = artistDetails.artist.name;

      this.showPage('artist-detail', {savePage: true});
    }.bind(this));
  };

  SpotifyRemoteClient.prototype.displayArtistDetailError = function(error) {
    document.getElementById('artist-detail-albums').textContent = error;
    this.showPage('artist-detail', {savePage: true});
  };

  SpotifyRemoteClient.prototype.displaySearchResults = function(type, result) {
    var self              = this;
    var searchResultsId   = type + '-search-results';
    var $oldSearchResults = document.getElementById(searchResultsId);
    var $newSearchResults = document.createElement('div');
    $newSearchResults.id  = searchResultsId;

    this.createSearchResultElements(type, result[type], function(elements) {
      if (elements.length) {
        elements.map(function(el, index) {
          el.style.display = index < self.numberOfSearchResults ? 'block' : 'none';
          $newSearchResults.appendChild(el);
        });

        if (elements.length > self.numberOfSearchResults) {
          $newSearchResults.appendChild(self.createShowMoreElement(searchResultsId));
        }
      } else {
        $newSearchResults.appendChild(self.createNoSearchResultElement());
      }

      $oldSearchResults.parentNode.replaceChild($newSearchResults, $oldSearchResults);
    });
  };

  SpotifyRemoteClient.prototype.displaySearchError = function(type, errorMsg) {
    document.getElementById(type + '-search-results').textContent = errorMsg;
  };

  SpotifyRemoteClient.prototype.createNoSearchResultElement = function() {
    var el         = document.createElement('div');
    el.className   = 'no-search-result';
    el.textContent = 'Woah! No search results!';
    return el;
  };

  SpotifyRemoteClient.prototype.createShowMoreElement = function(searchResultsId) {
    var el         = document.createElement('a');
    el.className   = 'show-more';
    el.textContent = 'Show more';
    el.rel         = searchResultsId;
    return el;
  };

  SpotifyRemoteClient.prototype.createSearchResultElements = function(type, results, cb) {
    var elementCreator = {
      'tracks': this.createTrackSearchResultElement,
      'albums': this.createAlbumSearchResultElement,
      'artists': this.createArtistSearchResultElement
    }[type];

    cb(results.map(elementCreator, this));
  };

  SpotifyRemoteClient.prototype.createAlbumSearchResultElement = function(result) {
    var label = result.artists[0].name + ' - ' + result.name;
    return this._createSpotifyLink(label, result.href, 'albums');
  };

  SpotifyRemoteClient.prototype.createArtistDetailAlbumResults = function(results, cb) {
    var elements = results.map(function(result) {
      var label = result.album.artist + ' - ' + result.album.name;
      return this._createSpotifyLink(label, result.album.href, 'albums');
    }, this);

    return cb(elements);
  };

  SpotifyRemoteClient.prototype.createTrackSearchResultElement = function(result) {
    var label = result.artists[0].name + ' - ' + result.name;
    return this._createSpotifyLink(label, result.href, 'tracks');
  };

  SpotifyRemoteClient.prototype.createArtistSearchResultElement = function(result) {
    return this._createSpotifyLink(result.name, result.href, 'artists');
  };

  SpotifyRemoteClient.prototype._createSpotifyLink = function(label, url, type) {
    var el                = document.createElement('a');
    el.textContent        = label;
    el.dataset.spotifyurl = url;
    el.dataset.resulttype = type;

    return el;
  };

  new SpotifyRemoteClient().init(io);
})();
