# DSPC Tree Package
Converts an OSM entity list JSON response into a heirarchical tree based on which OSM power elements physically contain child elements, such as a power plant containing a generator or a substation containing a transformer. Non-power entities, anonymous nodes, and 'poles' are left as roots rather than trying to assign them to some parent.

## Test
npm install
node dspc/testDspctree.js 