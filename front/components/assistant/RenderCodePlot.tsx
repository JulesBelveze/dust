import React, { useEffect, useState } from 'react';

const PLOTLY_SRC = 'https://cdn.plot.ly/plotly-latest.min.js';

function importPlotly(onLoad: () => void) {
    if (window.Plotly) {
        onLoad();
        return;
    }

    const existingScript = document.querySelector(`script[src="${PLOTLY_SRC}"]`);
    if (existingScript) {
        existingScript.addEventListener('load', onLoad);
        return;
    }

    const script = document.createElement('script');
    script.src = PLOTLY_SRC;
    script.addEventListener('load', onLoad);
    document.head.appendChild(script);
}

function executePlotlyCode(codeSnippet: string, plotId: string) {
    const extractCodeRegex = /(?<=```javascript\n)[\s\S]*?(?=\n```)/;
    const codeMatches = codeSnippet.match(extractCodeRegex);

    if (codeMatches) {
        // Prepare the code to be executed, including replacing 'agent-chart' with the unique plotId
        const codeToEvaluate = codeMatches[0].replace(/'agent-chart'/g, `'${plotId}'`);

        importPlotly(() => {
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.sandbox = 'allow-scripts'; // Apply sandbox restrictions
            document.getElementById(plotId)?.appendChild(iframe);

            // Set the iframe's content, including Plotly and the code to execute
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
                        ${codeToEvaluate}
                    </script>
                </body>
                </html>
            `;
        });
    } else {
        console.error('Unsafe code');
    }
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
        executePlotlyCode(codeSnippet, uniquePlotId);
    }, [codeSnippet]);

    return <div id={plotId} style={{ width: '100%', height: '500px' }} />;
}