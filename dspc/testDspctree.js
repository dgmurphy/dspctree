"use strict";

const DspcTree= require('./dspctree.js')
const DspcUtils = require('./dspcutils.js')
const fs = require('fs')

//const OSM_ELEMENTS_FILE = "./dspc/LosVientosRaw.json"
//const OSM_ELEMENTS_FILE = "./dspc/SurryZoomOSM.json"
const OSM_ELEMENTS_FILE = "./dspc/SurryRaw.json"
const OSM_TREE_OUT_FILE = "./dspc/SurryTree.json"
const DSPC_RENDER_FILE = "./dspc/SurryRender.txt"
//const OSM_TREE_OUT_FILE = "./dspc/LosVientosTree.json"


function checkDuplicates(renderTree) {

    console.log("RENDER TREE")
    
    let cleanLines = []

    var array = renderTree.split("\n");

    for(let i=0; i < array.length; ++i) {
        //console.log(array[i]);
        let cleanLine = array[i].replaceAll("----", "")
        cleanLines.push(cleanLine)
        //console.log(cleanLine)
    }    

    let dups = []
    for (let i=0; i < cleanLines.length; ++i) {
        let item = cleanLines[i]
        cleanLines[i] = "removed"
        if (cleanLines.includes(item))
            dups.push(item)
    }

    if (dups.length > 0) {
        console.log("DUPLICATES")
        for (let i=0; i<dups.length; ++i) {
            console.log(dups[i])
        }
    }
}

// Mock bounding box
const bbox = "(-32.847, -71.016, -32.840, -71.007)"

// Mock OSM Query
let osmResponse = DspcUtils.loadJs(OSM_ELEMENTS_FILE)

let outjson =   DspcTree.osmResponseToDspcTree(osmResponse, bbox)
DspcUtils.writeJs(OSM_TREE_OUT_FILE, outjson)


let renderTree = outjson.dspc_enhancements.comments
checkDuplicates(renderTree)

fs.writeFile(DSPC_RENDER_FILE, outjson.dspc_enhancements.comments, (err) => {

        if (err)
            console.log('Error writing file:', err)
        else
            console.log("Wrote " + DSPC_RENDER_FILE)
})

//console.log(outjson.dspc_enhancements.comments)
console.log("Done")