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
       let worldCityGetter = new worldCityDataGetter();
       console.log(worldCityGetter)
       worldCityGetter.setupPage();
       worldCityGetter.bindEvents();
    }

})();

function worldCityDataGetter(){
    let self = this;

    self.initialRankingsLoaded = false;
    self.worldRankingsData = [];
    self.playerInfoData = [];
    self.loadedCount = 0;
    self.ignoredCount = 0;
    self.currentIndex = 0;
    self.loadDelay = 500;
    self.paused = false;

    self.csvColumnMappings = [
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
    self.mappings = new dataMappings();

    self.setupPage = setupPage;
    self.bindEvents = bindEvents;

    /*******************************************
        ====== Getting and Processing ======
    ********************************************/
    
    //Loads the basic list of all world rankings
    function loadAllWorldRankings(){
        $.ajax({
            url: 'https://w5.crownofthegods.com/includes/gR.php',
            data: {a: 0},
            type: 'get'
        }).then(function(results){
            self.initialRankingsLoaded = true;
            processWorldRankings(JSON.parse(results)[0]);
            $('#loadRankingsBtn').text('Load Player Data');
        });
    }    

    //Handles the setting of the rankings data 
    function processWorldRankings(data){
        $('#rankingsCount').text(data.length);
        self.worldRankingsData = data;
    }

    //Loads the city data for each player, one at a time
    function loadIndividualRankings(data){
        if(!self.paused){
            if(self.currentIndex <= data.length){
                if(Number(data[self.currentIndex]['3']) > 3){
                    $.ajax({
                        url: 'https://w5.crownofthegods.com/includes/gPi.php',
                        type: 'post',
                        data: {a: data[self.currentIndex]['1']}
                    }).then(function(results){
                        iterateLoadingText();
                        handlePlayerCityData(results, data, self.currentIndex);
                    });
                } else {
                    self.ignoredCount++;
                    self.currentIndex++;
                    $('#rankingsIgnored').text(self.ignoredCount);
                    loadIndividualRankings(data, self.currentIndex);
                }
            } else {
                doneLoading();
            }
        }
    }

    //Handles the result from loading the city data for an individual player
    function handlePlayerCityData(results, data){
        self.loadedCount ++;
        $('#rankingsLoaded').text(self.loadedCount);
        self.playerInfoData.push(processCityData(JSON.parse(results)));
        console.log(processCityData(JSON.parse(results)));

        self.currentIndex++;

        window.setTimeout(function(){
            loadIndividualRankings(data);
        }, self.loadDelay);
    }

    //Maps the player data from the results and returns
    function processCityData(data){
        var playerInfo = {};

        for(let key in self.mappings.playerDataMap){
            if(key === 'cities'){
                playerInfo[key] = processCitiesArray(data[self.mappings.playerDataMap[key]]);
            } else {
                playerInfo[key] = data[self.mappings.playerDataMap[key]];
            }
        }

        return playerInfo;
    }

    //Maps the city data from the results and returns
    function processCitiesArray(array){
        var cities = [];
        for(let i = 0; i < array.length; i++){
            let city = {};
            for(let key in self.mappings.cityDataMap){
                city[key] = array[i][self.mappings.cityDataMap[key]];
            }
            cities.push(city);
        }
        return cities;
    }

    /*******************************************
         ====== Sending/Downloading ======
    ********************************************/

    function downloadCsv(){
        let flattened = flattenData(self.playerInfoData);
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
        output.push(self.csvColumnMappings);

        for(var i = 0; i < data.length; i++){
            var city = [];
            for(var ii = 0; ii < self.csvColumnMappings.length; ii++){
            city[ii] = data[i][self.csvColumnMappings[ii]];
            }
            output.push(city);
        }
        return output;
    }

    /*******************************************
           ====== DOM Manipulation ======
    ********************************************/

    //Animates the loading button text
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
        $('body').append(self.html);
    }

    //Binds events to this modules DOM elements
    function bindEvents(){
        $('#loadRankingsBtn').on('click', function(){
            if(!self.initialRankingsLoaded){
                loadAllWorldRankings();
            } else {
                loadIndividualRankings(self.worldRankingsData);
                $(this).attr('disabled', true);
            }
        });

        $('#stopLoading').on('click', function(){
            if(!self.paused){
                self.paused = true;
                $(this).text('Resume');
                $('#loadRankingsBtn').text('Paused');
            } else {
                self.paused = false;
                $(this).text('Pause');
                loadIndividualRankings(self.worldRankingsData);
            }

        });


        $('#downloadCsv').on('click', function(){
            downloadCsv();
        });
    }


    self.html = '\
    <div style="padding: 2em;">\
        <div>\
            <button id="loadRankingsBtn" style="width: 150px;" >Load Rankings </button>\
            <button id="stopLoading">Pause</button>\
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
}

//Mappings of data sources from endpoints
function dataMappings(){
    let self = this;

    self.playerDataMap = {
        'alliance': 'a',
        'score': 'b',
        'name': 'player',
        'cities': 'h'
    };

    self.cityDataMap = {
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
}












