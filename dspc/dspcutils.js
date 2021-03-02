"use strict";
const fs = require('fs')
const turf = require('@turf/turf')


/** Global to hold the labels for the recursive tree renderer */
let TREE_LIST = []   


/** The power entities that will be included in building the heirarchy
 * Note that 'pole' are not included so they will show up in the root,
 * as will anonymous nodes. */
const validTags = [
    "plant", 
    "substation",
    "station", 
    "generator", 
    "transformer",
    "line",
    "minor_line",
    "busbar",
    "portal",
    "switch"
]
exports.validTags = validTags


/**
 * OSMGroupNode is A class to hold the OSM Relations used to keep track 
 * of parent-child relationships e.g. between a substation and it's 
 * transformers. "Self" refers to the substation or station
 * and children is a list one or more child elements like transformers.
 */
class OSMGroupNode {

    constructor(groupData) {

        this.type = groupData.type
        this.id = groupData.id
        this.tags = groupData.tags
        this.children = []
        for (let i = 0; i < groupData.members.length; ++i) {
            let member = groupData.members[i]
            if (member.role === "self")
                this.self = member
            else if (member.role === "child")
                this.children.push(member)
        }
    }

    /** 
    * The unique id of the 'real' OSM node that I correspond to. OSM nodes are uniquely identified
    * by a combination of their element type (node|way|relation) and node id.*/
    getTargetNodeUID() {
        return this.type + this.ref.toString()   
    }

    /** Get the unique id for each 'real' OSM entity corresponding to each child */
    getChildUids() {

        let childUids = []
        this.children.forEach(function(child) {
            childUids.push(child.type + child.ref)
        })

        return childUids
    }
}
exports.OSMGroupNode = OSMGroupNode;


/** An OSM object made into a node used for making a tree */
class OSMTreeNode {

    constructor(osmdata) {

        this.uid = this.makeNodeUID(osmdata) //osmdata.type + osmdata.id.toString() 
        this.osmdata = osmdata;
        this.children = [];
    }

    /** Unique OSM IDs are formed by element type + element id */
    makeNodeUID(osmdata) {
        return osmdata.type + osmdata.id.toString()
    }

}
exports.OSMTreeNode = OSMTreeNode;


/**
 * RelationTranslator is used to build a turf.js polygon from
 * an OSM relation object consisting of ways.
 * Limitations:
 * - Only looks for 1 linear ring consisting of outer roles.
 *   If the relation has islands of polygons all but one will be ignored
 * - Inner roles are ignored so holes in the shape will be ignored. 
 * - If the relation uses nodes or other relations to define the shape
 *   then this will not work.
 * 
 */
class RelationTranslator {

    constructor(osmRelation, elements) {
      this.relation = osmRelation
      this.elements = elements
    }
    /** Get the OSM way for the given node ID */
    findWay(id) {
        for (let i = 0; i < this.elements.length; ++i) {
            if ((this.elements[i].id === id) && (this.elements[i].type === "way"))
                return this.elements[i]
        }    
    }

    /** Get the index of the given node in the list of ways */
    getIndexOfWay(node, ways) {

        for (let i = 0; i < ways.length; ++i) {
    
            let nodes = ways[i].nodes
    
            if (nodes[0] === node) {  
                return { "idx": i, "pos": "start"}
            }
            else if (nodes[nodes.length - 1] === node) {
                return { "idx": i, "pos": "end"}
            }
        }
    }    

    /** Make the turf polygon and return it */
    getPolygon(relation) {

        let members = relation.members

        // Ignore inner ways 
        // Collect all members that are outer ways
        let ways = []
        let self = this
        members.forEach(function(mem) {
            if ((mem.type === "way") && (mem.role === "outer")) {
                let way = self.findWay(mem.ref, self.elements)
                ways.push(way)
            } else {
                console.log("WARN: Not all relation members are outer ways.")
            }    
        })

        console.log("Found " + ways.length + " outer ways")

        let wayRing = []
        let way = ways.shift()
        let startNode = way.nodes[0]
        let nextNode = way.nodes[way.nodes.length - 1]
        wayRing.push(way)

        while (nextNode !== startNode) {
            // get the way that has the next node
            let idxPos = this.getIndexOfWay(nextNode, ways)
            let nextWay = ways.splice(idxPos.idx, 1)[0]
            if (idxPos.pos === "end")
                nextWay.nodes.reverse()  // node on wrong end
            wayRing.push(nextWay)
            nextNode = nextWay.nodes[nextWay.nodes.length - 1]
        }

        let ringNodes = []
        for (let i = 0; i < wayRing.length; ++i) {
            for (let j = 0; j < wayRing[i].nodes.length; ++j)
                ringNodes.push(wayRing[i].nodes[j])
        }

        let longLats =[]
        for (let i = 0; i < ringNodes.length; ++i) {
            let node = ringNodes[i]
            longLats[i] = getLongLat(node, this.elements)
        }

        let rprops = { type: "relation", id: relation.id, power: ""}
        if (relation.hasOwnProperty("tags"))
            if(relation.tags.hasOwnProperty("power"))
                rprops.power = relation.tags.power

        let tpoly  = turf.polygon([longLats], rprops)

        return tpoly
    }

}
exports.RelationTranslator = RelationTranslator;


/** 
 * Random ID for the new OSM group relations that are synthesized
 * by these routines. Needs to be unique but that is not enforced here.
 * Just hoping the large number will not collide. 
 * 
 * @returns {string} Large random string of digits
 */
function generateNodeID() {
    return ( Math.random().toString().slice(2) + "0000" ) 
}
exports.generateNodeID = generateNodeID;


/** 
 * Given a properties object return the unique ID which
 * is the element type (e.g. way) and the id.
 * 
 * @param {json} props The json object with the type and id in it
 * @returns {string} The unique ID e.g. way876281890
 */
function getUID(props) {
    return props.type + props.id
}
exports.getUID = getUID;


/**
 * Get an object with eltype (e.g. node|way|relation)
 * and the id as seperate keys.
 * 
 * @param {string} uid
 * @returns {json} An object with eltype and id as keys 
 */
function getTypeAndIDFromUID(uid) {
    // types are node, relation, way
    if (uid[0] === 'n')
        return { "eltype": "node", "id":uid.substring(4) }
    if (uid[0] === 'w')
        return { "eltype": "way", "id":uid.substring(3) }
    if (uid[0] === 'r')
        return { "eltype": "relation", "id":uid.substring(8) }
}
exports.getTypeAndIDFromUID = getTypeAndIDFromUID;


/**
 * Load a JSON file and return a JSON object.
 * 
 * @param {string} jsfile The filename of the JSON input file
 * @returns {json} the JSON object
 */
function loadJs(jsfile) {

    try {
        const jstring = fs.readFileSync(jsfile) 
        let jsdata = JSON.parse(jstring)
        return jsdata

    } catch (err) {
        console.log(err)
        return
    }

}
exports.loadJs = loadJs;


/**
 * Write JSON object to a file.
 * 
 * @param {string} fname 
 * @param {json} jstring 
 */
// function writeJs(fname, js) {

//     fs.writeFile(fname, JSON.stringify(js, null, 2), (err) => {
//         if (err)
//             console.log('Error writing file:', err)
//         else
//             console.log("Wrote " + fname)
//     })
// }
// exports.writeJs = writeJs;


/**
 * Given a tree of nodes return the one with the given id.
 * 
 * @param {tree} nodes 
 * @param {string} uid 
 * @returns {object} the matching node
 */
function findNode(nodes, uid) {

    let match 
    let found = false
    function recurse(nodes) {
        for (let i = 0; i < nodes.length; ++i) {
            let node = nodes[i]
            if (node.uid === uid) {
                match = node
                found = true
                break
            } else {
                recurse(node.children)
            }
        }
    }

    if (!found)
        recurse(nodes)

    if(!match) 
        console.log("WARNING: element " + uid + " is missing.")

    return match
}
exports.findNode = findNode;


/**
 * Add a node with the given child ID to the parent
 * of the given ID in the given nodes tree
 * 
 * @param {tree} nodes 
 * @param {string} parentUid 
 * @param {string} childUid 
 */
function addChild(nodes, parentUid, childUid) {

    let parentNode = findNode(nodes, parentUid)
    let childNode = findNode(nodes, childUid)
    try {
        parentNode.children.push(childNode)
    } catch (error) {
        console.log("Error in addChild. Parent = " + parentUid + " Child " + childUid)
        console.log(error)
    }
}
exports.addChild = addChild;


/**
 * Return the power tag for the given OSM element
 * @param {json} osmElement 
 * @returns {string} the power tag
 */
function getPowerTag(osmElement) {

    if (osmElement.hasOwnProperty("tags")) 
        if (osmElement.tags.hasOwnProperty("power"))
            return osmElement.tags.power

    return null
}
exports.getPowerTag = getPowerTag


/**
 * Return the lon, lat for the element with given id
 * 
 * @param {Object} id 
 * @param {array} elements 
 * @returns {array} a long, lat pair
 */
function getLongLat(id, elements) {

    for (let i = 0; i < elements.length; ++i) {
        let el = elements[i]
        if (el.id === id)
            return [el.lon, el.lat]
    }
}
exports.getLongLat = getLongLat;


/**
 * Get all the lon/lats in a way. Used for building a Turf
 * polygon from an OSM way.
 * 
 * @param {OSM Element} wayEl 
 * @param {array} elements OSM elements
 * @returns {array} List of lon,lat pairs
 */
function getLongLats(wayEl, elements) {

    let longLats = []
    for (let i = 0; i < wayEl.nodes.length; i++) {
        let node = wayEl.nodes[i]
        longLats[i] = getLongLat(node, elements)
    }     

    return longLats
}
exports.getLongLats = getLongLats;


/**
 * Convenience function for building an object
 * 
 * @param {*} el 
 * @param {*} type e.g. node, way, relation
 */
function makeProps(el, type) {

    let props = {
        "type": type,
        "id": el.id,
        "power": ""
    }

    if(el.hasOwnProperty("tags"))
        props.power = el.tags.power

    return props
}


/**
 * Build a Turf LineString from a non-closed way
 * 
 * @param {OSM element} wayEl 
 * @param {array} elements
 * @returns {LineString} a Turf linestring 
 */
function makeLineStringFromWay(wayEl, elements) {

    let longLats = getLongLats(wayEl, elements)
    return turf.lineString(longLats, makeProps(wayEl, "way"))

}
exports.makeLineStringFromWay = makeLineStringFromWay;


/**
 * Build a Turf Polygon from a closed way
 * 
 * @param {OSM element} wayEl 
 * @param {array} elements
 * @returns {Polygon} a Turf polygon 
 */
function makePolyFromClosedWay(wayEl, elements) {

    let longLats = getLongLats(wayEl, elements)
    return turf.polygon([longLats], makeProps(wayEl, "way"))
}
exports.makePolyFromClosedWay = makePolyFromClosedWay



/**
 * Make a Turf point object from an OSM node element
 * @param {OSM node} nodeEl 
 * @returns {point} a Turf point
 */
function makePointFromNode(nodeEl) {

    let tpoint = turf.point([nodeEl.lon, nodeEl.lat], makeProps(nodeEl, "node"))
    return tpoint
}
exports.makePointFromNode = makePointFromNode;


/**
 * Make a Turf Linestring from an open way or a polygon
 * from a closed way
 * @param {OSM way} wayEl 
 * @param {array} elements
 * @returns {object} Turf linestring or polygon 
 */
function makeTurfFromWay(wayEl, elements) {
    // is it a closed way?
    if (wayEl.nodes[0] === wayEl.nodes[wayEl.nodes.length - 1])
        return makePolyFromClosedWay(wayEl, elements)
    else    
        return makeLineStringFromWay(wayEl, elements)
}


/**
 * Build the Turf object based on the type of OSM element.
 *
 * 
 * @param {object} osmEl OSM element 
 * @param {array} elements list of OSM elements 
 * @returns {object} Turf object
 */
function makeTurfObjectFromOSMelement(osmEl, elements) {

    let tobj

    switch(osmEl.type) {
        case "node":
          tobj = makePointFromNode(osmEl)
          break;
        case "way":
          tobj = makeTurfFromWay(osmEl, elements)
          break;
        case "relation":
          let rt = new RelationTranslator(osmEl, elements)
          tobj = rt.getPolygon(osmEl)
          break;
        default:
          // code block
      }    

      return tobj
}
exports.makeTurfObjectFromOSMelement = makeTurfObjectFromOSMelement;


/**
 * Returns the list of UIDs of objects overlapped by parent
 * @param {object} parent Turf object prospective parent
 * @param {array} turfObjects List of all prospective children
 * @returns {array} list of contained object UIDs for this parent
 */
function getContainedObjectUIDs(parent, turfObjects) {

    let all_contains = []
    turfObjects.forEach(function(tobj){

        // skip checking self
        if (getUID(parent.properties) !== getUID(tobj.properties)) {
            // turf function to check if one geometry contains another
            if (turf.booleanContains(parent, tobj)) {
                all_contains.push(getUID(tobj.properties))
            }
        }
    })

    return all_contains
}
exports.getContainedObjectUIDs = getContainedObjectUIDs;


/**
 * Find the area that matches the given uid
 * @param {string} uid 
 * @param {array} areas 
 * @returns {object} the area that matches this uid
 */
function getGroupByUID(uid, areas) {

    for (let i = 0; i < areas.length; ++i) {
        if (areas[i].uid === uid)
            return areas[i]
    }

}
exports.getGroupByUID = getGroupByUID;


/**
 * An area is an element that may contain children. This checks
 * to see if a given area's contained children has the given id
 * @param {object} area 
 * @param {string} uid
 * @returns {boolean} true if the area contains the uid 
 */
function checkContains(area, uid) {

    //console.log("Checking if " + group.name + " contains " + name)
    for (let i = 0; i < area.all_contains.length; ++i) {
        if (area.all_contains.includes(uid))
            return true
    }

    return false

}
exports.checkContains = checkContains;


/**
 * A convenience function to build names for OSM elements.
 * @param {object} node
 * @returns {string} A human readable node label 
 */
function getNodeRenderLabel(node) {

    let label = node.osmdata.type + " " + node.osmdata.id.toString() + " "
    if (node.osmdata.hasOwnProperty("tags")) {
        if (node.osmdata.tags.hasOwnProperty("name"))
            label += node.osmdata.tags.name + " "
        if (node.osmdata.tags.hasOwnProperty("power"))
            label += node.osmdata.tags.power
    }

    return label
}
exports.getNodeRenderLabel = getNodeRenderLabel


/**
 * Builds a human-readable indented tree of the interesting nodes
 * for debug purposes. Uses a global TREE_LIST to store 
 * the strings since this is a recursive function.
 * 
 * @param {object} node 
 * @param {int} depth 
 */
function renderTree(node, depth) {
    
    let indent = ""
    for (let i = 0; i < depth; ++i) 
        indent += "+"

    let powertag = getPowerTag(node.osmdata)
    let label = getNodeRenderLabel(node)

    // render only interesting nodes
    if (validTags.includes(powertag)) {
        let indentedLabel = indent + label
        //console.log(indentedLabel)
        TREE_LIST.push(indentedLabel)
    }
        
    depth += 1

    for (let i = 0; i < node.children.length; ++i)
        renderTree(node.children[i], depth)

}
exports.renderTree = renderTree;

/**
 * Renders the entity tree as a single string.
 * @param {tree} roots The roots of the tree
 * @returns {string} The tree as a single string with carriage returns 
 */
// Human readable render of the key elements in the tree
function buildTreeString(roots) {

    roots.forEach(function(root) {
        renderTree(root, 0, [])
    })

    let treeString = "KEY ENTITIES:\n"
    TREE_LIST.forEach(function(item){
        treeString += item + "\n"
    })

    return treeString
}
exports.buildTreeString = buildTreeString;

/** 
 * Debug routine to write a groups file containing only 
 * parents that have children
 */
function saveGroups(osmGroups) {

    let grpsWithChildren = []
    osmGroups.groups.forEach(function(group) {
        let hasChildren = false
        group.members.forEach(function(member) {
            if (member.role === "child")
                hasChildren = true
        })
        if (hasChildren)
            grpsWithChildren.push(group)
    })

    //writeJs("./dspc/DSPCgroups.json", grpsWithChildren)
}
exports.saveGroups = saveGroups;
