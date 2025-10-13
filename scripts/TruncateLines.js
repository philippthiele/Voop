/**
	{
		"api":1,
		"name":"Truncate Lines",
		"description":"Truncates each line after a specified length",
		"author":"philippthiele",
		"icon":"collapse",
		"tags":"cut,truncate,shorten",
		"userInput":true,
		"userInputPlaceHolder": "Maximum line length (e.g., 80)"
	}
**/

function main(input) {
	// Parse the user input as maximum line length
	const maxLength = parseInt(input.userInput);
	
	// Validate the input
	if (isNaN(maxLength) || maxLength <= 0) {
		input.postError("Please enter a valid positive number for maximum line length");
		return;
	}
	
	// Split input text into lines
	let lines = input.text.split("\n");
	
	// Process each line and truncate if necessary
	let processedLines = lines.map(line => {
		if (line.length > maxLength) {
			return line.substring(0, maxLength);
		}
		return line;
	});
	
	// Join the lines back together
	input.text = processedLines.join("\n");
}