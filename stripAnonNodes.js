"use strict";
 
const DspcUtils = require('./dspc/dspcutils.js')

let IN_FILE = "./dspc/SurryZoomOSMconcise.json"

let inJson = DspcUtils.loadJs(IN_FILE)
let powerElements = []
let numRemoved = 0
for (let i = 0; i < inJson.elements.length; ++i) {
    let el = inJson.elements[i]
    if(el.hasOwnProperty("tags")) 
        if(el.tags.hasOwnProperty("power"))
            powerElements.push(el)
        else  {
            numRemoved += 1
            console.log("type: " + el.type + " id: " + el.id)
        }

}

let outJson = inJson
outJson.elements = powerElements

DspcUtils.writeJs("noAnons.json", outJson)
console.log("Removed : " + numRemoved)