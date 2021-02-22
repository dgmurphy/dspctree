const DspcTree= require('./dspctree.js')
const DspcUtils = require('./dspcutils.js')

const OSM_ELEMENTS_FILE = "./dspc/LosVientosRaw.json"
const OSM_TREE_OUT_FILE = "./dspc/LosVientosTree.json"

// Mock bounding box
const bbox = [ 
    -32.8479015806428,
    -71.01635456085205,
    -32.840798706369604,
    -71.0077178478241
]

// Mock OSM Query
let osmResponse = DspcUtils.loadJs(OSM_ELEMENTS_FILE)

outjson =   DspcTree.osmResponseToDspcTree(osmResponse, bbox)
DspcUtils.writeJs(OSM_TREE_OUT_FILE, outjson)

console.log(outjson.dspc_enhancements.comments)
console.log("Done")