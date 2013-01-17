var fs = require("fs"); 
var util = require("util");
var lib = require("./lib");
var parseLanguage = lib.parsePlist;


function logDebug(string, obj) {
    console.log(string, obj);
}


// tmLanguage processor

// for tracking token states
var states = {start: []}
var stateName = "start"

function processRules(rules){
    if (rules.patterns)
        states.start = processPatterns(rules.patterns);
    if (rules.repository)
        processRepository(rules.repository);
    return states;
}
function processRepository(r) {
    for (var key in r) {
        var p = r[key];
        if (p.begin)
            var stateObj = [processPattern(r[key])]
        else if (p.patterns && !p.repository)
            var stateObj = processPatterns(p.patterns)
        else
            logDebug("unable to convert", p)
        if (stateObj)
            states["#" + key] = stateObj;
    }
}    
function processPatterns(pl) {
    return pl.map(processPattern)
}
function processPattern(p) {
    if (p.begin && p.end) {
        var rule = simpleRule(p.begin, p.name, p.beginCaptures)
        
        var next = processPatterns(p.patterns || []);
        var endRule = simpleRule(p.end, p.name, p.endCaptures)
        next.push(endRule)  
        
        if (p.name || p.contentName)
            next.push({defaultToken: p.name || p.contentName})
            
        rule.next = next;
    }
    else if (p.match) {
        var rule = simpleRule(p.match, p.name, p.captures)
    } 
    else if (p.include) {
        var rule =  {include: p.include};
    }
    
    if (p.comment)
        rule.comment = (rule.comment || "") +  p.comment;

    if (p.repository)
        processRepository(p.repository)
    return rule;
}
function simpleRule(regex, name, captures) {
    name = name || "text"
    
    regex = transformRegExp(regex)
    if (captures) {        
        var tokenArray = []
        Object.keys(captures).forEach(function(x){
            tokenArray[x] = captures[x] && captures[x].name
        })
        tokenArray
        if (tokenArray.length == 1)
            tokenArray = tokenArray[0]
        else {
            for (var i = 0; i < tokenArray.length; i++)
                if (!tokenArray[i])
                    tokenArray[i] = name;
        }
    }
    
    try {new RegExp(regex);} catch(e){
        regex += "    \x00// FIXME: regexp doesn't have js equivalent"
    }
    
    return {token: name, regex: regex};
}


// regex transformation

function removeXFlag(str) {
    if (str && str.slice(0,4) == "(?x)") {
        str = str.replace(/\\.|\[([^\]\\]|\\.)*?\]|\s+|(?:#[^\n]*)/g, function(s) {
            if (s[0] == "[")
                return s;
            if (s[0] == "\\")
                return /[#\s]/.test(s[1]) ? s[1] : s;
            return "";
        });
    }
    return str;
}

function transformRegExp(str) {
    str = removeXFlag(str);
    str = str.replace(/\\n(?!\?).?/, '$'); // replace newlines by $ except if its postfixed by ?
    str = str.replace(/\?i\:/, "?:"); // checkForInvariantRegex
    
    return str;
}

// 
function extractPatterns(tmRules) {
    var patterns = processRules(tmRules);
    return lib.restoreJSONComments(lib.formatJSON(patterns, "    "));
    
}



// cli stuff
var modeTemplate = fs.readFileSync(__dirname + "/mode.tmpl.js", "utf8");
var modeHighlightTemplate = fs.readFileSync(__dirname + "/mode_highlight_rules.tmpl.js", "utf8");

function convertLanguageFile(name) {
    var tmLanguage = fs.readFileSync(process.cwd() + "/" + name, "utf8");
    parseLanguage(tmLanguage, function(language) {
        var languageHighlightFilename = language.name.replace(/[-_]/g, "").toLowerCase();
        var languageNameSanitized = language.name.replace(/-/g, "");
        
        var languageHighlightFile = __dirname + "/../lib/ace/mode/" + languageHighlightFilename + "_highlight_rules.js";
        var languageModeFile = __dirname + "/../lib/ace/mode/" + languageHighlightFilename + ".js";
        
        console.log("Converting " + name + " to " + languageHighlightFile);
      
        if (devMode) {
            console.log(util.inspect(language.patterns, false, 4));
            console.log(util.inspect(language.repository, false, 4));
        }
        
        var languageMode = lib.fillTemplate(modeTemplate, {
            language: languageNameSanitized,
            languageHighlightFilename: languageHighlightFilename
        });

        var patterns = extractPatterns(language);

        var languageHighlightRules = lib.fillTemplate(modeHighlightTemplate, {
            language: languageNameSanitized,
            languageTokens: patterns.trim(),
            uuid: language.uuid,
            name: name
        });

        if (devMode) {
            console.log(languageMode)
            console.log(languageHighlightRules)
            console.log("Not writing, 'cause we're in dev mode, baby.");
        }
        else {
            fs.writeFileSync(languageHighlightFile, languageHighlightRules);
            fs.writeFileSync(languageModeFile, languageMode);
        }
    });
}

var args = process.argv.splice(2);
var tmLanguageFile  = args[0];
var devMode         = args[1];
if (tmLanguageFile === undefined) {
    console.error("Please pass in a language file via the command line.");
    process.exit(1);
}
convertLanguageFile(tmLanguageFile);






/*


var states = {}
var stateName = "start"
if (tmRules.patterns)
    p = processPatterns(tmRules.patterns)
function processPatterns(pl) {
    return pl.map(function(p) {
        if (p.begin && p.end) {
            var rule = simpleRule(p.begin, p.beginCaptures || p.name)
            
            var next = processPatterns(p.patterns || []);
            var endRule = simpleRule(p.end, p.endCaptures || p.name)
            next.push(endRule)            
            if (p.name || p.contentName)
                next.push({defaultToken: p.name || p.contentName})
            rule.next = next
        }
        else if (p.match) {
            var rule = simpleRule(p.name, p.name)
        } 
        else if (p.include) {
            var rule =  {include: p.include}
        }
        if (p.comment)
            rule.comment = p.comment;
        return rule
    })
}
function simpleRule(regex, name) {
    if (typeof name == "string") {
        //regex = processRegex(regex)
    } else {
        
    }
    
    return {token: name, regex: regex};
}
JSON.stringify(p,null, 4)
#>>

re=/s[/](?!s)/
re.test("s/s")
#>>
re = /\\.|\[(?:[^\]]|.)*\]|(\()(\?[!=:])?|(\))([*+]\?|[*+?]|{\d+,\d*}\??|{,?\d+}\??)?|./g

re1 = /(){1}s[pppp\]()]d(?:s)?op/.source
#>>
var parts = []
while(m = re.exec(re1)) {
    if (m[1]) {
         parts.push(m[0])
    } else if (m[3]) {
         parts.push(m[0])
    } else {
        parts.push(m[0])
    } 
    
}

parts






*/