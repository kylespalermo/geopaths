let myKey;

var loadingNotification = document.createElement("div")
loadingNotification.innerHTML = "fetching data"
loadingNotification.setAttribute("id", "loadingNotification")
document.getElementById("wrapper").appendChild(loadingNotification)

fetch(".netlify/functions/api")
.then(response => response.json())
.then(json => {
    myKey = json.api;
})

var geoJsons = [];
var firstRun = true;

var gradientBase = Math.floor(Math.random()*360);
var gradientBaseHold;

var mapDataWrapper;
var placeName = "string";

//create array of two mostly empty geoJson structures, each with two features for one "observations" line and one "border" line
function createMapDataWrapper(){
    mapDataWrapper = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                "name": "observations",
                "metadata": []
                },
                "geometry": {
                "type": "LineString",
                "coordinates": []
                }
            },
            {
                "type": "Feature",
                "name": "border",
                "geometry": {
                "type": "LineString",
                "coordinates": []
                }
            }
            ]
        }
}


//the different paths to grab data from our JSON response from iNaturalist
const attributesRequests = ["id", "taxon.name", "species_guess", "location", "observed_on_details.date", "user.login", "place_guess", "photos"];

var sourceCoords = []
var currentCoords = []

//load the GPS coordinates of the actual border from our CSV file
var psv = d3.dsvFormat("\n");

d3.request("all_coords.txt")
    .mimeType("text/plain")
    .response(function(csvData) { return psv.parse(csvData.response) })
    .get(function(csvData) {
    for (i in csvData) {
    sourceCoords.push(csvData[i][Object.keys(csvData[i])[0]].split(","))
    if (sourceCoords.length == csvData.length) {
        firstFunction();
        }
    }
});

//simple function that returns a random position in the sourcecoords array
function makeRandNum(){
    return randNum = Math.floor(Math.random() * sourceCoords.length)
}

//function for accessing json paths with special characters
//borrowed this from user speigg @ https://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-and-arrays-by-string-path
function resolve(path, obj) {
    return path.split('.').reduce(function(prev, curr) {
    return prev ? prev[curr] : null
    }, obj || self)
}

//the first time this runs, we need to load two maps, instead of 1 incrementally, so this just tells it to run sendRequest twice
function firstFunction(){
if (firstRun) {
    createMapDataWrapper();
    for (let i = 0; i < 2; i++) {
        sendRequest();
        }
    firstRun = false;
    }
}

//this sends our request to iNaturalist and returns our data
function sendRequest(){
    var randNum = makeRandNum();

    currentCoords.push(sourceCoords[randNum])

    var requestURL = `https://api.inaturalist.org/v1/observations?photos=true&lat=${sourceCoords[randNum][1]}&lng=${sourceCoords[randNum][0]}&radius=5&&per_page=200&order=desc&order_by=created_at`

    var myRequest = new Request(requestURL);

    fetch(myRequest)
        .then(response => response.json())
        .then(data => {
        var results = data.results
        // console.log(results)
        if (results.length < 2) {
            results = null;
            console.log("scrapped")
            sendRequest();
            return;
            } else {
            loadObservationData(results, randNum)
            }      
            })
        .catch(console.error);
}

//push all of the results to our data wrapper
function loadObservationData(results, sourceCoordNum){
    for (i in results) {
        var valuesWrapper = {};
        for (j in attributesRequests) {
            var value = resolve(attributesRequests[j], results[i])
            valuesWrapper[attributesRequests[j]] = value;
            }

        mapDataWrapper.features[0].properties.metadata.push(valuesWrapper)
            
        var coord = [results[i].geojson.coordinates[0], results[i].geojson.coordinates[1]]
        mapDataWrapper.features[0].geometry.coordinates.push(coord);
        
        if (i == results.length-1 || results.length == 0) {
        loadBorderData(sourceCoordNum);
        }
    }
}

//retrieve the border coordinates on both sides the request source coordinate and load the GeoJsons' "border" objects
//50 is a just a meaningless increment to hopefully ensure that the border line stretches across the entire SVG
function loadBorderData(sourceCoordNum){
for (let i = -100; i <= 100; i++) {
    var pushThis = sourceCoords[sourceCoordNum + i];
    //but only push if it isn't undefined; if it reaches too far back or too far forward in the list, just ignore
    if(pushThis) {
        mapDataWrapper.features[1].geometry.coordinates.push(pushThis)
        }
    }
    
    if (mapDataWrapper.features[1].geometry.coordinates.length > 1) {
        pushMapData();
        }
}

//push our data wrapper to our geoJsons array and then create a new, empty data wrapper. Then, only if we have a complete set of two GeoJSONs, run our d3 script
function pushMapData(){
    geoJsons.push(mapDataWrapper)
    createMapDataWrapper();
    if (geoJsons.length == 2){
        runD3(); 
    }
}

//get a Google maps static image of the request source coordinate for the main map
function getPlaceImage(){
    var placeRequestCoords = currentCoords[0][1] + "," + currentCoords[0][0];
    var satImageURL =  "https://maps.googleapis.com/maps/api/staticmap?center=" + placeRequestCoords + "&zoom=10&size=400x300&scale=1&maptype=satellite&key=" + myKey;
    var satImage = document.createElement("div")
    satImage.setAttribute("class", "satImage")
    satImage.style.backgroundImage = `url(${satImageURL})`
    document.getElementById("wrapper").appendChild(satImage)
}


//get an approximate place name for that coordinate
function getPlaceName(){

    var placeRequestCoords = currentCoords[0][1] + "," + currentCoords[0][0];
    console.log(placeRequestCoords)

    var placeNameURL = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${placeRequestCoords}&result_type=political&key=${myKey}`
    console.log(placeNameURL)
    var placeNameRequest = new Request(placeNameURL);

    fetch(placeNameRequest)
        .then(response => response.json())
        .then(data => {
        var results = data.results
        console.log(data)
        placeName = results[0].formatted_address
        console.log(placeName)
        var placeContainer = document.createElement("div")
        placeContainer.setAttribute("class", "placeContainer")
        placeContainer.innerHTML = placeName;
        document.getElementById("wrapper").appendChild(placeContainer)
        })
        .catch(console.error);
}

//grabs the site static text I wrote and pumps it into the grid
function createSiteDescription(){
    var siteDescription = document.createElement("div")
    siteDescription.setAttribute("class", "siteDescription")
    siteDescription.innerHTML = siteDescriptionText;
    document.getElementById("wrapper").appendChild(siteDescription)
}


//all of the D3 stuff is wrapped in here
function runD3(){

    //clear everything 
    d3.select("#loadingNotification").remove()
    d3.select("#textCell").remove()
    d3.select(".satImage").remove()
    d3.selectAll(".observationsMap").remove()
    d3.selectAll(".placeContainer").remove()
    d3.select(".siteDescription").remove()

    var container = d3.select("#wrapper")

    container.selectAll("div")
        .data(geoJsons)
        .enter()
            .call(makeMap)
    
    function makeMap(ele) {
        ele
            .append("div")
            .attr("class", "observationsMap")
            .attr("id", function(d,i) {return `observationsMap_${i}`})
            .insert("svg")
                .attr("class", "svgMain")
                .attr("viewBox", "0 0 100 75")
                .attr("id", function(d,i) {
                    return `svg_${i}`
                })

        
    }

    var svgMain = d3.select("#svg_0")
        .on("mouseenter", makeCircles)
        .on("mouseleave", deleteCircles)

    var svgSmall = d3.select("#svg_1")
        .on("click", function(){
            addLoadingImg();
            shiftMaps();
        })

    var newPath = d3.selectAll(".svgMain")
        .each(makeLine)

    //draw geopaths using request data
    function makeLine(d,i) {
        var projection = d3.geoEquirectangular()
            .fitSize([100, 100], geoJsons[i].features[0])

        var whichSVG = i;
        makeGradient(i);

        d3.select(this)
            .selectAll("path")
            .data(d.features)
            .enter()
                .append("path")
                .attr("d", function(d,i) {        
                    var geoGenerator = d3.geoPath()
                        .projection(projection)
                    return geoGenerator(d);
                })
                .attr("class", function(d,i){if (i==0) {return "obsLine"} else {return "borderLine"}})
                .attr("fill", "none")
                .attr("stroke", function(d,i) {
                    if (i == 0) {
                        return `url(#gradient_${whichSVG})`
                    } else {
                        return "white"
                    }
                })
    }

    var textCell = d3.select("#wrapper")
        .append("div")
        .attr("id", "textCell")

    var metaDataList = d3.select("#textCell")
        metaDataList.selectAll("div")
        .data(geoJsons[0].features[0].properties.metadata)
        .enter()
            .append("div")
            .html(function (d) {return d.location})
            .attr("class", "coordinatesList")
            .attr("id", function (d,i) {return `textbox_${d.id}`})

    //create circles on hover
    function makeCircles(){

        var hoveredSVG = d3.select(this)

        var projection = d3.geoEquirectangular()
            .fitSize([100, 100], geoJsons[0].features[0])

        hoveredSVG.selectAll("circle")
            .data(geoJsons[0].features[0].geometry.coordinates)
                .enter()
                .append("circle")
                .attr("fill", function(){return makeColor(gradientBaseHold)})
                    .attr("cx", function(d) {
                        return projection([d[0], d[1]])[0];
                        })
                        .attr("cy", function(d) {
                        return projection([d[0], d[1]])[1];
                        })
                        .attr("r", 1)
                        .on("mouseenter", function(d,i) {
                            highlightText(i)
                        })
                        .on("mouseleave", function(d,i){
                            removeHighlightText(i);
                        })
                        .on("click", function(d,i){
                            deleteMetaData(i)
                            appendMetaData(i);
                        })
    }

    //remove circles on mouseeout, setTimeOut allows me to set a click event on the individual circles
    function deleteCircles(){
        var circles = d3.selectAll("circle")
        setTimeout(function(){
            circles.remove()
            }, 1)
    }

    //on click event for the small map, delete the first item in our data array, push the small map's data to the first position in our two-item data array, then run sendRequest to fill in a new second data item
    function shiftMaps(){
        currentCoords.shift();
        geoJsons.shift();
        sendRequest();
    }

    //for each circle, highlights the corresponding gps coordinate pair in the list 
    function highlightText(index){
        var metaData = geoJsons[0].features[0].properties.metadata[index]
        var textBox = d3.select(`#textbox_${metaData.id}`)
        textBox.style("color", makeColor(gradientBaseHold))
        document.getElementById(`textbox_${metaData.id}`).scrollIntoView();
    }

    //cancels the highlight
    function removeHighlightText(index){
        var metaData = geoJsons[0].features[0].properties.metadata[index]
        var textBox = d3.select(`#textbox_${metaData.id}`)
        textBox.style("color", "black")
    }

    //appends metadata to gps coord pair text on circle click
    function appendMetaData(index){
        var metaData = geoJsons[0].features[0].properties.metadata[index]
        var textBox = d3.select(`#textbox_${metaData.id}`)
        textBox.style("color", makeColor(gradientBaseHold))
        textBox
            .append("div")
            .attr("class", "metaData")
            .html(
            `
            <img class = "metaDataImage" src = ${metaData.photos[0].url.replace("square", "original")}>
            <div class = "metaData attribution">${metaData.photos[0].attribution}</div>
            <div class = "metaData species">${metaData.species_guess + " (" + metaData["taxon.name"] + ")"}</div>  
            <div class = "metaData dateLink">${metaData["observed_on_details.date"]}. <a href = https://www.inaturalist.org/observations/${metaData.id}>Full observation.</a></div>  
            `
            )
        }

    //deletes the metadata
    function deleteMetaData(index){
        var metaData = geoJsons[0].features[0].properties.metadata[index]
        var textBox = d3.select(`#textbox_${metaData.id}`)
        textBox.style("color", "black")
        d3.select(".metaData").remove();
    }

    function makeColor(hue) {
        return d3.color(`hsl(${hue}, 94%, 61%)`)
    }

    function makeGradient(index){
        console.log("ran makegradient" + index)
        var gradientStop1 = makeColor(gradientBase);
        var gradientStop2 = makeColor(gradientBase + 40);

        if (index == 0) {gradientBaseHold = gradientBase}
        document.querySelector(':root').style.setProperty("--gradientBase", makeColor(gradientBaseHold));

        var defs = d3.select(`#svg_${index}`).append("defs")
        
        var gradient = 
            defs
                .insert("linearGradient")
                    .attr("id", `gradient_${index}`)
                    .attr("x1", "0%")
                    .attr("y1", "0%")
                    .attr("x2", "100%")
                    .attr("y2", "100%")

        gradient.append("stop")
            .attr("class", "start")
            .attr("offset", "0%")
            .attr("stop-color", gradientStop1)
            .attr("stop-opacity", 1)

        gradient.append("stop")
            .attr("class", "end")
            .attr("offset", "100%")
            .attr("stop-color", gradientStop2)
            .attr("stop-opacity", 1)

        gradientBase += 40;

    }

    function addLoadingImg() {
        var loadingGroup = d3.select("#svg_1").append("g")
        
        for (let i = 0; i < 3; i++) {
        loadingGroup.append("circle")
            .attr("id", `loadingCircle_${i}`)
            .attr("fill", "#fff")
            .attr("stroke", "none")
            .attr("cx", function() {
                if (i == 0) {
                    return 50 - (5);
                } else if (i == 1) {
                    return 50 
                } else if (i == 2) {
                    return 50 + (5)
                }
            })
            .attr("cy", 32.5)
            .attr("r", 2)
            .attr("fill", makeColor(gradientBase))
            .style("opacity", 0)
               
    }

    repeat();

    function repeat(){
        for (let i = 0; i < 3; i++) {
        d3.select(`#loadingCircle_${i}`)
        .transition()
        .duration(500)
        .delay(i * 200)
        .style("opacity", 1)
        .transition()
        .style("opacity", 0)
        .on("end", repeat)
        }
    }
}


    //add our place name/image and populate the site description
    getPlaceName();
    getPlaceImage();
    createSiteDescription();
}