/**
	{
		"api":1,
		"name":"SRT to JSON",
		"description":"Converts subtitles to JSON",
		"author":"Jan Werder",
		"icon":"metamorphose",
		"tags":"srt,json,subtitles"
	}
**/

function main(input) {
	var parser = new Parser()
	input.text = JSON.stringify(parser.fromSrt(input.text), null, 2);
}

var Parser = /** @class */ (function () {
    function Parser() {
        this.seperator = ",";
    }
    Parser.prototype.correctFormat = function (time) {
        var str = time.replace(".", ",");
        var hour = null;
        var minute = null;
        var second = null;
        var millisecond = null;
        var _a = str.split(","), front = _a[0], ms = _a[1];
        millisecond = this.fixed_str_digit(3, ms);
        var _b = front.split(":"), a_hour = _b[0], a_minute = _b[1], a_second = _b[2];
        hour = this.fixed_str_digit(2, a_hour, false);
        minute = this.fixed_str_digit(2, a_minute, false);
        second = this.fixed_str_digit(2, a_second, false);
        return hour + ":" + minute + ":" + second + "," + millisecond;
    };
    Parser.prototype.fixed_str_digit = function (how_many_digit, str, padEnd) {
        if (padEnd === void 0) { padEnd = true; }
        if (str.length == how_many_digit) {
            return str;
        }
        if (str.length > how_many_digit) {
            return str.slice(0, how_many_digit);
        }
        if (str.length < how_many_digit) {
            if (padEnd) {
                return str.padEnd(how_many_digit, "0");
            }
            else {
                return str.padStart(how_many_digit, "0");
            }
        }
    };
    Parser.prototype.tryComma = function (data) {
        data = data.replace(/\r/g, "");
        var regex = /(\d+)\n(\d{1,2}:\d{2}:\d{2},\d{1,3}) --> (\d{1,2}:\d{2}:\d{2},\d{1,3})/g;
        var data_array = data.split(regex);
        data_array.shift();
        return data_array;
    };
    Parser.prototype.tryDot = function (data) {
        data = data.replace(/\r/g, "");
        var regex = /(\d+)\n(\d{1,2}:\d{2}:\d{2}\.\d{1,3}) --> (\d{1,2}:\d{2}:\d{2}\.\d{1,3})/g;
        var data_array = data.split(regex);
        data_array.shift();
        this.seperator = ".";
        return data_array;
    };
    Parser.prototype.fromSrt = function (data) {
        var originalData = data;
        var data_array = this.tryComma(originalData);
        if (data_array.length == 0) {
            data_array = this.tryDot(originalData);
        }
        var items = [];
        for (var i = 0; i < data_array.length; i += 4) {
            var new_line = {
                id: data_array[i].trim(),
                startTime: this.correctFormat(data_array[i + 1].trim()),
                endTime: this.correctFormat(data_array[i + 2].trim()),
                text: data_array[i + 3].trim()
            };
            items.push(new_line);
        }
        return items;
    };
    Parser.prototype.toSrt = function (data) {
        var res = "";
        for (var i = 0; i < data.length; i++) {
            var s = data[i];
            res += s.id + "\r\n";
            res += s.startTime + " --> " + s.endTime + "\r\n";
            res += s.text.replace("\n", "\r\n") + "\r\n\r\n";
        }
        return res;
    };
    return Parser;
}());