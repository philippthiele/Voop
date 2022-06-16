/**
	{
		"api":1,
		"name":"Duplicate",
		"description":"Duplicates text, tip: use with new file",
		"author":"philippthiele",
		"tags":"copy,multiply",
	}
**/

function main(input) {
    if(!input.resultInNewFile){
		input.insert(input.text);
		input.insert("\n");
	}
	input.insert(input.text);
}