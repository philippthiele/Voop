/**
	{
        "api":1,
        "name":"Pad lines to same length",
        "description":"Pads the start of each line so they all have the same length.",
        "author":"philippthiele",
        "icon":"collapse",
        "tags":"pad,format,align",
        "userInput":true,
        "userInputPlaceHolder":"specify padding character"
	}
**/

function main(input) {
    // Validate user input - must be exactly 1 character
    let paddingChar = input.userInput || ' ';
    
    if (paddingChar.length !== 1) {
        input.postError('Padding character must be exactly 1 character');
        return;
    }
    
    let lines = input.text.split(/\r\n|\r|\n/);
    
    // Handle empty input
    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
        input.postInfo('No lines to pad');
        return;
    }
    
    // Find the maximum line length
    let maxLength = 0;
    lines.forEach(line => {
        if (line.length > maxLength) {
            maxLength = line.length;
        }
    });
    
    // Pad each line to match the maximum length
    let paddedLines = lines.map(line => {
        let paddingNeeded = maxLength - line.length;
        return paddingChar.repeat(paddingNeeded) + line;
    });
    
    input.postInfo(`${lines.length} line(s) padded to length ${maxLength} with '${paddingChar}'`);
    input.text = paddedLines.join('\n');
}
