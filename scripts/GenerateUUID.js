/**
	{
		"api":1,
		"name":"Generate UUID",
		"description":"RFC4122 version 4 compliant UUID",
		"author":"Briguy37 & tietze111",
		"icon":"collapse",
		"tags":"uuid,guid,unique"
	}
**/

function main(input) {
    var d = new Date().getTime();
    var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now()*1000)) || 0;
    input.insert('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16;
        if(d > 0){
            r = (d + r)%16 | 0;
            d = Math.floor(d/16);
        } else {
            r = (d2 + r)%16 | 0;
            d2 = Math.floor(d2/16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }));
}
