/**
	{
		"api":1,
		"name":"Markdown Code Block",
		"description":"adds code block sign around selection",
		"author":"philippthiele",
		"icon":"collapse",
		"tags":"comment,coding"
	}
**/

function main(input) {
	input.text = '```\n' + input.text + '\n```';
}