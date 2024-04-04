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

let plotCounter = 0; // Keep track of the number of plots to generate unique IDs

const isCodeSafe = (code: string) => {
    const unsafePatterns = [
        /process\.env/,
        /module\.exports\s*=.*/,
        /\.exec\s*\(.*\)/,
    ];
    return !unsafePatterns.some(pattern => pattern.test(code));
};

function executePlotlyCode(codeSnippet: string, plotId: string) {
    const extractCodeRegex = /(?<=```javascript\n)[\s\S]*?(?=\n```)/;
    const codeMatches = codeSnippet.match(extractCodeRegex);

    if (codeMatches && isCodeSafe(codeMatches[0])) {
        const codeToEvaluate = codeMatches[0].replace(/'agent-chart'/g, `'${plotId}'`);

        importPlotly(() => {
            const element = document.getElementById(plotId);
            if (element) {
                eval(codeToEvaluate);
            } else {
                setTimeout(() => {
                    if (document.getElementById(plotId)) {
                        eval(codeToEvaluate);
                    }
                }, 100);
            }
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
        const uniquePlotId = `plot-${plotCounter++}`;
        setPlotId(uniquePlotId);
        executePlotlyCode(codeSnippet, uniquePlotId);
    }, [codeSnippet]);

    return <div id={plotId} />;
}