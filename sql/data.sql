--------------------------------------------------------------------------------
-- willie-miouzik - Builtin data
--------------------------------------------------------------------------------

-- Because we use the release id "0" to mean Discogs release not found
-- instead of not even searched (NULL)
DELETE FROM miouzik_discogs_releases WHERE id = 0;
INSERT INTO miouzik_discogs_releases (id, release) VALUES (0, '{"id":0}');
DELETE FROM miouzik_discogs_artists WHERE id = 0;
INSERT INTO miouzik_discogs_artists (id, artist) VALUES (0, '{"id":0}');