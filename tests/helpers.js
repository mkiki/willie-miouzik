/**
 * willie-miouzik - Test utils / helpers
 */
// (C) Alexandre Morin 2015 - 2016

const extend = require('extend');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const utils = require('wg-utils');
const Database = require('wg-database').Database;

var Module = require('../lib/module.js');
var willieCoreModule = require('willie-core').Module;
var williePhotosModule = require('willie-photos').Module;
var willieMiouzikModule = new Module();

const log = Log.getLogger('willie-miouzik::database::test');



/**
 * Prepare database connection.
 * Connection parameters are specified by the following environment variables
 *

export WG_DBNAME=willietest;
export WG_DBUSER=willie;
export WG_DBPASS=willie;
export WG_ADMINDBNAME=postgres;
export WG_ADMINDBUSER=postgres;
export WG_ADMINDBPASS=;

 *
 * The following connection are used:
 *
 * Connection     Database    User         Usage
 * ------------------------------------------------------------------------------------------
 * ADMINCNX       postgres    postgres     (Re)Create the test database
 * ADMINCNX2      test db     postgres     Grant privileges to test user, create PG extensions on the test database
 * CNX            test db     test user    Create tables and insert data
 *
 */

const DBNAME = process.env.WG_DBNAME;
const DBUSER = process.env.WG_DBUSER;
const DBPASS = process.env.WG_DBPASS;
const ADMINDBNAME = process.env.WG_ADMINDBNAME;
const ADMINDBUSER = process.env.WG_ADMINDBUSER;
const ADMINDBPASS = process.env.WG_ADMINDBPASS;

if (DBNAME === undefined || DBNAME === null || DBNAME === "" ||
    DBUSER === undefined || DBUSER === null || DBUSER === "" ||
    ADMINDBNAME === undefined || ADMINDBNAME === null || ADMINDBNAME === "" ||
    ADMINDBUSER === undefined || ADMINDBUSER === null || ADMINDBUSER === "") {
  throw "Set the following environment variable to run database-dependent tests\n" 
      + "WG_DBNAME - is the name of the test database\n"
      + "WG_DBUSER - is the user name of the test database\n"
      + "WG_DBPASS - is the user password of the test database\n"
      + "WG_ADMINDBNAME - is the name of the administrator database (usually postgres)\n"
      + "WG_ADMINDBUSER - is the administrator user name of the test database (usually postgres)\n"
      + "WG_ADMINDBPASS - is the administrator password of the test database\n";
}

const ADMINCNX = "postgres://" + ADMINDBUSER + ":" + ADMINDBPASS + "@localhost/" + ADMINDBNAME;
const ADMINCNX2 = "postgres://" + ADMINDBUSER + ":" + ADMINDBPASS + "@localhost/" + DBNAME;
const CNX = "postgres://" + DBUSER + ":" + DBPASS + "@localhost/" + DBNAME;

var db = new Database(CNX);




/**
 * Execute within the context of nobody
 */
asNobody = function(callback)       { var userContext = { authenticated:true, isAdmin:false, user:{uuid:'ab8f87ea-ad93-4365-bdf5-045fee58ee3b'}, rights:{admin:false} };  return callback(db, userContext); };

/**
 * Exectue within the context of an administrator named 'alex'
 */
asAlexAdmin = function(callback)    { var userContext = { authenticated:true, isAdmin:true,  user:{uuid:'dec4c80d-e0f4-4bd8-b64d-8425fe04e1ea'}, rights:{admin:true}  };  return callback(db, userContext); };


/**
 * Create / recreate the test database
 */
recreateDatabase = function(callback) {
  var adminDB = new Database(ADMINCNX);
  var adminDB2 = new Database(ADMINCNX2);

  var adminContext = { authenticated:true, user:{uuid:'ab8f87ea-ad93-4365-bdf5-045fee58ee3b'}, rights:{admin:true} };
  return asNobody(function(db, adminContext) {
    log.info("Recreating database");
    return adminDB.executeSQL(adminContext, [
      "DROP DATABASE IF EXISTS " + DBNAME,
      "CREATE DATABASE " + DBNAME + " LC_COLLATE 'en_US.utf8' LC_CTYPE 'en_US.utf8'",
    ], function(err) {
      if (err) return callback(err);

      return adminDB2.executeSQL(adminContext, [
        "GRANT ALL PRIVILEGES ON DATABASE " + DBNAME + " TO " + DBUSER,
        "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
      ], function(err) {
        if (err) return callback(err);

        log.info("Database created");


        // Core module
        return willieCoreModule.loadTextFile('sql/update.sql', function(err, update) {
          if (err) return callback(new Exception({module:module.moduleConfig.name}, "Failed to load update.sql file from module", err));
          return willieCoreModule.loadTextFile('sql/data.sql', function(err, data) {
            if (err) return callback(new Exception(undefined, "Failed to load data.sql file from module", err));
            var commands = [
              update,
              data,
              "INSERT INTO core_users (id, login, name, canLogin) VALUES ('dec4c80d-e0f4-4bd8-b64d-8425fe04e1ea',   'alex',     'Alexandre Morin',  true)",
            ];
            return db.executeSQL(adminContext, commands, function(err) {
              if (err) return callback(new Exception(undefined, "Failed to execute the database SQL update scripts of module", err));

              // Photos module (needed for fingerprints)
              return williePhotosModule.loadTextFile('sql/update.sql', function(err, update) {
                if (err) return callback(new Exception({module:module.moduleConfig.name}, "Failed to load update.sql file from module", err));
                return williePhotosModule.loadTextFile('sql/data.sql', function(err, data) {
                  if (err) return callback(new Exception(undefined, "Failed to load data.sql file from module", err));
                  var commands = [
                    update,
                    data
                  ];
                  return db.executeSQL(adminContext, commands, function(err) {
                    if (err) return callback(new Exception(undefined, "Failed to execute the database SQL update scripts of module", err));

                    // Miouzik module
                    return willieMiouzikModule.loadTextFile('sql/update.sql', function(err, update) {
                      if (err) return callback(new Exception({module:module.moduleConfig.name}, "Failed to load update.sql file from module", err));
                      return willieMiouzikModule.loadTextFile('sql/data.sql', function(err, data) {
                        if (err) return callback(new Exception(undefined, "Failed to load data.sql file from module", err));

                        var commands = [
                          update,
                          data,

                          // Two songs with the same artists but with different discogs IDs (see cleanupMultipleDiscogsArtistsIDs)
                          "INSERT INTO miouzik_songs (id, version, title, artist, album, year, trackNumber, discogsArtistId) VALUES ('ad3e907d-8da4-4713-aa24-b9d17d6897fb', 2, 'You Shook Me All Night Long',  'AC/DC',    'Back In Black',      1980,  7, 1993710);",
                          "INSERT INTO miouzik_songs (id, version, title, artist, album, year, trackNumber, discogsArtistId) VALUES ('f7a01164-19a8-4096-82cf-563e190bef19', 2, 'Given The Dog A Bone',         'AC/DC',    'Back In Black',      1980,  4, 84752);",

                          "INSERT INTO miouzik_songs (id, version, title, artist, album, year, trackNumber, discogsArtistId) VALUES ('fb86d0db-2a13-4317-b935-d8b1ceca332e', 2, 'Ethereal World',               'Krisiun',  'Works Of Carnage',   2003,  3, 62117);",
                          "INSERT INTO miouzik_songs (id, version, title, artist, album, year, trackNumber, discogsArtistId) VALUES ('f8b875b1-f563-43ff-be90-e99cc546c080', 2, 'Summon',                       'Krisiun',  'AssassiNation',      2006, 11, 1399840);"

                        ];
                        return db.executeSQL(adminContext, commands, function(err) {
                          if (err) return callback(new Exception(undefined, "Failed to execute the database SQL update scripts of module", err));
                          return callback();
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
}


/**
 * Setup database creation and deletion hooks
 */
function beforeAfter() {
  // Called once before executing tests
  before(function(done) {
    // Longer timeout because database creation can take a few seconds
    this.timeout(15000);
    return recreateDatabase(function(err) {
       return done(err);
    });
  });

  // Called once after executing tests
  after(function(done) {
    log.warn("Shutting down database");
    return Database.shutdown(function(err, stats) {
      if (err) log.warn({err:err}, "Failed to shutdown database");
      return done();
    });
  });

  // Executed before each test
  beforeEach(function(done) {
    return asNobody(function() {
      done();
    });
  });
}


/** ================================================================================
  * Public interface
  * ================================================================================ */
module.exports = {
  cnx:                CNX,
  db:                 db,
  beforeAfter:        beforeAfter,
  asNobody:           asNobody,
  asAlexAdmin:        asAlexAdmin
};
