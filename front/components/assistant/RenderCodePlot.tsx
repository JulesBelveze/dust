function importPlotly(onLoad: () => void) {
    // Make sure we only import plotly once
    const PLOTLY_SRC = 'https://cdn.plot.ly/plotly-latest.min.js';
    const existingScript = document.querySelector(`script[src="${PLOTLY_SRC}"]`);

    if (window.Plotly || existingScript) {
        if (window.Plotly) {
            onLoad();
        } else if (existingScript && existingScript.onload == null) {
            existingScript.onload = () => {
                onLoad();
            };
        }
        return;
    }

    const script = document.createElement('script');
    script.src = PLOTLY_SRC;
    script.onload = () => {
        onLoad();
    };
    document.head.appendChild(script);
}

export function PlotBlock({
    codeSnippet
}: {
    codeSnippet: string
}) {
    const extractCodeRegex = /(?<=```javascript\n)[\s\S]*?(?=\n```)/;
    const unsafePatterns = [
        /process\.env/,         // accessing process.env
        /module\.exports\s*=.*/,  // module.exports assignment
        /\.exec\s*\(.*\)/,      // .exec (e.g. child_process.exec) with any content
    ]
    const codeMatches = codeSnippet.match(extractCodeRegex);

    if (codeMatches) {
        const isSafeToRun = (code: string) => !unsafePatterns.some(
            pattern => pattern.test(code)
        );
        const codeToEvaluate = codeMatches[0]

        if (isSafeToRun(codeToEvaluate)) {
            try {
                importPlotly(() => {
                    eval(codeToEvaluate);
                })
            } catch (error) {
                console.error('Error evaluating code:', error);
            }
        } else {
            console.error('Unsafe code')
        }
    }
    return <div id="agent-chart"></div>;
}