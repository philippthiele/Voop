/**
     {
         "api":1,
         "name":"Eval Javascript",
         "description":"Runs your text as Javascript Code.",
         "author":"Sebastiaan Besselsen + philippthiele",
         "icon":"command",
         "tags":"js,script,run"
     }
 **/

function main(input) {
    const script = input.text.replace(/(\r\n|\r|\n)(\r\n|\r|\n)\/\/ Log output:[\s\S]*(\r\n|\r|\n)(\r\n|\r|\n)\/\/ Return value:[\s\S]*$/, '');

    let output = '';
    let logs = '';
    const originalConsole = console;
    try {
        let console = {};
        console.log = console.warn = console.error = function(log) {
            originalConsole.log(log);
            logs += `${log}\n`;
        };
        output = eval(script);
        if (typeof output !== 'string') {
            output = JSON.stringify(output, null, 2);
        }
    } catch (e) {
        input.postError(e.toString());
    }

    input.text =  `${script}\n\n// Log output:\n\n${logs}\n\n// Return value:\n\n${output}`;
}
