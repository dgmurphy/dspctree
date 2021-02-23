const turf = require('@turf/turf')
const DspcUtils = require('./dspc/dspcutils.js')


class RelationTranslator {

    constructor(osmRelation, elements) {
      this.relation = osmRelation
      this.elements = elements
    }
    
    findWay(id) {
        for (let i = 0; i < this.elements.length; ++i) {
            if ((this.elements[i].id === id) && (this.elements[i].type === "way"))
                return this.elements[i]
        }    
    }

    getIndexOfWay(node, ways) {

        for (let i = 0; i < ways.length; ++i) {
    
            let nodes = ways[i].nodes
    
            if (nodes[0] === node) {  
                return { "idx": i, "pos": "start"}
            }
            else if (nodes[nodes.length - 1] == node) {
                return { "idx": i, "pos": "end"}
            }
        }
    }    

    getPolygon() {

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

        let mergedWay = {
            "type": "way",
            "id": 1,
            "nodes": []
        }

        for (let i = 0; i < wayRing.length; ++i) {
            for (let j = 0; j < wayRing[i].nodes.length; ++j)
                mergedWay.nodes.push(wayRing[i].nodes[j])
        }

        let tpoly = DspcUtils.makePolyFromClosedWay(mergedWay, this.elements)

        return tpoly
    }

}

RELATION_FILE = "./data/OSMSurreyRelation.json"

let osmResponse = DspcUtils.loadJs(RELATION_FILE)
let elements = osmResponse.elements
let relations = []
for (let i = 0; i < elements.length; ++i) {
    if (elements[i].type === "relation") 
        relations.push(elements[i])
}

relation = relations[0]  // do 1 for now

let rt = new RelationTranslator(relation, elements)
tpoly = rt.getPolygon()

DspcUtils.writeJs("tpoly.json", tpoly)

let testgeo = DspcUtils.loadJs("testgeo.json")
console.log("CW Winding: " + turf.booleanClockwise(testgeo))

let rw = turf.rewind(tpoly)
console.log("CW Winding: " + turf.booleanClockwise(rw))

var point = turf.point([-76.69019222259521, 37.16380500069709]);
console.log("Contains: " + turf.booleanContains(tpoly, point))
console.log("Contains: " + turf.booleanContains(rw, point))