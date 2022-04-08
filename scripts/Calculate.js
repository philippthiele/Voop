/**
    {
        "api":1,
        "name":"Calculate",
        "description":"Does a calculation using JS eval & replaces input by the result",
        "author":"philippthiele",
        "icon":"command",
        "tags":"calc,eval,js,script,run"
    }
**/

function main(input) {
    try{
        input.text = eval(input.text);
    } catch (e) {
        input.postError(e.toString());
    }
}
