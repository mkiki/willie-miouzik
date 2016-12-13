/**
 * willie-miouzik - Database unit tests
 */
// (C) Alexandre Morin 2015 - 2016

const assert = require('assert');
const helpers = require('./helpers.js');
const Database = require('wg-database').Database;
const miouzikdb = require('../lib/database.js');

describe('Database', function() {

  helpers.beforeAfter();

  /** ================================================================================
    * Cleanup functions (correct scan errors)
    * ================================================================================ */
  describe('Miouzik cleanup functions', function() {
    it('Should cleanup when same artist has multiple discogs IDs', function(done) {
      return helpers.asNobody(function(db, userContext) {

        function checkSong(id, title, artist, discogsArtistId, callback) {
          return miouzikdb.loadSong(db, userContext, id, function(err, song) {
            assert.ifError(err, 'loadSong failed');
            assert.equal(title, song.title, 'Bad title');
            assert.equal(artist, song.artist, 'Bad artist');
            assert.equal(discogsArtistId, song.discogs.artistId, 'Bad discogs id');
            return callback();
          });
        }

        checkSong('ad3e907d-8da4-4713-aa24-b9d17d6897fb', 'You Shook Me All Night Long', 'AC/DC',   1993710, function() {
          checkSong('f7a01164-19a8-4096-82cf-563e190bef19', 'Given The Dog A Bone',        'AC/DC',     84752, function() {
            checkSong('fb86d0db-2a13-4317-b935-d8b1ceca332e', 'Ethereal World',              'Krisiun',   62117, function() {
              checkSong('f8b875b1-f563-43ff-be90-e99cc546c080', 'Summon',                      'Krisiun', 1399840, function() {

                // Smallest artistId will be kept
                return miouzikdb.cleanupMultipleDiscogsArtistsIDs(db, userContext, function(err) {

                  checkSong('ad3e907d-8da4-4713-aa24-b9d17d6897fb', 'You Shook Me All Night Long', 'AC/DC',   84752, function() {
                    checkSong('f7a01164-19a8-4096-82cf-563e190bef19', 'Given The Dog A Bone',        'AC/DC',     84752, function() {
                      checkSong('fb86d0db-2a13-4317-b935-d8b1ceca332e', 'Ethereal World',              'Krisiun',   62117, function() {
                        checkSong('f8b875b1-f563-43ff-be90-e99cc546c080', 'Summon',                      'Krisiun', 62117, function() {

                          return done(err);
                        });
                      });
                    });
                  });
                });

              });
            });
          });
        });                
      });
    });
  });


  /** ================================================================================
    * Discogs query cache
    * ================================================================================ */

  describe('Discogs Query Cache', function() {

    it('Should not find result (empty cache)', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return miouzikdb.loadDiscogsQueryResult(db, userContext, 'Aborted/Retrogore', function(err, result) {
          if (err) return done(err);
          assert.strictEqual(result, null, "First call has no result");
          return done();
        });
      });
    });

    it('Should cache results', function(done) {
      return helpers.asNobody(function(db, userContext) {
        var abortedRetrogore = {artist:'Aborted', album:'Retrogore'};
        return miouzikdb.cacheDiscogsQueryResult(db, userContext, 'Aborted/Retrogore', abortedRetrogore, function(err, result) {
          if (err) return done(err);
          return miouzikdb.loadDiscogsQueryResult(db, userContext, 'Aborted/Retrogore', function(err, result) {
            if (err) return done(err);
            assert.deepEqual(result, abortedRetrogore, "Aborted/Retrogore");
            return done();
          });
        });
      });
    });

    it('Should update cache', function(done) {
      return helpers.asNobody(function(db, userContext) {
        var abortedRetrogore = {artist:'Aborted', album:'Retrogore'};
        return miouzikdb.cacheDiscogsQueryResult(db, userContext, 'Aborted/Retrogore', abortedRetrogore, function(err, result) {
          if (err) return done(err);
          return miouzikdb.loadDiscogsQueryResult(db, userContext, 'Aborted/Retrogore', function(err, result) {
            if (err) return done(err);
            assert.deepEqual(result, abortedRetrogore, "Aborted/Retrogore");

            abortedRetrogore = {artist:'Aborted', album:'Retrogore', year:2016};
            return miouzikdb.cacheDiscogsQueryResult(db, userContext, 'Aborted/Retrogore', abortedRetrogore, function(err, result) {
              if (err) return done(err);
              return miouzikdb.loadDiscogsQueryResult(db, userContext, 'Aborted/Retrogore', function(err, result) {
                if (err) return done(err);
                assert.deepEqual(result, abortedRetrogore, "Aborted/Retrogore");
                return done();
              });
            });

          });
        });
      });
    });
/*
    it('Should cache a real result', function(done) {
      return helpers.asNobody(function(db, userContext) {
        var payload = JSON.parse('{"test":[{"style": ["Black Metal", "Death Metal"], "thumb": "https://api-img.discogs.com/rYq-RDtA503SUrt-y40hUAoofFk=/fit-in/150x150/filters:strip_icc():format(jpeg):mode_rgb():quality(40)/discogs-images/R-679234-1146818572.jpeg.jpg", "format": ["CD", "Album"], "country": "France", "barcode": ["3700132600549", "DOCdata FRANCE CDAR054"], "uri": "/Benighted-Psychose/release/679234", "community": {"want": 26, "have": 43}, "label": ["Adipocere Records"], "catno": "CD AR 054", "year": "2002", "genre": ["Rock"], "title": "Benighted - Psychose", "resource_url": "https://api.discogs.com/releases/679234", "type": "release", "id": 679234}, {"style": ["Black Metal", "Death Metal"], "thumb": "https://api-img.discogs.com/D_aJ8GJb2gOWZL2tUNM7jOtd6FU=/fit-in/150x150/filters:strip_icc():format(jpeg):mode_rgb():quality(40)/discogs-images/R-6746585-1425767854-3090.jpeg.jpg", "format": ["CD", "Album", "Reissue"], "country": "France", "barcode": ["3700132600549", "BASM 140606.001"], "uri": "/Benighted-Psychose/release/6746585", "community": {"want": 14, "have": 5}, "label": ["Adipocere Records"], "catno": "CD AR 054", "year": "2014", "genre": ["Rock"], "title": "Benighted - Psychose", "resource_url": "https://api.discogs.com/releases/6746585", "type": "release", "id": 6746585}]}');
        return miouzikdb.cacheDiscogsQueryResult(db, userContext, 'Aborted/Retrogore', payload, function(err, result) {
          if (err) return done(err);
          return miouzikdb.loadDiscogsQueryResult(db, userContext, 'Aborted/Retrogore', function(err, result) {
            if (err) return done(err);
            assert.deepEqual(result, payload, "Aborted/Retrogore");
            return done();
          });
        });
      });
    });
*/
  });

  /** ================================================================================
    * Discogs releases
    * ================================================================================ */

  describe('Discogs Releases', function() {

    // Because we use the release id "0" to mean Discogs release not found
    // instead of not even searched (NULL)
    it('Should find release with ID=0', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return miouzikdb.loadDiscogsRelease(db, userContext, 0, function(err, result) {
          if (err) return done(err);
          assert.strictEqual(result.id, 0, "Release with Id 0 found");
          return done();
        });
      });
    });

    it('Should not find release', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return miouzikdb.loadDiscogsRelease(db, userContext, 123, function(err, result) {
          if (err) return done(err);
          assert.strictEqual(result, null, "First call has no result");
          return done();
        });
      });
    });

    it('Should find release', function(done) {
      return helpers.asNobody(function(db, userContext) {
        var release = {artist:'Aborted', album:'Retrogore', year:2016};
        return miouzikdb.storeDiscogsRelease(db, userContext, 123, release, function(err) {
          if (err) return done(err);
          return miouzikdb.loadDiscogsRelease(db, userContext, 123, function(err, result) {
            if (err) return done(err);
            assert.deepEqual(result, release, "Release found");
            return done();
          });
        });
      });
    });

  });


});


