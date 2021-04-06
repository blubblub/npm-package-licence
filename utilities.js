const { isArray, isObject } = require('./isOfType');

function hasOwnProperty (object, property) {
    if (!object || !property) {
        return false;
    }

    return Object.prototype.hasOwnProperty.call(object, property);
}

function objectDifference (first, second) {
    const firstDifference = {};
    const secondDifference = {};
    const keys = [];

    for (const key of Object.keys(first)) {
        if (!hasOwnProperty(second, key)) {
            firstDifference[key] = first[key];
            keys.push(key);
            continue;
        }

        if (!equalValues(first[key], second[key])) {
            firstDifference[key] = first[key];
            secondDifference[key] = second[key];
        }

        keys.push(key);
    }

    for (const key of Object.keys(second)) {
        if (keys.includes(key)) {
            continue;
        }

        secondDifference[key] = second[key];
    }

    return {
        first: firstDifference,
        second: secondDifference
    };
}

function equalValues (first, second) {
    if (isArray(first) && isArray(second)) {
        return (first.length === second.length) && first.every((element, index) => {
            return equalValues(element, second[index]);
        });
    } else if (isObject(first) && isObject(second)) {
        const firstProperties = Object.getOwnPropertyNames(first);
        const secondProperties = Object.getOwnPropertyNames(second);

        // If number of properties is different,
        // objects are not equivalent
        if (firstProperties.length !== secondProperties.length) {
            return false;
        }

        return firstProperties.every(prop => secondProperties.includes(prop) && equalValues(first[prop], second[prop]));
    } else if (!first && !second) {
        return true;
    } else if (!first || !second) {
        return false;
    } else if (typeof first.equals === 'function') {
        return first.equals(second);
    } else {
        return first === second;
    }
}

function objectSymetricalDifference (first, second) {
    if (isObject(first) && isObject(second)) {
        return objectDifference(first, second);
    }

    return {
        first,
        second
    };
}

module.exports = {
    equalValues,
    objectSymetricalDifference
}
