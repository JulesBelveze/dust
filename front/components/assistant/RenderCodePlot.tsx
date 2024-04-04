import React from 'react'

const PLOTLY_SRC = 'https://cdn.plot.ly/plotly-latest.min.js'
const D3_SRC = 'https://d3js.org/d3.v6.min.js'

function detectLibrary(codeSnippet: string): 'plotly' | 'd3' {
    if (codeSnippet.includes('Plotly.newPlot') || codeSnippet.includes('Plotly.react')) {
        return 'plotly'
    } else if (codeSnippet.includes('d3.select') || codeSnippet.includes('d3.csv')) {
        return 'd3'
    }
    throw new Error('Could not detect library from code snippet.')
}

function generateIframeTemplate(codeSnippet: string, libSrc: string, hookComponent: string) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <script src="${libSrc}"></script>
        </head>
        <body>
            ${hookComponent}
            <script>
                ${codeSnippet}
            </script>
        </body>
        </html>
    `
}

function generateIframeContentD3(codeSnippet: string) {
    const svgWidth = 500
    const svgHeight = 500
    const hookComponent = `<svg width="${svgWidth}px" height="${svgHeight}px" id="agent-chart"></svg>`
    return generateIframeTemplate(codeSnippet, D3_SRC, hookComponent)
}

function generateIframeContentPlotly(codeSnippet: string) {
    const hookComponent = `<div id="agent-chart"></div>`
    return generateIframeTemplate(codeSnippet, PLOTLY_SRC, hookComponent)
}

function generateIframeContent(agentMessageContent: string) {
    const extractCodeRegex = /(?<=```javascript\n)[\s\S]*?(?=\n```)/
    const codeMatches = agentMessageContent.match(extractCodeRegex)

    if (codeMatches) {
        const codeSnippet = codeMatches[0]
        const library = detectLibrary(codeSnippet)
        if (library === 'plotly') {
            return generateIframeContentPlotly(codeSnippet)
        } else if (library === 'd3') {
            return generateIframeContentD3(codeSnippet)
        }
    }
}

export function PlotBlock({
    agentMessageContent
}: {
    agentMessageContent: string
}) {
    const iframeContent = generateIframeContent(agentMessageContent)
    return iframeContent ?
        <iframe style={{marginTop: "16px", width: "100%", height: "500px"}} sandbox="allow-scripts" srcDoc={iframeContent}></iframe> : null
}