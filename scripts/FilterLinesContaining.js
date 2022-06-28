/**
	{
        "api":1,
        "name":"Filter lines containing",
        "description":"Only keeps lines containing given input.",
        "author":"philippthiele",
        "tags":"strip,remove,delete,filter",
        "userInput":true,
        "userInputPlaceHolder":"specify which lines to keep",
	}
**/

function main(input) {
    let split = input.text.split(/\r\n|\r|\n/);
    let linesRemoved = 0;
    let linesLeft = 0;
    input.text = "";
    for (const line of split) {
        if (line.includes(input.userInput)) {
            input.text += line + "\n";
            linesLeft++;
        } else {
            linesRemoved++;
        }
    }
    input.postInfo(`${linesRemoved} lines removed, ${linesLeft} lines left.`);
}
