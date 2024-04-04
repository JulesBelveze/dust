import React, {useEffect, useState} from 'react';

const PLOTLY_SRC = 'https://cdn.plot.ly/plotly-latest.min.js';
const D3_SRC = 'https://d3js.org/d3.v6.min.js';

function importScript(src: string, onLoad: () => void) {
    if ((src === PLOTLY_SRC && window.Plotly) || (src === D3_SRC && window.d3)) {
        onLoad();
        return;
    }

    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
        existingScript.addEventListener('load', onLoad);
        return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', onLoad);
    document.head.appendChild(script);
}

function executeCode(codeSnippet: string, plotId: string) {
    const extractCodeRegex = /(?<=```javascript\n)[\s\S]*?(?=\n```)/;
    const codeMatches = codeSnippet.match(extractCodeRegex);

    if (codeMatches) {
        const codeToEvaluate = codeMatches[0].replace(/'agent-chart'/g, `'${plotId}'`);
        const library = detectLibrary(codeToEvaluate);
        const onLoad = () => {
            if (library === 'plotly') {
                executePlotlyCode(codeToEvaluate, plotId);
            } else if (library === 'd3') {
                executeD3Code(codeToEvaluate, plotId);
            }
        };

        if (library === 'plotly') {
            importScript(PLOTLY_SRC, onLoad);
        } else if (library === 'd3') {
            importScript(D3_SRC, onLoad);
        }
    } else {
        console.error('Cannot identify a code snippet.');
    }
}

function detectLibrary(code: string): 'plotly' | 'd3' {
    if (code.includes('Plotly.newPlot') || code.includes('Plotly.react')) {
        return 'plotly';
    } else if (code.includes('d3.select') || code.includes('d3.csv')) {
        return 'd3';
    }
    throw new Error('Could not detect library from code snippet.');
}

function executeD3Code(code: string, plotId: string) {
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%'; // Set the height to accommodate the chart
    iframe.sandbox = 'allow-scripts';
    document.getElementById(plotId)?.appendChild(iframe);

    const svgWidth = 500;
    const svgHeight = 500;

    iframe.srcdoc = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>D3 Chart</title>
            <script src="${D3_SRC}"></script>
        </head>
        <body>
            <svg width="${svgWidth}" height="${svgHeight}" id="agent-chart"></svg>
            <script>
                ${code}
            </script>
        </body>
        </html>
    `;
}

function executePlotlyCode(codeSnippet: string, plotId: string) {
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.sandbox = 'allow-scripts';
    document.getElementById(plotId)?.appendChild(iframe);

    iframe.srcdoc = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Plotly Chart</title>
            <script src="${PLOTLY_SRC}"></script>
        </head>
        <body>
            <div id="${plotId}"></div>
            <script>
                ${codeSnippet}
            </script>
        </body>
        </html>
    `;
}

export function PlotBlock({
    codeSnippet
}: {
    codeSnippet: string
}) {
    const [plotId, setPlotId] = useState('');

    useEffect(() => {
        const uniquePlotId = `plot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        setPlotId(uniquePlotId);
        executeCode(codeSnippet, uniquePlotId);
    }, [codeSnippet]);

    return <div id={plotId} style={{width: '100%', height: '500px'}}/>;
}