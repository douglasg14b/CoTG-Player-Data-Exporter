// ==UserScript==
// @name         Rankings Exporter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       Douglas Gaskell
// @match        https://w5.crownofthegods.com/includes/gPi.php
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    (function addLibraries(){
      var script1 = document.createElement("script");
      script1.setAttribute("src", "https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js");
      document.body.appendChild(script1);

      var script2 = document.createElement("script");
      script2.setAttribute("src", "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/4.1.2/papaparse.min.js");
      document.body.appendChild(script2);

      window.setTimeout(main, 250);
    })();

    function main(){
       setupPage();
        bindEvents();
    }

})();

var initialRankingsLoaded = false;
var worldRankingsData = [];
var playerInfoData = [];
var loadedCount = 0;
var ignoredCount = 0;
var currentIndex = 0;
var loadDelay = 500;
var paused = false;

//Loads the basic list of all world rankings
function loadWorldRankings(){
    $.ajax({
        url: 'https://w5.crownofthegods.com/includes/gR.php',
        data: {a: 0},
        type: 'get'
    }).then(function(results){
        initialRankingsLoaded = true;
        processWorldRankings(JSON.parse(results)[0]);
        $('#loadRankingsBtn').text('Load Player Data');
    });
}

function processWorldRankings(data){
    $('#rankingsCount').text(data.length);
    worldRankingsData = data;
}

function loadIndividualRankings(data){
    if(!paused){
        if(currentIndex <= data.length){
            if(Number(data[currentIndex]['3']) > 3){
              $.ajax({
                  url: 'https://w5.crownofthegods.com/includes/gPi.php',
                  type: 'post',
                  data: {a: data[currentIndex]['1']}
              }).then(function(results){
                  iterateLoadingText();
                  handleIndividualRankingResult(results, data, currentIndex);
              });
            } else {
                ignoredCount++;
                currentIndex++;
                $('#rankingsIgnored').text(ignoredCount);
                loadIndividualRankings(data, currentIndex);
            }
        } else {
            doneLoading();
        }
    }
}

function handleIndividualRankingResult(results, data){
    loadedCount ++;
    $('#rankingsLoaded').text(loadedCount);
    playerInfoData.push(processIndividualRanking(JSON.parse(results)));
    console.log(processIndividualRanking(JSON.parse(results)));

    currentIndex++;
    window.setTimeout(function(){
        loadIndividualRankings(data);
    }, loadDelay);
}

function processIndividualRanking(data){
    var playerInfo = {};

    for(let key in playerDataMap){
        if(key === 'cities'){
            playerInfo[key] = processCitiesArray(data[playerDataMap[key]]);
        } else {
            playerInfo[key] = data[playerDataMap[key]];
        }
    }

    return playerInfo;
}

function processCitiesArray(array){
    var cities = [];
    for(let i = 0; i < array.length; i++){
        let city = {};
        for(let key in cityDataMap){
            city[key] = array[i][cityDataMap[key]];
        }
        cities.push(city);
    }
    return cities;
}

function sendPlayerDataToApp(){
    console.log('sending data...');
    $.ajax({
        url: 'https://script.google.com/macros/s/AKfycbzx5Lni66IqEInUvMr2-egCUFh_wa2vKLxm05Iuc3Kqw9lHi6cX/exec',
        type: 'post',
        crossDomain: true,
        data: {a:JSON.stringify(playerInfoData)}
    });
}

function downloadCsv(){
    let flattened = flattenData(playerInfoData);
    let mapped = mapData(flattened);

    let csv = Papa.unparse(mapped);
    let blob = new Blob([csv], {type: 'text/csv'});
    let url = window.URL.createObjectURL(blob);

    let a = document.createElement('a');
    a.href        = url;
    a.target      = '_blank';
    a.download    = 'playerData.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
}

//Flattens the data structure out
function flattenData(data){
  var output = [];
  var timestamp = new Date().getTime();
  for(let i = 0; i < data.length; i++){
    for(let ii = 0; ii < data[i]['cities'].length; ii++){
      var city = data[i]['cities'][ii];
      city['timestamp'] = timestamp;
      city['alliance'] = data[i]['alliance'];
      city['player'] = data[i]['name'];
      output.push(city);
    }
  }
  return output;
}

//maps the data out into proper arrays for insertion into a sheet
function mapData(data){
  var output = [];
  for(var i = 0; i < data.length; i++){
    var city = [];
    for(var ii = 0; ii < columnMappings.length; ii++){
      city[ii] = data[i][columnMappings[ii]];
    }
    output.push(city);
  }
  return output;
}

/* Page Manipulation */

function iterateLoadingText(){
    let loadBtn = $('#loadRankingsBtn');
    let periodCount = Math.max(loadBtn.text().split('.').length - 1, 0);

    if(periodCount < 3){
        periodCount ++;
    } else {
        periodCount = 0;
    }

    let text = 'Loading';
    for(let i = 0; i < periodCount; i++){
        text += '.';
    }
    loadBtn.text(text);
}

function doneLoading(){
    $('#loadRankingsBtn').text('Complete');
}


/* Page Setup */
function setupPage(){
    $('body').html('');
    $('body').append(basePageHtml);
}

function bindEvents(){
    $('#loadRankingsBtn').on('click', function(){
        if(!initialRankingsLoaded){
            loadWorldRankings();
        } else {
            loadIndividualRankings(worldRankingsData);
            $(this).attr('disabled', true);
        }
    });

    $('#stopLoading').on('click', function(){
        if(!paused){
            paused = true;
            $(this).text('Resume');
            $('#loadRankingsBtn').text('Paused');
        } else {
            paused = false;
            $(this).text('Pause');
            loadIndividualRankings(worldRankingsData);
        }

    });

    $('#postData').on('click', function(){
        sendPlayerDataToApp();
    });

    $('#downloadCsv').on('click', function(){
        downloadCsv();
    });
}


var basePageHtml = '\
<div style="padding: 2em;">\
    <div>\
        <button id="loadRankingsBtn" style="width: 150px;" >Load Rankings </button>\
        <button id="stopLoading">Pause</button>\
        <button id="postData">Send Data</button>\
        <button id="downloadCsv">Download CSV</button>\
    </div>\
    <table style="margin-top:1.5em; border-collapse: collapse; border: 1px solid black;">\
        <thead>\
            <tr>\
                <td style="border: 1px solid black;">Rankings Found</td>\
                <td style="border: 1px solid black;">Total Loaded</td>\
                <td style="border: 1px solid black;">Total Ignored</td>\
            </tr>\
        </thead>\
        <tbody>\
            <tr>\
                <td  style="border: 1px solid black;" id="rankingsCount">0</td>\
                <td  style="border: 1px solid black;" id="rankingsLoaded">0</td>\
                <td  style="border: 1px solid black;" id="rankingsIgnored">0</td>\
            </tr>\
        </tbody>\
    </table>\
</div>';

var playerDataMap = {
    'alliance': 'a',
    'score': 'b',
    'name': 'player',
    'cities': 'h'
};

var cityDataMap = {
    'score': 'a',
    'xCoord': 'b',
    'yCoord': 'c',
    'continent': 'd',
    'isCastle':'e',
    'isWater': 'f',
    'isTemple': 'g',
    'name': 'h',
    'id': 'i'
};

var columnMappings = [
  'timestamp',
  'player',
  'alliance',
  'score',
  'continent',
  'isCastle',
  'isWater',
  'isTemple',
  'xCoord',
  'yCoord',
  'name',
  'id'
];











