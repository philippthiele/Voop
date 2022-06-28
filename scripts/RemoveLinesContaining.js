/**
	{
        "api":1,
        "name":"Remove lines containing",
        "description":"Removes all lines containing given input.",
        "author":"philippthiele",
        "tags":"strip,remove,delete,filter",
        "userInput":true,
        "userInputPlaceHolder":"specify which lines to remove",
	}
**/

function main(input) {
    let split = input.text.split(/\r\n|\r|\n/);
    let linesRemoved = 0;
    let linesLeft = 0;
    input.text = "";
    for (const line of split) {
        if (line.includes(input.userInput)) {
            linesRemoved++;
        } else {
            input.text += line + "\n";
            linesLeft++;
        }
    }
    input.postInfo(`${linesRemoved} lines removed, ${linesLeft} lines left.`);
}
