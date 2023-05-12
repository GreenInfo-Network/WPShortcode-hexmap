<?php
/**
 * HEX-MAP SHORTCODE
 * [hexmap]
 * shortcode to show a USA hex map, colorized by a field from a CSV
 * see also hexmaps.js and hexmaps.css which provide the frontend code, including the params & options
 *
 * example:
 * [hexmap geofile="us_states_hexgrid.geojson" geonamefield="google_name" geolabelfield="state_abv" csvfile="2022_General_Turnout_Rates.csv" csvlinkfield="state_abv" geolinkfield="state_abv" csvdatafield="Turnout Rate" breaks="40,45,50,55" colors="#edf8e9,#c7e9c0,#a1d99b,#74c476,#31a354" prefix="Turnout Rate: " suffix="%" legendtitle="Turnout Rate"]
 */

add_shortcode('hexmap', function ($atts) {
    // set defaults, validate, split comma-joined strings into lists
    $atts = shortcode_atts(array(
        'geofile' => 'us_states_hexgrid.geojson',  // string
        'geonamefield' => '',  // string
        'geolabelfield' => '',  // string
        'csvfile' => '',  // string
        'csvvaluefield' => '',  // string
        'csvlinkfield' => 'state_abv',  // string
        'geolinkfield' => 'state_abv',  // string
        'breaks' => 'auto',  // comma-joined list of numbers will be split into an array, or else string "auto"
        'colors' => '#f7f7f7,#cccccc,#969696,#636363,#252525',  // comma-joined list of color strings; will be split into an array
        'prefix' => '',  // string
        'suffix' => '',  // string
        'legendtitle' => '',  // string
        'legendlocation' => 'lowerright',  // string
        'downloadbuttoncssclass' => 'btn btn-sm btn-primary mt-1',  // string or blank
        'caption' => '',  // string
        'width' => '',  // string
    ), $atts);

    if ($atts['breaks'] != 'auto') {
        $atts['breaks'] = array_map(function ($i) { return (float) $i; }, explode(',', $atts['breaks']));
    }
    $atts['colors'] = explode(',', $atts['colors']);

    // enqueue necessary libraries
    wp_enqueue_script('papaparse', get_template_directory_uri() . '/libraries/papaparse-5.4.1.min.js');

    wp_enqueue_script('leaflet', get_template_directory_uri() . '/libraries/leaflet-1.9.3.js');
    wp_enqueue_style('leaflet', get_template_directory_uri() . '/libraries/leaflet-1.9.3.css');

    wp_enqueue_script('domtoimage', get_template_directory_uri() . '/libraries/domtoimagemore-3.1.6.min.js');

    wp_enqueue_script('hexmaps', get_template_directory_uri() . '/functions-hexmaps.js');
    wp_enqueue_style('hexmaps', get_template_directory_uri() . '/functions-hexmaps.css');

    // construct and return HTML
    $attrsjson = json_encode($atts);
    $divid = 'hexmap-' . md5(rand());
    $html = "
        <div class=\"hexmap-wrapper\">
            <div id=\"$divid\" class=\"hexmap\" role=\"img\" aria-label=\"Map\"></div>
            <div class=\"hexmap-after\" id=\"$divid-after\"></div>
            <script>window.addEventListener('DOMContentLoaded', () => { createHexMap('$divid', $attrsjson); });</script>
        </div>
    ";
    return $html;
});
