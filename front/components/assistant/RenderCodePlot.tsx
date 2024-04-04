function importPlotly(onLoad: () => void) {
    const script = document.createElement('script');
    script.src = 'https://cdn.plot.ly/plotly-latest.min.js';
    script.onload = () => {
        console.log('Plotly has been loaded');
        onLoad?.();
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