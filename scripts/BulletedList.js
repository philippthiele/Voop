/**
	{
		"api":1,
		"name":"Bulleted List",
		"description":"adds a - before each line of the text to create a bulleted list",
		"author":"philippthiele",
		"icon":"collapse",
		"tags":"enumeration,items,series"
	}
**/

function main(input) {
    let split = input.text.split(/\r\n|\r|\n/);
    input.postInfo(`Created ${split.length} bullet points`);
    input.text = "- " + split.join("\n- ");
}