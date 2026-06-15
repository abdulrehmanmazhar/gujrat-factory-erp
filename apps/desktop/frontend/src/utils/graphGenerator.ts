// import { v4 as uuidv4 } from 'uuid';

// Types
interface GraphNode {
    id: string
    data: unknown
    position: {
        x: number
        y: number
    }
    type: 'playwrightAction'
}

interface GraphEdge {
    id: string
    source: string
    target: string
    type: 'customEdge'
}

interface Graph {
    nodes: GraphNode[]
    edges: GraphEdge[]
}

// /**
//  * Converts NDJSON content into a linear graph structure
//  * @param ndjsonContent - String containing NDJSON content (each line is a JSON object)
//  * @param startPosition - Optional starting position for the first node (default: { x: 0, y: 0 })
//  * @param horizontalSpacing - Optional horizontal spacing between nodes (default: 300)
//  * @returns Graph object with nodes and edges
//  */
// export function ndjsonToLinearGraph(
//     ndjsonContent: string,
//     startPosition: { x: number; y: number } = { x: 0, y: 0 },
//     horizontalSpacing: number = 300
// ): Graph {
//     // Split content by lines and filter out empty lines
//     const lines = ndjsonContent
//         .trim()
//         .split('\n')
//         .filter((line) => line.trim())

//     if (lines.length === 0) {
//         return { nodes: [], edges: [] }
//     }

//     // Parse each line as JSON
//     const entries: unknown[] = []
//     for (const line of lines) {
//         try {
//             entries.push(JSON.parse(line))
//         } catch (error) {
//             console.error(`Failed to parse line: ${line}`, error)
//             throw new Error(`Invalid JSON at line: ${line}`)
//         }
//     }

//     // Create nodes
//     const nodes: GraphNode[] = entries.map((entry, index) => ({
//         id: uuidv4(),
//         data: entry,
//         position: {
//             x: startPosition.x + index * horizontalSpacing,
//             y: startPosition.y
//         },
//         type: 'playwrightAction'
//     }))

//     // Create edges connecting consecutive nodes
//     const edges: GraphEdge[] = []
//     for (let i = 0; i < nodes.length - 1; i++) {
//         edges.push({
//             id: uuidv4(),
//             source: nodes[i].id,
//             target: nodes[i + 1].id,
//             type: 'customEdge'
//         })
//     }

//     return { nodes, edges }
// }

export function dataArrayToLinearGraph(
    dataArray: unknown[],
    startPosition: { x: number; y: number } = { x: 0, y: 0 },
    horizontalSpacing: number = 300
): Graph {
    if (dataArray.length === 0) {
        return { nodes: [], edges: [] }
    }

    // Create nodes
    const nodes: GraphNode[] = dataArray.map((data, index) => ({
        id: crypto.randomUUID(),
        data: data,
        position: {
            x: startPosition.x + index * horizontalSpacing,
            y: startPosition.y
        },
        type: 'playwrightAction'
    }))

    // Create edges connecting consecutive nodes
    const edges: GraphEdge[] = []
    for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
            id: crypto.randomUUID(),
            source: nodes[i].id,
            target: nodes[i + 1].id,
            type: 'customEdge'
        })
    }

    return { nodes, edges }
}
