/**
	{
        "api":1,
        "name":"Wrap lines",
        "description":"Wrap all lines replacing given delimiter with line breaks.",
        "author":"philippthiele",
        "icon":"collapse",
        "tags":"break,wrap,split",
        "userInput":true,
        "userInputPlaceHolder":"specify separator to wrap at"
	}
**/

function main(input) {
    let split = input.text.split(input.userInput);
    input.postInfo(`${split.length} lines wrapped`);
    input.text = split.join("\n");
}
