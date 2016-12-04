--------------------------------------------------------------------------------
-- willie-miouzik - Update database structure
--------------------------------------------------------------------------------

DO $$
DECLARE
  ver varchar;
BEGIN
  EXECUTE 'SELECT value FROM core_options WHERE name = ''miouzik.databaseVersion''' INTO ver;

  LOOP

    RAISE NOTICE '[Module miouzik] Database version is %', ver;

  --------------------------------------------------------------------------------
  -- Version 0, create the option
  --------------------------------------------------------------------------------
  IF ver IS NULL or ver = '0.0' THEN
      INSERT INTO core_options (name, value, builtin) VALUES ('miouzik.databaseVersion', '0.0', true);
      ver = '1.0';

  --------------------------------------------------------------------------------
  -- Version 1, create the songs table
  --------------------------------------------------------------------------------
  ELSIF ver = '1.0' THEN
    CREATE TABLE miouzik_songs (
      id                    uuid primary key,                                  -- unique identifier (matches the fingerprint key)
      version               integer DEFAULT 0,                                 -- version of the record
      -- Song information
      title                 varchar(1024) NOT NULL,                            -- the song title
      artist                varchar(1024) NOT NULL,                            -- the album artist
      album                 varchar(1024) NOT NULL,                            -- the album name
      year                  integer,                                           -- the year the album was released
      trackNumber           integer,                                           -- the track number in the album
      genre                 varchar(128),                                      -- the musical genre
      durationInSeconds     integer DEFAULT 0,                                 -- song duration in seconds
      cover                 varchar(1024),                                     -- an URL to the cover
      tagMTime              timestamp with time zone,                          -- file modification time (at the time we scanned for the ID3 tag)
      -- Statistics
      likes                 integer DEFAULT 0,                                 -- number of likes
      playCount             integer DEFAULT 0,                                 -- number of times the song was played
      -- Discogs information
      discogsReleaseId      integer,                                           -- Discogs release id
      discogsArtistId       integer                                            -- Discogs artist id
    );
    ver = '1.1';
    ELSIF ver = '1.1' THEN
      CREATE INDEX miouzik_songs_aa ON miouzik_songs (artist, album);
      ver = '2.0';

  --------------------------------------------------------------------------------
  -- Version 2, create Discogs table (cache discogs releases)
  --------------------------------------------------------------------------------
  ELSIF ver = '2.0' THEN
    CREATE TABLE miouzik_discogs_queries (
      query                 varchar(512) NOT NULL,                             -- cached discogs query
      result                jsonb NOT NULL                                     -- cached discogs query result
    );
    ver = '2.1';
    ELSIF ver = '2.1' THEN
      CREATE UNIQUE INDEX miouzik_discogs_queries_q ON miouzik_discogs_queries (query);
      ver = '2.2';
    ELSIF ver = '2.2' THEN
      CREATE TABLE miouzik_discogs_releases (
        id                  bigint PRIMARY KEY,                                -- release id
        release             jsonb NOT NULL                                     -- release (JSON)
      );
      ver = '2.3';
    ELSIF ver = '2.3' THEN
      CREATE UNIQUE INDEX miouzik_discogs_releases_id ON miouzik_discogs_releases (id);
      ver = '2.4';
    ELSIF ver = '2.4' THEN
      CREATE TABLE miouzik_discogs_artists (
        id                  bigint PRIMARY KEY,                                -- release id
        artist              jsonb NOT NULL                                     -- release (JSON)
      );
      ver = '2.5';
    ELSIF ver = '2.5' THEN
      CREATE UNIQUE INDEX miouzik_discogs_artists_id ON miouzik_discogs_releases (id);
      ver = '3.0';

    ELSE
      EXIT;
    END IF;

  END LOOP;

  UPDATE core_options SET value = ver WHERE name = 'miouzik.databaseVersion';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '% - %', SQLSTATE, SQLERRM;
  UPDATE core_options SET value = ver WHERE name = 'miouzik.databaseVersion';
END $$;

