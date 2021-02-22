# DSPC Tree Package
Converts an OSM entity list JSON response into a heirarchical tree based on which OSM power elements physically contain child elements, such as a power plant containing a generator or a substation containing a transformer. Non-power entities, anonymous nodes, and 'poles' are left as roots rather than trying to assign them to some parent.

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
* Any power tags found that were not used for tree-building?