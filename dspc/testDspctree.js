"use strict";

const DspcTree= require('./dspctree.js')
const DspcUtils = require('./dspcutils.js')

//const OSM_ELEMENTS_FILE = "./dspc/LosVientosRaw.json"
const OSM_ELEMENTS_FILE = "./dspc/SurryZoomOSM.json"
const OSM_TREE_OUT_FILE = "./dspc/LosVientosTree.json"

// Mock bounding box
const bbox = "(-32.847, -71.016, -32.840, -71.007)"

// Mock OSM Query
let osmResponse = DspcUtils.loadJs(OSM_ELEMENTS_FILE)

let outjson =   DspcTree.osmResponseToDspcTree(osmResponse, bbox)
//DspcUtils.writeJs(OSM_TREE_OUT_FILE, outjson)

console.log(outjson.dspc_enhancements.comments)
console.log("Done")