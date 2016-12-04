/**
 * willie-miouzik - Database access
 */
// (C) Alexandre Morin 2016



const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const Database = require('wg-database').Database;
const utils = require('wg-utils');

const log = Log.getLogger('willie-miouzik::database');


/**
 * @module miouzik/database
 */

/** ================================================================================
  * Type definitions
  * ================================================================================ */

/**
 * @typedef Artist
 *
 * @property {string} artist - The artist name
 * @property {number} discogsartistid - The Discogs artist id
 */

/**
 * @typedef Song
 *
 * @property {string} uuid - The artist name
 * @property {string} tagMTime - 
 * @property {string} title - The song title
 * @property {string} artist - The song artist name
 * @property {string} album - Tbe song album name
 * @property {number} year - The song year
 * @property {number} trackNumber - The track number
 * @property {string} genre - 
 * @property {number} durationInSeconds - 
 * @property {number} likes - 
 * @property {number} playCount - 
 * @property {Discogs} discogs - 
 * @property {string} stream - The stream of the URL to play this song
 * @property {Fingerprint} fingerprint - The corresponding fingerprint
 */

 /**
 * @typedef Discogs
 *
 * @property {DiscogsArtist} artist - The discogs artist info
 * @property {DiscogsRelease} release - The discogs release info
 */

/**
 * @typedef DiscogsArtist
 *
 */

/**
 * @typedef DiscogsRelease
 *
 */

/**
 * @typedef Fingerprint
 *
 * @property {string} shortFilename - 
 * @property {string} longFilename - 
 * @property {Date} mtime - 
 * @property {number} size - 
 * @property {string} md5 - 
 * @property {Date} vanishedAt - 
 * @property {boolean} hidden - 
 */



/** ================================================================================
  * Statistics
  * ================================================================================ */

/**
 * Get the number of songs
 * @param db - is the database
 * @param userContext - the user context for database access
 * @return - the number of songs, artists, and albums in the database
 */
countSongs = function(db, userContext, callback) {
  if (!userContext)
    return callback(db.requiresRights("countSongs requires a user context"));
  return db.withConnection(function(client, callback) {

    var query = "SELECT COUNT(1) AS count " +
                " FROM miouzik_songs m " +
                " LEFT JOIN photos_fingerprints f ON (f.id = m.id) ";
    var bindings = [];
    // TODO: Apply rights
//    if (!userContext.isAdmin)
//      query = query + " AND poi.ownerId = '" + userContext.user.uuid + "'";
    return db.query(client, "countSongs (songs)", query, bindings, function(err, result) {
      if (err) return callback(err);
      var songCount = result[0].count;


      var query = "SELECT COUNT(DISTINCT m.artist) AS count " +
                  " FROM miouzik_songs m " +
                  " LEFT JOIN photos_fingerprints f ON (f.id = m.id) ";
      var bindings = [];
      // TODO: Apply rights
  //    if (!userContext.isAdmin)
  //      query = query + " AND poi.ownerId = '" + userContext.user.uuid + "'";
      return db.query(client, "countSongs (artists)", query, bindings, function(err, result) {
        if (err) return callback(err);
        var artistCount = result[0].count;

        var query = "SELECT COUNT(DISTINCT m.album) AS count " +
                    " FROM miouzik_songs m " +
                    " LEFT JOIN photos_fingerprints f ON (f.id = m.id) ";
        var bindings = [];
        // TODO: Apply rights
    //    if (!userContext.isAdmin)
    //      query = query + " AND poi.ownerId = '" + userContext.user.uuid + "'";
        return db.query(client, "countSongs (albums)", query, bindings, function(err, result) {
          if (err) return callback(err);
          var albumCount = result[0].count;

      
          return callback(null, {
            songCount: songCount,
            artistCount: artistCount,
            albumCount: albumCount
          });

        });
      });
    });

  }, callback);
}

/**
 * Get songs distribution by year
 */
getSongsDistributionByYear = function(db, userContext, callback) {
  if (!userContext)
    return callback(db.requiresRights("getSongsDistributionByYear requires a user context"));
  return db.withConnection(function(client, callback) {

    var query = "SELECT year AS year, COUNT(1) AS count " +
                " FROM miouzik_songs m " +
                " LEFT JOIN photos_fingerprints f ON (f.id = m.id) " +
                " GROUP BY year";
    var bindings = [];
    // TODO: Apply rights
//    if (!userContext.isAdmin)
//      query = query + " AND poi.ownerId = '" + userContext.user.uuid + "'";
    return db.query(client, "getSongsDistributionByYear", query, bindings, function(err, result) {
      if (err) return callback(err);
      var dist = [];
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        var row = {
          year: +row["year"],
          count: +row["count"]
        };
        dist.push(row);
      }
      return callback(null, dist);
    });

  }, callback);
}

/**
 * Get songs distribution by year
 */

getSongsDistributionByGenre = function(db, userContext, callback) {
  if (!userContext)
    return callback(db.requiresRights("getSongsDistributionByGenre requires a user context"));
  return db.withConnection(function(client, callback) {

    var query = "SELECT COUNT(1) AS count, r.release -> 'style' -> 0 AS genre " +
                " FROM miouzik_songs m " +
                " LEFT JOIN photos_fingerprints f ON (f.id = m.id) " +
                " LEFT JOIN miouzik_discogs_releases r ON (r.id = m.discogsReleaseId) " +
                " GROUP by r.release -> 'style' -> 0";
    var bindings = [];
    // TODO: Apply rights
//    if (!userContext.isAdmin)
//      query = query + " AND poi.ownerId = '" + userContext.user.uuid + "'";
    return db.query(client, "getSongsDistributionByGenre", query, bindings, function(err, result) {
      if (err) return callback(err);
      var dist = [];
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        var row = {
          genre: row["genre"],
          count: +row["count"]
        };
        dist.push(row);
      }
      return callback(null, dist);
    });

  }, callback);
}


/** ================================================================================
  * Songs
  * ================================================================================ */


/**
 * Load all artists
 *
 * @param db - is the database
 * @param userContext - the user context for database access
 * @param {string} collectionFolder - is the collection folder (all images in this folder or a subfolder will be returned)
 * @return {Artist[]} - the list of artists in this collection
 */
loadArtists = function(db, userContext, collectionFolder, callback) {
  if (!userContext)
    return callback(db.requiresRights("loadArtists requires a user context"));
  return db.withConnection(function(client, callback) {

    if (!utils.endsWith(collectionFolder, '/')) collectionFolder = collectionFolder + '/';

    var query = "SELECT DISTINCT m.artist, m.discogsArtistId " +
                " FROM miouzik_songs m " +
                " LEFT JOIN photos_fingerprints f ON (f.id = m.id) " +
                " WHERE f.longFileName LIKE '" + utils.escapeForLike(collectionFolder) + "%'" +
                " ORDER BY m.artist";
    var bindings = [];

    // TODO: Apply rights
//    if (!userContext.isAdmin)
//      query = query + " AND poi.ownerId = '" + userContext.user.uuid + "'";

    return db.query(client, "loadArtists", query, bindings, function(err, result) {
      if (err) return callback(err);
      var artists = [];
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        var artist = {
          artist:                 row["artist"],
          discogsArtistId:        +row["discogsartistid"]
        };
        artists.push(artist);
      }
      return callback(null, artists);
    });

  }, callback);
}

/**
 * Load all songs of an artist
 *
 * @param db - is the database
 * @param userContext - the user context for database access
 * @param {string} byArtist - is the name of the artist 
 * @param {string} collectionFolder - is the collection folder (all images in this folder or a subfolder will be returned)
 * @return {Song[]} - the list of artists in this collection
 */
loadSongs = function(db, userContext, byArtist, collectionFolder, callback) {
  if (!userContext)
    return callback(db.requiresRights("loadSongs requires a user context"));
  if (!utils.endsWith(collectionFolder, '/')) collectionFolder = collectionFolder + '/';
  return db.withConnection(function(client, callback) {    
    var query = "SELECT m.id, m.tagMTime, m.title, m.artist, m.album, m.year, m.trackNumber, m.genre, m.durationInSeconds, m.likes, m.playCount, " +
                "       r.id AS rid, r.release AS rrelease, " +
                "       a.id AS aid, a.artist AS aartist, " +
                "       f.shortFilename, f.longFilename, f.mtime, f.size, f.md5, f.vanishedAt, f.hidden " +
                " FROM miouzik_songs m " +
                " LEFT JOIN photos_fingerprints f ON m.id = f.id " +
                " LEFT OUTER JOIN miouzik_discogs_releases r ON m.discogsReleaseId = r.id" +
                " LEFT OUTER JOIN miouzik_discogs_artists a ON m.discogsArtistId = a.id" +
                " WHERE m.artist = $1 " +
                " AND f.longFileName LIKE '" + utils.escapeForLike(collectionFolder) + "%'";
    var bindings = [ byArtist ];

    // TODO: Apply rights
//    if (!userContext.isAdmin)
//      query = query + " AND poi.ownerId = '" + userContext.user.uuid + "'";

    return db.query(client, "loadSongs", query, bindings, function(err, result) {
      if (err) return callback(err);
      var songs = [];
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        var song = {
          uuid:               row["id"],
          tagMTime:           row["tagmtime"],
          title:              row["title"],
          artist:             row["artist"],
          album:              row["album"],
          year:               row["year"],
          trackNumber:        row["tracknumber"],
          genre:              row["genre"],
          durationInSeconds:  row["durationinseconds"],
          likes:              row["likes"],
          playCount:          row["playcount"],
          discogs: {
            release:          row["rrelease"],
            artist:           row["aartist"]
          },
          stream:             "/miouzik/stream/" + row["id"],
          fingerprint: {
            shortFilename:    row["shortfilename"],
            longFilename:     row["longfilename"],
            mtime:            row["mtime"],
            size:             row["size"],
            md5:              row["md5"],
            vanishedAt:       row["vanishedat"],
            hidden:           row["hidden"],
          }
        };
        songs.push(song);
      }
      return callback(null, songs);
    });

  }, callback);
}


/**
 * Get a single song
 *
 * @param db - is the database
 * @param userContext - the user context for database access
 * @param {string} songId - is the UUID of the song
 * @return {Song} - details on the song
 */
loadSong = function(db, userContext, songId, callback) {
  if (!userContext)
    return callback(db.requiresRights("getSong requires a user context"));
  return db.withConnection(function(client, callback) {    

    var query = "SELECT m.id, m.tagMTime, m.title, m.artist, m.album, m.year, m.trackNumber, m.genre, m.durationInSeconds, m.likes, m.playCount, " +
                "       r.id AS rid, r.release AS rrelease, " +
                "       a.id AS aid, a.artist AS aartist, " +
                "       f.shortFilename, f.longFilename, f.mtime, f.size, f.md5, f.vanishedAt, f.hidden " +
                " FROM miouzik_songs m " +
                " LEFT JOIN photos_fingerprints f ON m.id = f.id " +
                " LEFT OUTER JOIN miouzik_discogs_releases r ON m.discogsReleaseId = r.id" +
                " LEFT OUTER JOIN miouzik_discogs_artists a ON m.discogsArtistId = a.id" +
                " WHERE m.id = $1";
    var bindings = [ songId ];

    // TODO: Apply rights
//    if (!userContext.isAdmin)
//      query = query + " AND poi.ownerId = '" + userContext.user.uuid + "'";
    return db.query(client, "getSong", query, bindings, function(err, result) {
      if (err) return callback(err);
      var song = undefined;
      if (result.length > 0) {
        var row = result[0];
        song = {
          uuid:               row["id"],
          tagMTime:           row["tagmtime"],
          title:              row["title"],
          artist:             row["artist"],
          album:              row["album"],
          year:               row["year"],
          trackNumber:        row["tracknumber"],
          genre:              row["genre"],
          durationInSeconds:  row["durationinseconds"],
          likes:              row["likes"],
          playCount:          row["playcount"],
          discogs: {
            release:          row["rrelease"],
            artist:           row["aartist"]
          },
          stream:             "/miouzik/stream/" + row["id"],
          fingerprint: {
            shortFilename:    row["shortfilename"],
            longFilename:     row["longfilename"],
            mtime:            row["mtime"],
            size:             row["size"],
            md5:              row["md5"],
            vanishedAt:       row["vanishedat"],
            hidden:           row["hidden"],
          }
        };
      }
      return callback(null, song);
    });

  }, callback);
}


/**
 * Stores (insert/update) song meta-data
 *
 * @param db - is the database
 * @param userContext - the user context for database access
 * @param {Song} song - is the song object ot store. The UUID is used as a key (this is the same UUID as for the fingerprint)
 * @return {string} the uuid of the song object just created/inserted
 *
 * Access rights
 * - Requires a user context
 * - admin can insert/update all songs
 * - non-admin can only insert/update songs for fingerprints they own
 */
storeSong = function(db, userContext, song, callback) {
  if (!userContext)
    return callback(db.requiresRights("storeSong requires a user context"));

  var uuid = song.uuid;
  return db.withConnection(function(client, callback) {
    // Check if song record already exist and fetch owner id too
    var query = "SELECT f.id AS fid, f.ownerId, s.id AS sid FROM photos_fingerprints f LEFT OUTER JOIN miouzik_songs s ON f.id = s.id WHERE f.id=$1";
    var bindings = [ song.uuid ];
    return db.query(client, "loadSongForStore", query, bindings, function(err, result) {
      if (err) return callback(err);
      if (result.length === 0) {
        var message = "Possible data corruption: inserting an song whith an uuid of a non-existent fingerprint";
        log.warn({song:song}, message);
        return callback(message);
      }
      var rec = result[0];
      var ownerId = rec.ownerid;
      var songId = rec.sid;
  
      // Non-admin can only insert fingerprints for themselves
      if (!userContext.isAdmin) {
        if (ownerId !== userContext.user.uuid)  {
          return callback(db.requiresRights("Cannot insert/update a song on behalf of someone else"));
        }
      }

      // Insert new song
      if (!songId) {
        var query = "INSERT INTO miouzik_songs (id, version, tagMTime, title, artist, album, year, trackNumber, genre, durationInSeconds, likes, playCount) " +
                    "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)";
        var bindings = [ uuid, song.version, song.tagMTime, song.title, song.artist, song.album, song.year, song.trackNumber, song.genre, song.durationInSeconds, 0, 0 ];
        return db.query(client, "storeSong(insert)", query, bindings, function(err, result) {
          if (err) return callback(err);
          return callback(null, uuid);
        });
      }

      // Update existing song
      else {
        var query = "UPDATE miouzik_songs SET ";
        var bindings = [ song.uuid ];
        var nothingToUpdate = true;
        var first = true;
        Object.keys(song).forEach(function(attr) {
          if (attr !== 'uuid') {
            nothingToUpdate = false;
            var value = song[attr];
            if (value !== undefined) {
              if (!utils.isArray(value)) {
                if (!first) query = query + ", "; else first = false;
                if (value === null) {
                  query =  query + attr + " = NULL";
                }
                else if (typeof value === 'function') {
                  query =  query + attr + "=" + value.apply(this);
                }
                else {
                  var i = bindings.length;
                  query =  query + attr + "=$" + (i+1);
                  bindings.push(value);
                }
              }
            }
          }
        });
        // Nothing to update => return
        if (nothingToUpdate)
          return callback(null, songId);
        query = query + " WHERE id=$1";
        return db.query(client, "storeSong(update)", query, bindings, function(err, result) {
          if (err) return callback(err);
          return callback(null, songId);
        });
      }

    });
  }, callback);

};




/** ================================================================================
  * Discogs
  * ================================================================================ */


/**
 * Load cached discogs query result
 *
 * @param db - is the database
 * @param userContext - the user context for database access
 * @param {string} q - is a key for the discogs query
 * @return {Object} - is the cached query result, or null if not found
 */
loadDiscogsQueryResult = function(db, userContext, q, callback) {
  if (!userContext)
    return callback(db.requiresRights("loadDiscogsQueryResult requires a user context"));

  return db.withConnection(function(client, callback) {
    // Check if song record already exist and fetch owner id too
    var query = "SELECT q.result AS result FROM miouzik_discogs_queries q WHERE q.query=$1";
    var bindings = [ q ];
    return db.query(client, "loadDiscogsQueryResult", query, bindings, function(err, result) {
      if (err) return callback(err);
      if (result.length === 0)
        return callback(undefined, null);
      var row = result[0];
      return callback(undefined, row.result);
    });
  }, callback);
};

/**
 * Cache discogs query result
 *
 * @param db - is the database
 * @param userContext - the user context for database access
 * @param {string} q - is a key for the discogs query
 * @param {Object} result - is the Discogs result
 */
cacheDiscogsQueryResult = function(db, userContext, q, result, callback) {
  if (!userContext)
    return callback(db.requiresRights("cacheDiscogsQueryResult requires a user context"));

  return db.withConnection(function(client, callback) {
    // Check if song record already exist and fetch owner id too
    var query = "INSERT INTO miouzik_discogs_queries (query, result) VALUES ($1, $2) ON CONFLICT (query) DO UPDATE SET result = $2;";
    var bindings = [ q, result ];
    return db.query(client, "cacheDiscogsQueryResult", query, bindings, function(err, result) {
      if (err) return callback(err);
      return callback();
    });
  }, callback);
};

/**
 * Load Discogs release
 *
 * @param db - is the database
 * @param userContext - the user context for database access
 * @param {integer} id - is the Discogs release id
 * @return {DiscogsRelease} - the cached Discogs release
 */
loadDiscogsRelease = function(db, userContext, id, callback) {
  if (!userContext)
    return callback(db.requiresRights("loadDiscogsRelease requires a user context"));

  return db.withConnection(function(client, callback) {
    // Check if song record already exist and fetch owner id too
    var query = "SELECT r.release AS release FROM miouzik_discogs_releases r WHERE r.id=$1";
    var bindings = [ id ];
    return db.query(client, "loadDiscogsRelease", query, bindings, function(err, result) {
      if (err) return callback(err);
      if (result.length === 0)
        return callback(undefined, null);
      var row = result[0];
      return callback(undefined, row.release);
    });
  }, callback);
};

/**
 * Save a Discogs release in the database (insert or update)
 *
 * @param db - is the database
 * @param userContext - the user context for database access
 * @param {integer} id - is the Discogs release id
 * @param {DiscogsRelease} release - the Discogs release to cache
 */
storeDiscogsRelease = function(db, userContext, id, release, callback) {
  if (!userContext)
    return callback(db.requiresRights("storeDiscogsRelease requires a user context"));

  return db.withConnection(function(client, callback) {
    // Check if song record already exist and fetch owner id too
    var query = "INSERT INTO miouzik_discogs_releases (id, release) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET release = $2;";
    var bindings = [ id, release ];
    return db.query(client, "storeDiscogsRelease", query, bindings, function(err, result) {
      if (err) return callback(err);
      return callback();
    });
  }, callback);
};

/**
 * Save a Discogs artist in the database (insert or update)
 *
 * @param db - is the database
 * @param userContext - the user context for database access
 * @param {integer} id - is the Discogs artist id
 * @param {DiscogsArtist} artist - the Discogs artist to cache
 */
storeDiscogsArtist = function(db, userContext, id, artist, callback) {
  if (!userContext)
    return callback(db.requiresRights("storeDiscogsArtist requires a user context"));

  return db.withConnection(function(client, callback) {
    // Check if song record already exist and fetch owner id too
    var query = "INSERT INTO miouzik_discogs_artists (id, artist) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET artist = $2;";
    var bindings = [ id, artist ];
    return db.query(client, "storeDiscogsArtist", query, bindings, function(err, result) {
      if (err) return callback(err);
      return callback();
    });
  }, callback);
};


/**
 * Public interface
 * @ignore
 */
module.exports = {
  loadArtists:                  loadArtists,
  loadSongs:                    loadSongs,
  loadSong:                     loadSong,
  storeSong:                    storeSong,
  loadDiscogsQueryResult:       loadDiscogsQueryResult,
  cacheDiscogsQueryResult:      cacheDiscogsQueryResult,
  loadDiscogsRelease:           loadDiscogsRelease,
  storeDiscogsRelease:          storeDiscogsRelease,
  storeDiscogsArtist:           storeDiscogsArtist,
  countSongs:                   countSongs,
  getSongsDistributionByYear:   getSongsDistributionByYear,
  getSongsDistributionByGenre:  getSongsDistributionByGenre
};




