/**
	{
        "api":1,
        "name":"Combine Files",
        "description":"Joins all selected files contents together",
        "author":"philippthiele",
        "icon":"collapse",
        "tags":"append,join",
        "multiFile":true
	}
**/

function main(input) {
    input.text = input.files.map(file => file.text).join("\n");
}
