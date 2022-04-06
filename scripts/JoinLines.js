/**
	{
        "api":1,
        "name":"Join lines",
        "description":"Joins all lines with given delimiter.",
        "author":"Dennis + philippthiele",
        "icon":"collapse",
        "tags":"strip,remove,collapse,join",
        "userInput":true,
        "userInputPlaceHolder":"specify separator"
	}
**/

function main(input) {
    let split = input.text.split(/\r\n|\r|\n/);
    input.postInfo(`${split.length} lines joined`);
    input.text = split.join(input.userInput);
}
