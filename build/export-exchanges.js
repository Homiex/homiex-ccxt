// ----------------------------------------------------------------------------
// Usage:
//
//      npm run export-exchanges
// ----------------------------------------------------------------------------

"use strict";

const fs        = require ('fs')
    , countries = require ('./countries')
    , asTable   = require ('as-table')
    , execSync  = require ('child_process').execSync
    , log       = require ('ololog').unlimited
    , ansi      = require ('ansicolor').nice
    , { keys, values, entries } = Object
    , { replaceInFile } = require ('./fs.js')

// ----------------------------------------------------------------------------

function cloneGitHubWiki (gitWikiPath) {

    if (!fs.existsSync (gitWikiPath)) {
        log.bright.cyan ('Cloning ccxt.wiki...')
        execSync ('git clone https://github.com/ccxt/ccxt.wiki.git ' + gitWikiPath)
    }
}

// ----------------------------------------------------------------------------

function logExportExchanges (filename, regex, replacement) {
    log.bright.cyan ('Exporting exchanges →', filename.yellow)
    replaceInFile (filename, regex, replacement)
}

// ----------------------------------------------------------------------------

function getIncludedExchangeIds () {

    const includedIds = fs.readFileSync ('exchanges.cfg')
        .toString () // Buffer → String
        .split ('\n') // String → Array
        .map (line => line.split ('#')[0].trim ()) // trim comments
        .filter (exchange => exchange); // filter empty lines

    const isIncluded = (id) => ((includedIds.length === 0) || includedIds.includes (id))

    const ids = fs.readdirSync ('./js/')
        .filter (file => file.includes ('.js'))
        .map (file => file.slice (0, -3))
        .filter (isIncluded);

    return ids
}

// ----------------------------------------------------------------------------

function exportExchanges (replacements) {

    log.bright.yellow ('Exporting exchanges...')

    replacements.forEach (({ file, regex, replacement }) => {
        logExportExchanges (file, regex, replacement)
    })

    log.bright.green ('Base sources updated successfully.')
}

// ----------------------------------------------------------------------------

function createExchanges (ids) {

    const ccxt = require ('../ccxt.js')

    const createExchange = (id) => {
        ccxt[id].prototype.checkRequiredDependencies = () => {} // suppress it
        return new (ccxt)[id] ()
    }

    return ccxt.indexBy (ids.map (createExchange), 'id')
}

// // ----------------------------------------------------------------------------
// // strategically placed exactly here (we can require it AFTER the export)
// const ccxt = require ('../ccxt.js')
// // ----------------------------------------------------------------------------
// // create exchanges
// const createExchange = (id) => {
//     ccxt[id].prototype.checkRequiredDependencies = () => {} // suppress it
//     return new (ccxt)[id] ()
// }
// const exchanges = ccxt.indexBy (ids.map (createExchange), 'id')

// ----------------------------------------------------------------------------
// TODO: REWRITE THIS ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓

function exportSupportedAndCertifiedExchanges (exchanges, wikiPath) {

    // ............................................................................
    // markup constants and helper functions

    const countryName = (code) => countries[code] || code

    const ccxtCertifiedBadge = '[![CCXT Certified](https://img.shields.io/badge/CCXT-certified-green.svg)](https://github.com/ccxt/ccxt/wiki/Certification)'
    const logoHeading = '&nbsp;'.repeat (7) + 'logo' + '&nbsp;'.repeat (7)
    const tableHeadings = [ logoHeading, 'id', 'name', 'ver', 'doc', 'certified', ]
    const exchangesByCountryHeading = [ 'country / region', ... tableHeadings ]

    // ----------------------------------------------------------------------------
    // list all supported exchanges

    const exchangesNotListedInDocs = []

    let tableData = values (exchanges)
        .filter (exchange => !exchangesNotListedInDocs.includes (exchange.id))
        .map (exchange => {
            let logo = exchange.urls['logo']
            let website = Array.isArray (exchange.urls.www) ? exchange.urls.www[0] : exchange.urls.www
            let url = exchange.urls.referral || website
            let countries = Array.isArray (exchange.countries) ? exchange.countries.map (countryName).join (', ') : countryName (exchange.countries)
            let doc = Array.isArray (exchange.urls.doc) ? exchange.urls.doc[0] : exchange.urls.doc
            let version = exchange.version ? exchange.version : '\*'
            let matches = version.match (/[^0-9]*([0-9].*)/)
            if (matches) {
                version = matches[1];
            }
            return [
                '[![' + exchange.id + '](' + logo + ')](' + url + ')',
                exchange.id,
                '[' + exchange.name + '](' + url + ')',
                version,
                '[API](' + doc + ')',
                exchange.certified ? ccxtCertifiedBadge : '',
                countries,
            ]
        })

    // prepend the table header
    tableData.splice (0, 0, tableHeadings)

    function makeTable (jsonArray) {
        let table = asTable.configure ({ 'delimiter': ' | ' }) (jsonArray)
        let lines = table.split ("\n")
        lines.splice (1,0, lines[0].replace (/[^\|]/g, '-'))
        let headerLine = lines[1].split ('|')
        headerLine[3] = ':' + headerLine[3].slice (1, headerLine[3].length - 1) + ':'
        headerLine[4] = ':' + headerLine[4].slice (1, headerLine[4].length - 1) + ':'
        lines[1] = headerLine.join ('|')
        return lines.map (line => '|' + line + '|').join ("\n")
    }

    const exchangesTable = makeTable (tableData)
    const numExchanges = keys (exchanges).length
    const beginning = "The ccxt library currently supports the following "
    const ending = " cryptocurrency exchange markets and trading APIs:\n\n"
    const totalString = beginning + numExchanges + ending
    const allExchanges = totalString + exchangesTable + "$1"
    const allExchangesRegex = new RegExp ("[^\n]+[\n]{2}\\|[^`]+\\|([\n][\n]|[\n]$|$)", 'm')
    logExportExchanges ('README.md', allExchangesRegex, allExchanges)
    logExportExchanges (wikiPath + '/Manual.md', allExchangesRegex, allExchanges)
    logExportExchanges (wikiPath + '/Exchange-Markets.md', allExchangesRegex, allExchanges)

    const certifiedFieldIndex = tableHeadings.indexOf ('certified')
    const certified = tableData.filter ((x) => x[certifiedFieldIndex] !== '' )
    const certifiedExchangesRegex = new RegExp ("^(## Certified Cryptocurrency Exchanges\n{3})(?:\\|.+\\|$\n)+", 'm')
    const certifiedExchangesTable = makeTable (certified)
    const certifiedExchanges = '$1' + certifiedExchangesTable + "\n"
    logExportExchanges ('README.md', certifiedExchangesRegex, certifiedExchanges)


    let exchangesByCountries = []
    keys (countries).forEach (code => {
        let country = countries[code]
        let result = []
        keys (exchanges).forEach (id => {
            let exchange = exchanges[id]
            let logo = exchange.urls['logo']
            let website = Array.isArray (exchange.urls.www) ? exchange.urls.www[0] : exchange.urls.www
            let url = exchange.urls.referral || website
            let doc = Array.isArray (exchange.urls.doc) ? exchange.urls.doc[0] : exchange.urls.doc
            let version = exchange.version ? exchange.version : '\*'
            let matches = version.match (/[^0-9]*([0-9].*)/)
            if (matches)
                version = matches[1];
            let shouldInclude = false
            if (Array.isArray (exchange.countries)) {
                if (exchange.countries.indexOf (code) > -1)
                    shouldInclude = true
            } else {
                if (code == exchange.countries)
                    shouldInclude = true
            }
            if (shouldInclude) {
                let entry = [
                    country,
                    '[![' + exchange.id + '](' + logo + ')](' + url + ')',
                    exchange.id,
                    '[' + exchange.name + '](' + url + ')',
                    version,
                    '[API](' + doc + ')',
                    // doesn't fit in width
                    // exchange.certified ? ccxtCertifiedBadge : '',
                ]
                result.push (entry)
            }
        })
        exchangesByCountries = exchangesByCountries.concat (result)
    });

    let countryKeyIndex = exchangesByCountryHeading.indexOf ('country / region')
    exchangesByCountries = exchangesByCountries.sort ((a, b) => {
        let countryA = a[countryKeyIndex].toLowerCase ()
        let countryB = b[countryKeyIndex].toLowerCase ()
        if (countryA > countryB) {
            return 1
        } else if (countryA < countryB) {
            return -1;
        } else {
            if (a['id'] > b['id'])
                return 1;
            else if (a['id'] < b['id'])
                return -1;
            else
                return 0;
        }
    })

    exchangesByCountries.splice (0, 0, exchangesByCountryHeading)
    let lines = makeTable (exchangesByCountries)
    let result = "# Exchanges By Country\n\nThe ccxt library currently supports the following cryptocurrency exchange markets and trading APIs:\n\n" + lines + "\n\n"
    let filename = wikiPath + '/Exchange-Markets-By-Country.md'
    fs.truncateSync (filename)
    fs.writeFileSync (filename, result)
}

// TODO: REWRITE THIS ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
// ----------------------------------------------------------------------------

function exportExchangeIdsToExchangesJson (exchanges) {
    log.bright ('Exporting exchange ids to'.cyan, 'exchanges.json'.yellow)
    fs.writeFileSync ('exchanges.json', JSON.stringify ({ ids: keys (exchanges) }, null, 4))
}

// ----------------------------------------------------------------------------

function exportWikiToGitHub (wikiPath, gitWikiPath) {

    log.bright.cyan ('Exporting wiki to GitHub')

    const ccxtWikiFiles = {
        'README.md': 'Home.md',
        'Install.md': 'Install.md',
        'Manual.md': 'Manual.md',
        'Exchange-Markets.md': 'Exchange-Markets.md',
        'Exchange-Markets-By-Country.md': 'Exchange-Markets-By-Country.md',
    }

    for (const [ sourceFile, destinationFile ] of entries (ccxtWikiFiles)) {

        const sourcePath = wikiPath + '/' + sourceFile
        const destinationPath = gitWikiPath + '/' + destinationFile
        log.bright.cyan ('Exporting', sourcePath.yellow, '→', destinationPath.yellow)
        fs.writeFileSync (destinationPath, fs.readFileSync (sourcePath))
    }
}

// ----------------------------------------------------------------------------

function exportKeywordsToPackageJson (exchanges) {

    log.bright ('Exporting exchange keywords to'.cyan, 'package.json'.yellow)

    // const packageJSON = require ('../package.json')
    const packageJSON = JSON.parse (fs.readFileSync ('./package.json'))
    const keywords = new Set (packageJSON.keywords)

    for (const ex of values (exchanges)) {
        for (const url of Array.isArray (ex.urls.www) ? ex.urls.www : [ex.urls.www]) {
            keywords.add (url.replace (/(http|https):\/\/(www\.)?/, '').replace (/\/.*/, ''))
        }
        keywords.add (ex.name)
    }

    packageJSON.keywords = [...keywords]
    fs.writeFileSync ('./package.json', JSON.stringify (packageJSON, null, 2))
}

// ----------------------------------------------------------------------------

function exportEverything () {

    const wikiPath = 'wiki'
        , gitWikiPath = 'build/ccxt.wiki'

    cloneGitHubWiki (gitWikiPath)

    const ids = getIncludedExchangeIds ()

    const replacements = [
        {
            file: './ccxt.js',
            regex:  /(?:const|var)\s+exchanges\s+\=\s+\{[^\}]+\}/,
            replacement: "const exchanges = {\n" + ids.map (id => ("    '" + id + "':").padEnd (30) + " require ('./js/" + id + ".js'),").join ("\n") + "    \n}",
        },
        {
            file: './python/ccxt/__init__.py',
            regex: /exchanges \= \[[^\]]+\]/,
            replacement: "exchanges = [\n" + "    '" + ids.join ("',\n    '") + "'," + "\n]",
        },
        {
            file: './python/ccxt/__init__.py',
            regex: /(?:from ccxt\.[^\.]+ import [^\s]+\s+\# noqa\: F401[\r]?[\n])+[\r]?[\n]exchanges/,
            replacement: ids.map (id => ('from ccxt.' + id + ' import ' + id).padEnd (60) + '# noqa: F401').join ("\n") + "\n\nexchanges",
        },
        {
            file: './python/ccxt/async_support/__init__.py',
            regex: /(?:from ccxt\.async_support\.[^\.]+ import [^\s]+\s+\# noqa\: F401[\r]?[\n])+[\r]?[\n]exchanges/,
            replacement: ids.map (id => ('from ccxt.async_support.' + id + ' import ' + id).padEnd (74) + '# noqa: F401').join ("\n") + "\n\nexchanges",
        },
        {
            file: './python/ccxt/async_support/__init__.py',
            regex: /exchanges \= \[[^\]]+\]/,
            replacement: "exchanges = [\n" + "    '" + ids.join ("',\n    '") + "'," + "\n]",
        },
        {
            file: './php/base/Exchange.php',
            regex: /public static \$exchanges \= array\s*\([^\)]+\)/,
            replacement: "public static $exchanges = array(\n        '" + ids.join ("',\n        '") + "',\n    )",
        },
    ]

    exportExchanges (replacements)

    // strategically placed exactly here (we can require it AFTER the export)
    const exchanges = createExchanges (ids)

    exportSupportedAndCertifiedExchanges (exchanges, wikiPath)
    exportExchangeIdsToExchangesJson (exchanges)
    exportWikiToGitHub (wikiPath, gitWikiPath)
    exportKeywordsToPackageJson (exchanges)

    log.bright.green ('Exported successfully.')
}

// ============================================================================
// main entry point

if (require.main === module) {

    // if called directly like `node module`

    exportEverything ()

} else {

    // do nothing if required as a module
}

// ============================================================================

module.exports = {
    cloneGitHubWiki,
    getIncludedExchangeIds,
    exportExchanges,
    createExchanges,
    exportSupportedAndCertifiedExchanges,
    exportExchangeIdsToExchangesJson,
    exportWikiToGitHub,
    exportKeywordsToPackageJson,
    exportEverything,
}
