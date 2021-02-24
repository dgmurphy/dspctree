# DSPC Tree Package
Converts an OSM entity list JSON response into a heirarchical tree.

## Test
npm install

node dspc/testDspctree.js 

## TODO

Make OSM relations into Polygons

Save the Group relations out to a file for debugging

Print more metrics:
* Number of OSM entities in source file sorted by tag
* Number of Tree entities with children
* Number of Tree entities at the root
* Max depth of the tree
