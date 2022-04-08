/**
     {
         "api":1,
         "name":"Eval Javascript",
         "description":"Runs your text as Javascript Code. Embeds it in a function if necessary.",
         "author":"Sebastiaan Besselsen + philippthiele",
         "icon":"command",
         "tags":"js,script,run"
     }
 **/

function main(input) {
    const script = input.text.replace(/(\r\n|\r|\n)(\r\n|\r|\n)\/\/ Log output:[\s\S]*$/, '').replace(/(\r\n|\r|\n)(\r\n|\r|\n)\/\/ Return value:[\s\S]*$/, '');

    let output = '';
    let logs = '';
    const originalConsole = console;
    try {
        let console = {};
        console.log = console.warn = console.error = function(log) {
            originalConsole.log(log);
            logs += `${log}\n`;
        };
        let scriptToExecute = script.trim();
        if(!scriptToExecute.startsWith('(') && !scriptToExecute.startsWith('function')){
            scriptToExecute = `() => { ${scriptToExecute} }`;
        }
        if(!scriptToExecute.endsWith('()')){
            scriptToExecute = `(${scriptToExecute})()`;
        }
        output = eval(`${scriptToExecute}`);
        if (typeof output !== 'string') {
            output = JSON.stringify(output, null, 2);
        }
    } catch (e) {
        logs += `Execution Error:\n${e.toString()}`;
    }

    input.text =  `${script}${logs !== '' ? `\n\n// Log output:\n\n${logs}` : ''}${output !== undefined && output !== '' ? `\n\n// Return value:\n\n${output}` : ''}`;
}
    