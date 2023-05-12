/**
 * createHexMap(divid, options)
 * create a hex map with the [hexmap] shortcode
 */

function createHexMap (divid, options) {
    // default options and options validation
    options = Object.assign({
        // geofile and csvfile = URL string, the URLs of the CSV and GeoJSON files
        'geofile': undefined,
        'csvfile': undefined,
        // csvlinkfield and geolinkfield = string, field name within the CSV/GeoJSON to match records between the two
        'csvlinkfield': undefined,
        'geolinkfield': undefined,
        // csvvaluefield = string, field name within the CSV to get values
        'csvvaluefield': undefined,
        // geonamefield = string, attribute name in GeoJSON which is the place's displayed name in popup/tooltip
        'geonamefield': undefined,
        // geolabelfield = string, attribute name in GeoJSON which is the place's label name; may be blank to not add labels to hexes
        'geolabelfield': '',
        // breaks = comma-joined list of numbers, forming the breaks; class matching is "value <= break"; the string "auto" calculates equal-interval classes to fit the "colors" list given
        'breaks': 'auto',
        // colors = comma-joined list of colors for those classes; there should be 1 more color than break, for the > condition
        'colors': ['#f7f7f7', '#cccccc', '#969696', '#636363', '#252525'],
        // prefix and suffix = string, displayed in tooltip/popup before and after the value to make it read nicely
        'prefix': '',
        'suffix': '',
        // legendtitle = string, displayed as the tite of the legend; if blank/omitted then no legend
        'legendtitle': '',
        // legendlocation = string, where to place the legend; one of these': lowerright, lowerleft
        'legendlocation': 'lowerright',
        // downloadbuttoncssclass = CSS classes to apply to the Download PNG button; pass blank to not add the button
        'downloadbuttoncssclass': '',
        // caption = string, a caption for the table which will be displayed at the bottom
        'caption': '',
        // width = a CSS string for the width of the wrapper/container e.g. "500px" or "100%" or "calc(100% - 50px)"
        'width': undefined,
    }, options);

    if (! options.geofile) throw new Error('createHexMap() missing required option: geofile');
    if (! options.csvfile) throw new Error('createHexMap() missing required option: csvfile');
    if (! options.csvlinkfield) throw new Error('createHexMap() missing required option: csvlinkfield');
    if (! options.geolinkfield) throw new Error('createHexMap() missing required option: geolinkfield');
    if (! options.csvvaluefield) throw new Error('createHexMap() missing required option: csvvaluefield');
    if (! options.geonamefield) throw new Error('createHexMap() missing required option: geonamefield');
    if (['lowerright', 'lowerleft'].indexOf(options.legendlocation) == -1) throw new Error('createHexMap() unknown value for legendlocation');

    // set the wrapper's width, if given, and check that the target element exists
    const div = document.getElementById(divid);
    if (! div) throw new Error(`createHexMap() no such DIV ${divid}`);
    const bottomarea = document.getElementById(`${divid}-after`);

    if (options.width) {
        div.parentElement.style.width = options.width;
    }

    // fetch the CSV file and GeoJSON file, then initialize
    const geourl = options.geofile;
    const csvurl = options.csvfile;
    let CSVDATA = {};
    let PLACEDATA = {};
    let MAP;

    jQuery.getJSON(geourl, function (geodata) {
        Papa.parse(csvurl, {
            download: true,
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: function (results) {
                // loop over CSV, populating CSVDATA as a dict of place name => attributes
                // warn about duplicates & nulls, as these may indicate data issues and/or bad field names
                results.data.forEach((row) => {
                    const placeid = row[options.csvlinkfield];
                    if (! placeid) return console.error(`createHexMap() CSV file ${options.csvfile} has a row with blank value for ${options.csvlinkfield}`);
                    if (CSVDATA[placeid]) return console.error(`createHexMap() CSV file ${options.csvfile} has more than 1 row with ${options.csvlinkfield} = '${placeid}'`);
                    CSVDATA[placeid] = row;
                });

                // similarly for geo-data; warn about duplicates & blanks
                geodata.features.forEach((feature) => {
                    const placeid = feature.properties[options.geolinkfield];
                    if (! placeid) return console.error(`createHexMap() GeoJSON file ${options.geofile} has a record with blank value for ${options.geolinkfield}`);
                    if (PLACEDATA[placeid]) return console.error(`createHexMap() GeoJSON file ${options.geofile} has more than 1 row with ${options.geolinkfield} = '${placeid}'`);
                    feature.properties._name = feature.properties[options.geonamefield];  // standardize a name field
                    feature.properties._label = feature.properties[options.geolabelfield];  // standardize a map label field
                    PLACEDATA[placeid] = feature.properties;
                });

                // breaks auto-calculation, if a comm-joined list was not provided
                // number of breaks = number of colors - 1
                if (options.breaks == 'auto') {
                    // find quantiles to make up 5 equal-interval classes
                    // thanks to buboh at https://stackoverflow.com/questions/48719873/how-to-get-median-and-quartiles-percentiles-of-an-array-in-javascript-or-php
                    const asc = arr => arr.sort((a, b) => a - b);
                    const quantile = (arr, q) => {
                        const sorted = asc(arr);
                        const pos = ((sorted.length) - 1) * q;
                        const base = Math.floor(pos);
                        const rest = pos - base;
                        if ((sorted[base + 1] !== undefined)) {
                            return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
                        } else {
                            return sorted[base];
                        }
                    };

                    const allscores = Object.values(CSVDATA).map(csvinfo => parseFloat(csvinfo[options.csvvaluefield]));
                    const howmanybreaks = options.colors.length - 1;
                    const interval = 1 / options.colors.length;

                    options.breaks = [];
                    for (let i=1; i<=howmanybreaks; i++) {
                        const brk = Math.round(quantile(allscores, interval * i));
                        options.breaks.push(brk);
                    }
                }

                // start up the map
                MAP = L.map(divid, {
                    attributionControl: false,
                    zoomControl: false,
                    dragging: false,
                    doubleClickZoom: false,
                    boxZoom: false,
                    keyboard: false,
                    touchZoom: false,
                    scrollWheelZoom: false,
                    zoomSnap: 0.01,
                });

                // add the GeoJSON hex grid
                // adding colors based on value, and tooltip/popup content
                MAP.PLACES = L.geoJSON(geodata, {
                    // style = fetch CSV value for this place, compare to the breaks, to pick the color
                    style: function (feature) {
                        const style = {
                            color: 'black',
                            weight: 0.25,
                            fillOpacity: 1,
                        };

                        const placeid = feature.properties[options.geolinkfield];
                        const csvinfo = CSVDATA[placeid];
                        const value = (csvinfo ? parseFloat(csvinfo[options.csvvaluefield]) : null) || Infinity;

                        for (let i=0, l=options.breaks.length; i<l; i++) {
                            const maxval = options.breaks[i];
                            const color = options.colors[i];

                            if (value <= maxval) {
                                style.fillColor = color;
                                break;
                            }
                        }
                        if (! style.fillColor) style.fillColor = options.colors[options.breaks.length] || 'transparent';

                        return style;
                    },
                    // after features are on the map
                    // set their tooltip / popup content
                    // and give them a label via DivIcon
                    onEachFeature: function (feature, layer) {
                        // create a DivIcon and position it, thus labels
                        const placeid = feature.properties[options.geolinkfield];
                        const labeltext = PLACEDATA[placeid]._label;
                        const latlng = layer.getBounds().getCenter();

                        if (labeltext) {
                            const label = document.createElement('SPAN');
                            label.innerText = labeltext;

                            L.marker(latlng, {
                                icon: L.divIcon({ className: "hexmap-map-label", html: label, }),
                            }).addTo(MAP);
                        }
                    },
                })
                .bindPopup(function (layer) {
                    // run user-supplied content through SPANs and use .textContent to sanitize HTML/JS
                    const placeid = layer.feature.properties[options.geolinkfield];
                    const name = PLACEDATA[placeid]._name;
                    let value = CSVDATA[placeid][options.csvvaluefield];
                    if (typeof value == 'number') value = value.toLocaleString();

                    const nameblock = document.createElement('STRONG');
                    nameblock.textContent = name;

                    const valueblock = document.createElement('DIV');
                    valueblock.textContent = `${options.prefix}${value}${options.suffix}`;

                    const content = document.createElement('DIV');
                    content.appendChild(nameblock);
                    content.appendChild(valueblock);

                    return content;
                })
                .bindTooltip(function (layer) {
                    // run user-supplied content through SPANs and use .textContent to sanitize HTML/JS
                    const placeid = layer.feature.properties[options.geolinkfield];
                    const name = PLACEDATA[placeid]._name;
                    let value = CSVDATA[placeid][options.csvvaluefield];
                    if (typeof value == 'number') value = value.toLocaleString();

                    const nameblock = document.createElement('STRONG');
                    nameblock.textContent = name;

                    const valueblock = document.createElement('DIV');
                    valueblock.textContent = `${options.prefix}${value}${options.suffix}`;

                    const content = document.createElement('DIV');
                    content.appendChild(nameblock);
                    content.appendChild(valueblock);

                    return content;
                })
                .addTo(MAP);

                // add a legend
                let legend;
                if (options.legendtitle) {
                    legend = document.createElement('DIV');
                    legend.classList.add('hexmap-legend');
                    legend.classList.add(`hexmap-legend-${options.legendlocation}`);

                    const title = document.createElement('strong');
                    title.classList.add('hexmap-legend-title');
                    title.innerText = options.legendtitle;
                    legend.appendChild(title);

                    for (let i=0, l=options.colors.length; i<l; i++) {
                        const maxval = options.breaks[i];
                        const priormaxval = options.breaks[i - 1];
                        const color = options.colors[i];
                        const first = i == 0;
                        const last = i == options.colors.length - 1;

                        const entry = document.createElement('div');
                        entry.classList.add('hexmap-legend-entry');

                        const swatch = document.createElement('span');
                        swatch.classList.add('hexmap-legend-swatch');
                        swatch.style.background = color;
                        swatch.role = 'img';
                        entry.appendChild(swatch);

                        const label = document.createElement('span');
                        label.classList.add('hexmap-legend-label');
                        if (first) label.innerText = `0 - ${maxval.toLocaleString()}${options.suffix}`;
                        else if (last) label.innerText = `> ${priormaxval.toLocaleString()}${options.suffix}`;
                        else label.innerText = `${maxval.toLocaleString()}`;
                        entry.appendChild(label);

                        legend.appendChild(entry);
                    }

                    MAP._container.appendChild(legend);
                }

                // fit the bounds, but try to shift upward to accommodate the legend
                function fitMapBounds () {
                    const fitboundsoptions = {};
                    if (options.legendtitle && legend) {
                        fitboundsoptions.paddingBottomRight = [0, 0];
                        const h = legend.offsetHeight;
                        if (h > 50) {
                            fitboundsoptions.paddingBottomRight[0] = h - 50;
                            fitboundsoptions.paddingBottomRight[1] = 0;
                        }
                    }
                    MAP.fitBounds(MAP.PLACES.getBounds(), fitboundsoptions);
                }
                MAP.on('popupclose', function () {
                    fitMapBounds();
                });
                MAP.on('resize', function () {
                    MAP.closePopup();
                    fitMapBounds();
                });
                fitMapBounds();

                // add a Download PNG button
                if (options.downloadbuttoncssclass) {
                    const button = document.createElement('button');
                    button.innerText = 'Download PNG';
                    button.className = options.downloadbuttoncssclass;
                    bottomarea.appendChild(button);

                    button.addEventListener('click', () => {
                        domtoimage
                            .toPng(div)
                            .then(function (dataUrl) {
                                const link = document.createElement('a');
                                link.download = 'map.png';
                                link.href = dataUrl;
                                link.click();
                            })
                            .catch(function (error) {
                                console.error('createHexMap() PNG export failed', error);
                            });
                    });
                }

                // add the caption
                if (options.caption) {
                    const caption = document.createElement('DIV');
                    caption.id = `${divid}-caption`;
                    caption.textContent = options.caption;
                    bottomarea.appendChild(caption);
                    div.setAttribute('aria-described-by', caption.id);
                }
            },
            error: function() {
                console.error(`createHexMap() Could not load CSV file ${csvurl}`);
            },
        });
    }).fail(function () {
        console.error(`createHexMap() Could not load GeoJSON file ${geourl}`);
    });
}
