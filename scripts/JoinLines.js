/**
	{
		"api":1,
		"name":"Join Lines",
		"description":"Joins all lines with given delimiter.",
		"author":"riesentoaster + philippthiele",
		"icon":"collapse",
		"tags":"join",
		"userInput":true,
		"userInputPlaceHolder":"specify separator"
	}
**/

function main(input) {
	input.text = input.text.replace(/\n/g, input.userInput);
}
