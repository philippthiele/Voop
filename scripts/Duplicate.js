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
    if(!input.resultInNewFile && input.selection){
		input.insert(input.text);
		input.insert("\n");
	}
	if(!input.selection && !input.resultInNewFile) {
		input.insert("\n");
	}
	input.insert(input.text);
}