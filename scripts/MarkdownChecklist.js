/**
	{
		"api":1,
		"name":"Markdown Checklist",
		"description":"adds - [ ] before each line of the text to create a checklist",
		"author":"philippthiele",
		"tags":"enumeration,items,series,task"
	}
**/

function main(input) {
    let split = input.text.split(/\r\n|\r|\n/);
    input.postInfo(`Created ${split.length} checklist items`);
    input.text = "- [ ] " + split.join("\n- [ ] ");
}