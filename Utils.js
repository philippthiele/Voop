
module.exports = class Utils {
    static pathEqual(actual, expected) {
        return (actual === expected) || (this.normalizePath(actual) === this.normalizePath(expected))
    }

    static normalizePath(path) {
        const replace = [
            [/\\/g, '/'],
            [/(\w):/, '/$1'],
            [/(\w+)\/\.\.\/?/g, ''],
            [/^\.\//, ''],
            [/\/\.\//, '/'],
            [/\/\.$/, ''],
            [/\/$/, ''],
        ];

        replace.forEach(array => {
            while (array[0].test(path)) {
                path = path.replace(array[0], array[1])
            }
        });

        return path.toLowerCase();
    }
}