/**
 * willie-miouzik - Player application (client-side code)
 */
// (C) Alexandre Morin 2015 - 2016

/** ================================================================================
  * Global variables
  * ================================================================================ */

// Current collection
var currentCollection = undefined;

// Currently selected artist
var currentArtistName = undefined;

// Current Portfolio (songs in the portfolio of the current artist, by song uuid)
// It also includes songs in the current playlist
var currentPortfolio = {};

// Current playlist
var currentPlayList = [];
// ID of song being played
var currentSongUUID = undefined;

// Player controls
var playing = false;        // State of the audio player
var player = undefined;     // DOM element
var $artist = undefined;
var $song = undefined;
var $cover = undefined;
var $ellapsed = undefined;
var $remaining = undefined;
var $playPauseButton = undefined;
var $playPreviousButton = undefined;
var $playNextButton = undefined;
var $progressIndicator = undefined;
var $progressIndicatorEllapsed = undefined;  

// Should we play next song after current song is finished?
var shouldPlayNext = false;


/** ================================================================================
  * Refresh all
  * ================================================================================ */
function refresh() {
  var canvas = document.getElementById("canvas");
  reloadCollections();
}


function _clearCollections() {
  currentCollection = undefined;
  var $select = $("#collection-select");
  $select.children().remove();
  $select.empty();
  _clearArtists();
}

// Clear the currentPortfolio varianme, keep only songs in the current playlist
function _emptyPortfolioKeepCurrentPlayList() {
  var portfolio = {};
  for (var i=0; i<currentPlayList.length; i++) {
    var uuid = currentPlayList[i];
    var song = currentPortfolio[uuid];
    if (song) portfolio[uuid] = song;
  }
  currentPortfolio = portfolio;
}

function _clearArtists() {
  currentArtistName = undefined;
  _emptyPortfolioKeepCurrentPlayList();
  var $list = $("#artist-list");
  $list.children().remove();
  $list.empty();
}

function _clearPortfolio() {
  _emptyPortfolioKeepCurrentPlayList();
  var $portfolio = $("#artist-portfolio");
  $portfolio.children().remove();
  $portfolio.empty();
}

/**
 * Reload the list of collections (look at config-miouzik.json file)
 * Fill up the collections combo (in header) with the list of collections.
 * When a collection is selected, the list of artists is reloaded
 */
function reloadCollections() {
  _clearCollections();
  var $select = $("#collection-select");

  var url = '/miouzik/collections';
  return ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function(collections) {
      _clearCollections();

      function newItem(collection) {
        var $option = $('<option>').attr('value', collection.id).text(collection.name).appendTo($select);
        if (collection.default) $option.prop('selected', true);
      }

      for (var i=0; i<collections.length; i++) {
        newItem(collections[i]);
        if (collections[i].default) currentCollection = collections[i];
      }

      $select.change(function() {
        currentCollection = undefined;
        var val = +($select.val());
        for (var i=0; i<collections.length; i++) {
          if (collections[i].id === val) { currentCollection = collections[i]; break; }
        }
        reloadArtists();
      });

      reloadArtists();
    },
    error: function(jqxhr, textStatus, error) {
      flashError("Failed to load collections", jqxhr.status);
    }
  });
}

/**
 * Reload the list of artists for the current collection
 */
function reloadArtists() {
  var $list = $("#artist-list");
  _clearArtists();

  if (currentCollection === undefined) return;

  var url = '/miouzik/artists/' + currentCollection.id;
  return ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function(artists) {
      _clearArtists();

      function newItem(artist) {
        var $item = $('<div class="artist-list-item"></div>');
        var $avatar = $ ('<div class="artist-list-item-avatar"></div>').appendTo($item);
        var cover = "/miouzik/cover/artist/0";
        if (artist.discogsArtistId) cover = "/miouzik/cover/artist/" + artist.discogsArtistId;
        var $img = $('<img>').attr('src', cover).appendTo($avatar);
        var $name = $('<div class="artist-list-item-name">').text(artist.artist).appendTo($item);
        $list.append($item);
        $item.click(function() {
          updateArtistPortfolio(artist.artist);
        });
      }

      for (var i=0; i<artists.length; i++) {
        newItem(artists[i]);
      }

    },
    error: function(jqxhr, textStatus, error) {
      flashError("Failed to load artists", jqxhr.status);
    }
  });
}


/**
 * Play a song
 */
function playSongs(songIds) {
  currentPlayList = songIds.slice();
  shouldPlayNext = true;
  playNext();
}
function playNext() {
  if (!shouldPlayNext) {
    return refreshControls();
  }
  if (currentPlayList.length ===0) {
    shouldPlayNext = false;
    currentSongUUID = undefined;
    return refreshControls();
  }

  var uuid = currentPlayList.shift();
  currentSongUUID = uuid;
  var song = currentPortfolio[uuid];
  if (!song) {
    console.log("Song not in portfolio", uuid);
    return playNext();
  }
  // Start playing
  player.src = '/miouzik/stream/' + uuid;
  // Record one more play for this song
  refreshSong(song);
  return ajax({
    type: 'PATCH',
    url: '/miouzik/song/' + uuid + '/play',
    dataType: 'json',
    success: function(songs) {
    },
    error: function(jqxhr, textStatus, error) {
      flashError("Failed to record new song play", jqxhr.status);
    }
  });
}

/**
 * Update the "portfolio" of the selected artist, ie display all albums for this artist
 */
function updateArtistPortfolio(artistName) {
  currentArtistName = artistName;
  var $portfolio = $("#artist-portfolio");
  _clearPortfolio();

  var url = '/miouzik/songs/' + currentCollection.id + "/" + encodeURIComponent(artistName);
  return ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function(songs) {
      _clearPortfolio();

      for (var i=0; i<songs.length; i++) {
        var uuid = songs[i].uuid;
        currentPortfolio[uuid] = songs[i];
      }

      var albums = {}; // key = album name, value = list of songs
      var releases = {}; // key = release id, value = release
      for (var i=0; i<songs.length; i++) {
        var albumName = songs[i].album;
        var album = albums[albumName];
        if (album === undefined)
          albums[albumName] = album = { name:albumName, year:undefined, songs:[], releaseId:undefined };
        album.songs.push(songs[i]);
        if (songs[i].year !== null && songs[i].year !== undefined && album.year === undefined) album.year = songs[i].year;
        var releaseId = songs[i].discogs.release && songs[i].discogs.release.id;
        if (releaseId !== null && releaseId !== undefined && releaseId !== 0 && album.releaseId === undefined) album.releaseId = releaseId;
        if (releaseId !== null && releaseId !== undefined && releaseId !== 0) releases[releaseId] = songs[i].discogs.release;
      }
      var songCount = songs.length;
      var albumCount = Object.keys(albums).length;

      function newAlbum(album) {
        var albumSongIds = [];  // song IDs in this album (ordered by track number)

        var $album = $('<div class="artist-portfolio-album"></div>');
        var $header = $('<div class="artist-portfolio-album-header"></div>').appendTo($album);
        var $cover = $('<div class="artist-portfolio-album-header-cover"></div>').appendTo($header);
        var cover = "/miouzik/cover/album/0";
        if (album.releaseId) cover = "/miouzik/cover/album/" + album.releaseId;
        $('<img>').attr('src', cover).appendTo($cover);
        var $caption = $('<div class="artist-portfolio-album-header-caption"></div>').appendTo($header);
        $('<h1>').text(album.name).appendTo($caption);
        var h2 = "";
        if (album.releaseId && releases[album.releaseId]) {
          var styles = releases[album.releaseId].style;
          if (styles && styles.length>0) {
            for (var i=0; i<styles.length; i++) {
              if (i>0) h2 = h2 + ", ";
              h2 = h2 + styles[i];
            }
          }
        }
        if (album.year !== null && album.year !== undefined && h2 !== "") h2 = h2 + "\xa0•\xa0";
        if (album.year !== null && album.year !== undefined) h2 = h2 + album.year;
        h2 = h2 + "\xa0"; // &nbsp;
        $('<h2>').text(h2).appendTo($caption);

        function newSong(index, song) {
          var $song = $('<div class="artist-portfolio-album-song"></div>').attr('id', song.uuid);
          var $like = $('<div class="artist-portfolio-album-song-like"></div>').appendTo($song);
          var $trackNumber = $('<div class="artist-portfolio-album-song-trackNumber"></div>').text("" + song.trackNumber).appendTo($song);
          var $play = $('<div class="artist-portfolio-album-song-play"></div>').appendTo($song);
          var $title = $('<div class="artist-portfolio-album-song-title"></div>').text(song.title).appendTo($song);
          var $download = $('<div class="artist-portfolio-album-song-download"></div>').appendTo($song);
          var $duration = $('<div class="artist-portfolio-album-song-duration"></div>').appendTo($song);
          $album.append($song);
          $song.click(function() {
            $(".artist-portfolio-album-song", $portfolio).toggleClass("artist-portfolio-album-song--selected", false);
            $song.toggleClass("artist-portfolio-album-song--selected", true);
          });
          $play.click(function() {
            playSongs(albumSongIds.slice(index));
          });
        }

        var songs = album.songs.sort(function(a,b) {
          if (a.trackNumber && b.trackNumber) return a.trackNumber - b.trackNumber; 
        });
        for (var i=0; i<album.songs.length; i++) {
          var song = album.songs[i];
          albumSongIds.push(song.uuid);
          newSong(i, song);
        }

        $album.appendTo($portfolio);
      }

      var $header = $('<div class="artist-portfolio-header"></div>');
      $('<h1>').text(artistName).appendTo($header);
      var h2 = "" + albumCount;
      if (albumCount === 1) h2 = h2 + " album, "; else h2 = h2 + " albums, ";
      h2 = h2 + songCount;
      if (songCount === 1) h2 = h2 + " song, "; else h2 = h2 + " songs";
      $('<h2>').text(h2).appendTo($header);
      $portfolio.append($header);

      for (var i=0; i<albumCount; i++) {
        var album = Object.keys(albums)[i];
        album = albums[album];
        newAlbum(album);
      }

    },
    error: function(jqxhr, textStatus, error) {
      flashError("Failed to load artists", jqxhr.status);
    }
  });
}







function formatDuration(seconds) {
  seconds = Math.floor(seconds);
  var s = (seconds % 60);
  var m = (seconds - s)/60;
  if (s < 10) s = '0' + s; else s = '' + s;
  return m + ':' + s;
}

function refreshControls() {
  var image = playing ? '/miouzik/images/pause.png' : '/miouzik/images/play.png';
  $playPauseButton.attr('src', image);
}

function refreshSong(song) {
  $('.artist-portfolio-album-song').toggleClass('song-playing', false);
  $('#' + song.uuid).toggleClass('song-playing', true);
  $song.text(song.title);
  $artist.text(song.artist + "\xa0•\xa0" + song.album);
  var cover = "/miouzik/cover/album/0";
  if (song.discogs.release.id) cover = "/miouzik/cover/album/" + song.discogs.release.id;
  $cover.attr('src', cover);
  refreshProgress();
  refreshControls();
}

function refreshProgress() {
  var duration = player.duration; 
  var current = player.currentTime;
  if (duration !== duration || current !== current) return true;
  $ellapsed.text(formatDuration(current));
  $remaining.text("-" + formatDuration(duration-current));
  var width = $progressIndicator.width();
  var ellapsed = 0;
  if (width > 2) ellapsed = (current / duration) * (width-2);
  $progressIndicatorEllapsed.css('flex-basis', ellapsed);
  return true;
}


/**
 * Main
 */
$(function() {
  createMenu(document.sideMenu, "miouzik");
  $('.canvas').addClass('canvas-no-infos');
  refresh();

  // https://developers.google.com/web/updates/2012/02/HTML5-audio-and-the-Web-Audio-API-are-BFFs
  player = $('#player')[0];
  player.autoplay = true;

  $artist = $('#progress-artist');
  $song = $('#progress-song');
  $cover = $("#progress-cover-image");
  $ellapsed = $('#progress-ellapsed');
  $remaining = $('#progress-remaining');
  $progressIndicator = $('#progress-indicator');
  $progressIndicatorEllapsed = $('#progress-indicator-ellapsed');

  $playPauseButton = $('#play');
  $playPreviousButton = $('#play-previous');
  $playNextButton = $('#play-next');

  // Sent when enough data is available that the media can be played, at least for a couple of frames.  This corresponds to the HAVE_ENOUGH_DATA readyState
  player.addEventListener('canplay', function() {
  });

  // Sent when playback completes.
  player.addEventListener('ended', function() {
    playing = false;
  });

  // Sent when an error occurs.  The element's error attribute contains more information.
  // https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Using_HTML5_audio_and_video#Error_handling
  player.addEventListener('error', function() {
    playing = false;
  });

  // Sent when playback is paused.
  player.addEventListener('pause', function() {
    playing = false;
  });

  // Sent when playback of the media starts after having been paused; that is, when playback is resumed after a prior pause event.
  player.addEventListener('play', function() {
    playing = true;
  });

  // Sent when the media begins to play (either for the first time, after having been paused, or after ending and then restarting).
  player.addEventListener('playing', function() {
    playing = true;
  });

  // Simulating progress, because progress event does not always trigger
  setInterval(function() {
    refreshProgress();
    refreshControls();
    //console.log("Playing", playing);

    if (!playing && shouldPlayNext )
      playNext();
  }, 1000);

  // Sent when the audio volume changes (both when the volume is set and when the muted attribute is changed).
  player.addEventListener('waiting', function() {
  });

  $playPreviousButton.click(function() {
    refreshControls();
  });
  $playPauseButton.click(function() {
    if (playing) {
      shouldPlayNext = false;
      player.pause();
      playing = false;
    }
    else {
      shouldPlayNext = true;
      player.play();
      playing = true;
    }
    refreshControls();
  });
  $playNextButton.click(function() {
    refreshControls();
  });

});

