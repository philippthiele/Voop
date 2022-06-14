/**
	{
		"api":1,
		"name":"Trim",
		"description":"Trims leading and trailing whitespace of each line.",
		"author":"philippthiele",
		"icon":"scissors",
		"tags":"trim,whitespace,empty,space",
	}
**/

function main(input) {
    let split = input.text.split(/\r\n|\r|\n/);
	split = split.map(e => e.trim());
    input.text = split.join("\n");
}