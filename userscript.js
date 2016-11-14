// ==UserScript==
// @name         Rankings Exporter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       Douglas Gaskell
// @match        https://w5.crownofthegods.com/includes/gPi.php
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/PapaParse/4.1.2/papaparse.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.4/semantic.min.js
// @require      https://ajax.googleapis.com/ajax/libs/angularjs/1.5.7/angular.min.js
// @resource semanticCss https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.4/semantic.min.css
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle (GM_getResourceText ("semanticCss"));

    let page = new mainPage();
    page.setup();  

    let module = angular.module('app', [])
        .controller('mainController', ['$scope', mainController])
        .controller('cityDataCtrl', ['$scope', '$http', cityDataCtrl])
        .controller('scoutDataCtrl', ['$scope', '$http', scoutDataCtrl]);

    angular.bootstrap(document, ['app']);

    function main(){


       /*let worldCityGetter = new worldCityDataGetter();
       console.log(worldCityGetter)
       worldCityGetter.setupPage();
       worldCityGetter.bindEvents();*/
    }

})();


function mainController($scope){
    let self = this;
    self.switchMode = switchMode;
    self.mode = 'none';

    function switchMode(mode){
        console.log(mode);
        self.mode = mode;
    }
}

function cityDataCtrl($scope, $http){
    let self = this;

    self.initialRankingsLoaded = false;
    self.worldRankingsData = [];
    self.citiesData = []; //Was playerInfoData
    self.loadedCitiesCount = 0;
    self.ignoredCount = 0;
    self.currentIndex = 0;
    self.loadDelay = 200;
    self.loading = false;
    self.paused = false;
    self.complete = false;

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

    self.loadWorldRankings = loadWorldRankings;
    self.loadCityData = loadCityDataPerPlayer;
    self.downloadCsv = downloadCsv;
    self.pause = pause;
    self.resume = resume;

    function pause(){
        self.paused = true;
    }

    function resume(){
        self.paused = false;
        loadCityDataPerPlayer(self.worldRankingsData);
    }

    function loadWorldRankings(){
        $http.post('https://w5.crownofthegods.com/includes/gR.php',{a: 0}).then(function(results){
            console.log(results);
            self.initialRankingsLoaded = true;
            processWorldRankings(results.data[0]);
        })
    };

    //Handles the setting of the rankings data 
    function processWorldRankings(data){
        self.worldRankingsData = data;
    } 

    function loadCityDataPerPlayer(data){
        if(!self.paused){
            self.loading = true;
            if(self.currentIndex < data.length){
                if(Number(data[self.currentIndex]['3']) > 3){
                    console.log(data[self.currentIndex]['1']);
                    $http({
                        method: 'POST',
                        url: 'https://w5.crownofthegods.com/includes/gPi.php', 
                        data: $.param({a: data[self.currentIndex]['1']}),
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                    })
                        .then(function(results){
                            handlePlayerCityData(results, data, self.currentIndex);
                    });
                } else {
                    self.ignoredCount++;
                    self.currentIndex++;
                    loadCityDataPerPlayer(data, self.currentIndex);
                }
            } else {
                self.complete = true;
                self.loading = false;
            }            
        }
    }

    //Handles the result from loading the city data for an individual player
    function handlePlayerCityData(results, data){
        self.citiesData.push(processCityData(results.data));
        self.currentIndex++;

        window.setTimeout(function(){
            loadCityDataPerPlayer(data);
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
            self.loadedCitiesCount++;
        }
        return cities;
    }

    /*******************************************
         ====== Sending/Downloading ======
    ********************************************/

    function downloadCsv(){
        let flattened = flattenData(self.citiesData);
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



}

function scoutDataCtrl($scope, $http){
    let self = this;

    self.loading = false;
    self.paused = false;
    self.currentIndex = 0;
    self.pastedCityData = '';
    self.cityDataArray = [];
    self.cityDataHash = {};

    self.mappings = new dataMappings();

    self.updatePastedData = updatePastedData;
    self.clearCityData = clearCityData;
    self.getScoutData = getReportsForCities;

    function updatePastedData(){
        let idArray = self.pastedCityData.split(',');
        for(let i = 0; i < idArray.length; i++){
            if(!isNaN(idArray[i]) && idArray[i] !== ''){
                if(typeof self.cityDataHash[idArray[i]] == 'undefined'){
                    let newCity = {
                        id: idArray[i],
                        loaded: false,
                        reportIds: [],
                        report: {}
                    };

                    self.cityDataArray.push(newCity);
                    self.cityDataHash[idArray[i]] = newCity;
                }
            }
        }
    }

    function getReportsForCities(){
        let data = self.cityDataArray;
        if(!self.paused){
            self.loading = true;
            if(self.currentIndex < data.length){
                $http({
                    method: 'POST',
                    url: 'https://w5.crownofthegods.com/includes/gCi.php', 
                    data: $.param({a: data[self.currentIndex].id}),
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}                    
                }).then(function(results){
                    let mapped = mapCityDetails(results.data);
                    let reportsList = parseIndividualReportsFromResultsTable(mapped.reportTable);
                })
            }
        }
    }

    //Maps the city details results to human readable properties
    function mapCityDetails(data){
        let cityDetails = {};
        for(let prop in self.mappings.cityDetailsMap){
            cityDetails[prop] = data[self.mappings.cityDetailsMap[prop]];
        }
        console.log(cityDetails);
        return cityDetails;
    }

    //Parses out each of the reports basic info from the city details results
    function parseIndividualReportsFromResultsTable(table){
        let reports = [];
        $('#reportsTable').html(table);
        $('#reportsTable [id="cityinfotablebody"]').each(function(){
            let report = {};
            report.id = $(this).find('[id="reportIDcityinfo"]').attr('data');
            report.date = $(this).find('[id="reporttimecityinfo"]').text();
            report.type = $(this).find('[id="reportIDcityinfo"]').text();
            report.type = report.type.substring(0, report.type.indexOf(':'));
            console.log(report);
            report.push(report);
        });
        return reports;
    }

    function getValidReportForCity(reports){
        for(var i = 0; i < reports.length; i++){
            $http({
                method: 'POST',
                url: 'https://w5.crownofthegods.com/includes/gFrep.php', 
                data: $.param({r: reports[i].id}),
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}                        
            }).then(function(results){
                console.log(results.data);
            })
        }
    }

    function clearCityData(){
        self.cityDataHash = {};
        self.cityDataArray = [];
    }

    function pause(){

    }
}


function mainPage(){
    let self = this;

    self.setup = function(){
        $('body').attr('ng-app', 'app');
        $('body').attr('ng-controller', 'mainController as main');
        $('body').html(self.html);
    }

    self.html = '<div class="ui middle aligned grid child">\
                    <div class="ui center aligned container grid">\
                        <div class="row">\
                            <div class="ten wide column">\
                                <div class="ui basic segment">\
                                     <div ng-if="main.mode == \'none\'"  class="ui segment">\
                                        <div class="ui stacking form">\
                                            <div class="two fields">\
                                                <div class="field">\
                                                    <div ng-click="main.switchMode(\'cityData\')" class="ui button">World City Data</div>\
                                                </div>\
                                                <div class="field">\
                                                    <div ng-click="main.switchMode(\'scoutData\')" class="ui button">Scout Reports</div>\
                                                </div>\
                                            </div>\
                                        </div>\
                                    </div>\
                                    <div ng-if="main.mode == \'cityData\'" ng-controller="cityDataCtrl as city" class="ui segment">\
                                        <div class="one field">\
                                            <div ng-if="city.complete" class="field">\
                                                <div class="ui header">All Data Loaded</div>\
                                                <div ng-disabled="!city.initialRankingsLoaded" ng-click="city.downloadCsv()" ng-class="{disabled: !city.initialRankingsLoaded}" class="ui small inverted orange button">Download CSV</div>\
                                            </div>\
                                            <div ng-if="!city.complete" class="field">\
                                                <div ng-if="!city.loading && !city.initialRankingsLoaded" ng-click="city.loadWorldRankings()" class="ui small inverted green button">Load Rankings</div>\
                                                <div ng-if="!city.loading && city.initialRankingsLoaded" ng-click="city.loadCityData(city.worldRankingsData)" class="ui small inverted green button">Load City Data</div>\
                                                <div ng-if="city.loading" class="ui small disabled button">Loading...</div>\
                                                <div ng-if="!city.paused" ng-click="city.pause()" ng-disabled="!city.initialRankingsLoaded" ng-class="{disabled: !city.initialRankingsLoaded}" class="ui small inverted blue button">Pause</div>\
                                                <div ng-if="city.paused" ng-click="city.resume()" ng-disabled="!city.initialRankingsLoaded" ng-class="{disabled: !city.initialRankingsLoaded}" class="ui small inverted blue button">Resume</div>\
                                                <div ng-disabled="!city.initialRankingsLoaded" ng-click="city.downloadCsv()" ng-class="{disabled: !city.initialRankingsLoaded}" class="ui small inverted orange button">Download CSV</div>\
                                            </div>\
                                        </div>\
                                        <table class="ui celled table">\
                                            <thead>\
                                                <tr class="center aligned">\
                                                    <th>Rankings Found</th>\
                                                    <th>Total Cities Loaded</th>\
                                                    <th>Total Players Loaded</th>\
                                                    <th>Total Players Ignored</th>\
                                                </tr>\
                                            </thead>\
                                            <tbody>\
                                                <tr class="center aligned">\
                                                    <td>{{city.worldRankingsData.length}}</td>\
                                                    <td>{{city.loadedCitiesCount}}</td>\
                                                    <td>{{city.citiesData.length}}</td>\
                                                    <td>{{city.ignoredCount}}</td>\
                                                </tr>\
                                            </tbody>\
                                        </table>\
                                    </div>\
                                    \
                                    <div ng-if="main.mode == \'scoutData\'" ng-controller="scoutDataCtrl as scout" class="ui segment">\
                                        <div class="ui form">\
                                            <div class="field">\
                                                <textarea ng-change="scout.updatePastedData()" ng-model="scout.pastedCityData" rows=4 placeholder="Paste city IDs here"></textarea>\
                                            </div>\
                                        </div>\
                                        <div style="margin: 1em;"></div>\
                                        <div class="ui form">\
                                            <div class="inline fields">\
                                                <div class="field">\
                                                    <div ng-if="!scout.loading && !scout.validCityPaste" ng-click="scout.getScoutData()" class="ui inverted green button">Load Scout Data</div>\
                                                    <div ng-if="scout.loading" class="ui disabled button">Loading...</div>\
                                                    <div ng-if="!scout.paused" class="ui small inverted blue button">Pause</div>\
                                                    <div ng-if="scout.paused" class="ui small inverted blue button">Resume</div>\
                                                    <div class="ui inverted orange button">Download CSV</div>\
                                                </div>\
                                                <div class="field">\
                                                    <div ng-click="scout.clearCityData()" class="ui inverted red right floated button">Clear Cities</div>\
                                                </div>\
                                            </div>\
                                            <table class="ui celled small compact table">\
                                                <thead>\
                                                    <tr class="center aligned">\
                                                        <th>City</th>\
                                                        <th>Owner</th>\
                                                        <th>Loaded</th>\
                                                    </tr>\
                                                </thead>\
                                                <tbody>\
                                                    <tr ng-repeat="city in scout.cityDataArray" class="center aligned">\
                                                        <td ng-bind="city.id">454545454</td>\
                                                        <td>---</td>\
                                                        <td>\
                                                            <i ng-if="city.loaded" class="green check icon"></i>\
                                                            <i ng-if="!city.loaded" class="red remove icon"></i>\
                                                        </td>\
                                                    </tr>\
                                                </tbody>\
                                            </table>\
                                        </div>\
                                    </div>\
                                </div>\
                            </div>\
                        </div>\
                    </div>\
                </div>\
                <div style="display: none;" id="reportsTable"></div>';

}

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
            if(self.currentIndex < data.length){
                if(Number(data[self.currentIndex]['3']) > 3){
                    $.ajax({
                        url: 'https://w5.crownofthegods.com/includes/gPi.php',
                        type: 'post',
                        data: {a: data[self.currentIndex]['1']}
                    }).then(function(results){
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

    self.cityDetailsMap = {
        'player': 'a',
        'alliance': 'b',
        'cityName': 'c',
        'score': 'd',
        'coords': 'e',
        'continent': 'f',
        'reportTable': 'j'
    };
}












