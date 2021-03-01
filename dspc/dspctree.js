"use strict";
const DspcUtils = require('./dspcutils.js')

/**
 * osmResponseToDspcTree returns a heirarchy of OSM enties is json format. This is main
 * function of this collection of routines. The heirarchy is determined by which elements
 * are physically entirely within the boundary of another element. For multiple concentric
 * elements the children are only added to their immediate parent.
 *
 * @param {json} osmResponse An OSM response object for a map query that returns a list of entities
 * @param {array} bbox Coordinates of the bounding box
 * @returns {json} The OSM entities in a heirarchy based on their physical overlap
 * 
 */
function osmResponseToDspcTree(osmResponse, bbox) {

    let osmElementsList = osmResponse.elements
    let osmElementsMeta = {
        "version": osmResponse.version,
        "generator": osmResponse.generator,
        "osm3s": osmResponse.osm3s
    }

    let osmAreas = buildOSMAreas(osmElementsList)  // list of areas and items inside

    if(osmAreas.length === 0)
        return null

    let osmGroups = buildOSMGroups(osmAreas)   // parent-children relations
    // Debug: Write Groups to File
    //DspcUtils.saveGroups(osmGroups)


    let osmGroupsList = osmGroups.groups 
    let osmGroupsMeta = { "generator": osmGroups.generator }

    // All the nodes start as roots (no parents)
    let osmRootNodes = []
    osmElementsList.forEach(function(osmData){
        let dnode = new DspcUtils.OSMTreeNode(osmData)
        osmRootNodes.push(dnode)
    })

    // Make the groups into OSMGroupNode instances
    let osmGroupNodes = []
    osmGroupsList.forEach(function(groupData) {
        let dgroup = new DspcUtils.OSMGroupNode(groupData)
        osmGroupNodes.push(dgroup)
    })

    // Reparent based on the groups data
    //   Reverse for loop since we will be slicing
    for (let i = osmRootNodes.length - 1; i >= 0; i -= 1) {  
        
        let dnode = osmRootNodes[i]

        // find my parent if I have one
        osmGroupNodes.forEach(function(grp) {
            // get parent & child uids
            let parentUid = grp.self.type + grp.self.ref
            let childUids = grp.getChildUids()

            // Reparent me if my uid appears in the children
            if (childUids.includes(dnode.uid)) {
                DspcUtils.addChild(osmRootNodes, parentUid, dnode.uid)
                osmRootNodes.splice(i, 1) // node was moved under another parent
            }
        })
    }
    
    let treeString = DspcUtils.buildTreeString(osmRootNodes)
    let dspcTreeJson = buildEnhancedOSMjson(osmElementsMeta, osmGroupsMeta, osmRootNodes, treeString, bbox)
    
    return dspcTreeJson    

}
exports.osmResponseToDspcTree = osmResponseToDspcTree;


/**
 * buildOSMGroups is a high-level routine that builds valid OSM 'relations' elements
 * that DSPC will use to transform the flat OSM response into a heirarchy of
 * objects that contain other objects. The 'areas' object is a temporary compact
 * entity that just has the UIDs of the elements. The osmGroups object has a slightly more
 * complex structure that expresses valid OSM relations.
 *
 * @param {Object} osmAreas The list if elements that contain other elements
 * @returns {json}  Valid OSM relations elements expressing the heirarchy
 */
function buildOSMGroups(osmAreas) {

    let osmGroups = {
        "generator": "dspctree.buildOSMGroups",
        "groups": []
    }

    for (let i = 0; i < osmAreas.length; ++i) {

        let group = {
            "type": "relation",
            "id": DspcUtils.generateNodeID(),
            "members":[]
        }

        let osmArea = osmAreas[i]
        let typeAndID = DspcUtils.getTypeAndIDFromUID(osmArea.uid)
        
        // add the parent member
        let member = {
            "type": typeAndID.eltype,
            "ref": typeAndID.id,
            "role": "self"
        }
        group.members.push(member)

        // add the child members
        for (let j = 0; j < osmArea.contains.length; ++j) {
            typeAndID = DspcUtils.getTypeAndIDFromUID(osmArea.contains[j])
            member = {
                "type": typeAndID.eltype,
                "ref": typeAndID.id,
                "role": "child"
            }
            group.members.push(member)
        }

        // add the group tags
        group.tags = { "dspc_group": "Group: " + osmArea.uid + " " + osmArea.powerTag }

        osmGroups.groups.push(group)
    }

    return osmGroups
}


/**
 * buildEnhancedOSMjson adds the metadata and other header data to the element heirarchy
 *
 * @param {json} osmElementsMeta metadata from the OSM response
 * @param {json} osmGroupsMeta metadata from the process that created the OSM parent-children groups
 * @param {json} osmRootNodes the element hierarchy (with mutliple root nodes)
 * @param {string} treeString a human-readable trucated version of the hierarchy showing only key elements
 * @param {array} bbox the map box of the query that generated the OSM response
 * @returns {json} An 'enhanced' version of the OSM response with heirarchical entities and dspc meta-data
 * 
 */
function buildEnhancedOSMjson(osmElementsMeta, osmGroupsMeta, osmRootNodes, treeString, bbox) {
    
    const timeElapsed = Date.now();
    const today = new Date(timeElapsed);

    let jsobj = {
        "osm_version": osmElementsMeta.version,
        "osm_generator": osmElementsMeta.generator,
        "osm3s": osmElementsMeta.osm3s,
        "dspc_enhancements": {
            "query_bbox": bbox,
            "enhancements_timestamp": today.toISOString(),
            "generator": osmGroupsMeta.generator,
            "comments": treeString // tree render of the major entities
        },
        "elements": osmRootNodes
    }

    return jsobj
}


/**
 * buildTurfObjects turns OSM elements into Turf (GeoJSON) objects so we can
 * use the Turf functions to see which elements are contained by other elements.
 * Only objects that have the desired power tags are included. Anonymous nodes
 * or 'pole' nodes are not included. TODO (allow 'pole' nodes?)
 *
 * @param {json} osmElementsList the source OSM elements
 * @returns {json} Turf objects corresponding to the OSM elements
 * 
 */
function buildTurfObjects(osmElementsList) {

    let turfObjects = []

    osmElementsList.forEach(function(el){
        let powerTag = DspcUtils.getPowerTag(el)
        if (DspcUtils.validTags.includes(powerTag)) {     
            // process only elements w/ power tag
            let tobj = DspcUtils.makeTurfObjectFromOSMelement(el, osmElementsList)
            turfObjects.push(tobj) 
        }
    })

    return turfObjects
}


/**
 * buildAreas returns a data structure that shows which Turf objects 
 * contain other Turf objects. Elements that are contained by concentric
 * parents will show as children of all ancestors as this point. 
 * The parenting will be flattened later.
 *
 * @param {Object} turfObjects the list of Turf objects to be used for parenting
 * @returns {json} A list of children for each parent 
 * 
 */ 
function buildAreas(turfObjects) {

    let areas = []

    let siblings = JSON.parse(JSON.stringify(turfObjects)) // deep copy

    while (siblings.length > 0) {
        let tobject = siblings.pop()
        let area = {
            "uid": DspcUtils.getUID(tobject.properties),
            "powerTag": tobject.properties.power,
            "all_contains": [] // all descendants
        }

        // Polygons or Multipolygons may 'contain' other objects
        if (tobject.geometry.type.includes("Polygon" )) {
            area.all_contains = DspcUtils.getContainedObjectUIDs(tobject, turfObjects)
        }

        areas.push(area)
    }

    return areas
}



/**
 * makeParentChildren takes the areas list and flattens it so each parent
 * only lists it's immediate children. This structure is later used
 * to build the tree of OSM elements.
 *
 * @param {Object} areas the list of parents and ALL elements inside them
 * @returns {json} The flattened parent-immediate-children-only heirarchy
 * 
 */ 
function makeParentChildren(areas) {

    areas.forEach(function(area){

        let all_contains = area.all_contains
        let contains = [] // only my direct children 

        for (let i = 0; i < all_contains.length; ++i) {
            
            let child = all_contains[i]
            
            // Make a list of my siblings in the contains array
            var siblings = all_contains.filter(e => e !== child)

            // Check if any of my siblings contain me
            let sibContainsMe = false
            
            for (let j = 0; j < siblings.length; ++j) {
                let sibGroup = DspcUtils.getGroupByUID(siblings[j], areas)
                //console.log("checking if " + sibGroup.name + " contains " + child)
                sibContainsMe = DspcUtils.checkContains(sibGroup, child)  
                if(sibContainsMe)   // if any sib contains me stop checking
                    break
            }

            if (!sibContainsMe)
                contains.push(child)
        }

        area.contains = contains

    })

    areas.forEach(function (area) {
        delete area.all_contains
    })

    return areas
}


/**
 * buildOSMAreas is a high-level routine that calls a series of functions to 
 * build the objec that identifies children of all entities that are areas.
 *
 * @param {json} osmElementsList the original OSM elements from the query response.
 * @returns {Object} The areas with paren-immediate-children-only heirarchy 
 */
function buildOSMAreas(osmElementsList) {

    let turfObjects = buildTurfObjects(osmElementsList)
    let areas = buildAreas(turfObjects)
    let areasParentChildren = makeParentChildren(areas)

    //DspcUtils.writeJs("out.json", areasParentChildren)

    return areasParentChildren
}











